require('dotenv').config();

const express  = require('express');
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ===== Mail transporter (Gmail) =====
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,       // lorisparfumleiden@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // Google App Password (niet je gewone wachtwoord)
  },
});

// ===== Stripe webhook — raw body vereist voor handtekening-verificatie =====
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook-verificatie mislukt:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await handleCheckoutCompleted(session);
    } catch (err) {
      console.error('Onverwachte fout in handleCheckoutCompleted:\n', err.stack);
    }
  }

  res.json({ received: true });
});

// Overige routes: JSON body parser
app.use(express.json());

// ===== Verwerk voltooide checkout =====
async function handleCheckoutCompleted(session) {
  const email = session.customer_details?.email;
  const name  = session.customer_details?.name || 'Geachte klant';

  if (!email) {
    console.warn('Geen e-mailadres voor sessie:', session.id);
    return;
  }

  const orderNumber = session.id.slice(-8).toUpperCase();
  const totalCents  = session.amount_total ?? 0;
  const total       = (totalCents / 100).toFixed(2).replace('.', ',');

  // Bepaal verzendmethode
  const hasAddress = !!(session.shipping_details?.address?.line1);
  const shipping   = hasAddress ? 'Verzending naar uw adres' : 'Afhalen in de winkel';

  // Haal bestelde producten op via Stripe
  let lineItems = [];
  try {
    const result = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    lineItems = result.data;
  } catch (err) {
    console.error('Fout bij ophalen producten:', err.message);
  }

  const html = buildEmailHtml({ name, orderNumber, lineItems, total, shipping });

  // E-mail naar klant
  try {
    console.log(`Versturen e-mail naar: ${email}`);
    await transporter.sendMail({
      from: '"Loris Parfum Leiden" <lorisparfumleiden@gmail.com>',
      to: email,
      subject: 'Bedankt voor uw bestelling bij Loris Parfum Leiden',
      html,
    });
    console.log('E-mail succesvol verzonden');
  } catch (err) {
    console.error('Fout bij versturen bevestigingsmail naar klant:\n', err.stack);
  }

  // E-mail naar winkel
  const shopEmail = process.env.GMAIL_USER || 'lorisparfumleiden@gmail.com';
  const productList = lineItems.length
    ? lineItems.map(i => `- ${i.description} x${i.quantity}: €${((i.amount_total ?? 0) / 100).toFixed(2)}`).join('\n')
    : '(geen productdetails beschikbaar)';
  try {
    console.log(`Versturen e-mail naar: ${shopEmail}`);
    await transporter.sendMail({
      from: '"Loris Parfum Leiden" <lorisparfumleiden@gmail.com>',
      to: shopEmail,
      subject: `Nieuwe bestelling #${orderNumber} — €${total}`,
      text: `Nieuwe bestelling ontvangen!\n\nBestelnummer: #${orderNumber}\nKlant: ${name} <${email}>\nTotaal: €${total}\nOntvangst: ${shipping}\n\nProducten:\n${productList}`,
    });
    console.log('E-mail succesvol verzonden');
  } catch (err) {
    console.error('Fout bij versturen ordermelding naar winkel:\n', err.stack);
  }
}

// ===== HTML-escaping voor klantdata =====
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== HTML e-mailtemplate =====
function buildEmailHtml({ name, orderNumber, lineItems, total, shipping }) {
  const firstName = esc(name.split(' ')[0]);
  const year      = new Date().getFullYear();

  const itemRows = lineItems.length
    ? lineItems.map(item => {
        const itemTotal = ((item.amount_total ?? 0) / 100).toFixed(2).replace('.', ',');
        return `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #ede8df;font-size:14px;color:#333;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">
              ${esc(item.description)}
            </td>
            <td style="padding:14px 0;border-bottom:1px solid #ede8df;font-size:14px;color:#333;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;">
              ${item.quantity}
            </td>
            <td style="padding:14px 0;border-bottom:1px solid #ede8df;font-size:14px;color:#c9a45c;font-weight:600;text-align:right;font-family:'Helvetica Neue',Arial,sans-serif;">
              &euro;${itemTotal}
            </td>
          </tr>`;
      }).join('')
    : `<tr>
        <td colspan="3" style="padding:14px 0;font-size:14px;color:#888;font-family:'Helvetica Neue',Arial,sans-serif;">
          Bestelde producten (zie uw Stripe-ontvangstbewijs voor details)
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bevestiging bestelling — Loris Parfum Leiden</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ede8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ede8;padding:40px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background-color:#0a0a0a;padding:44px 48px 36px;text-align:center;">
            <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:5px;text-transform:uppercase;font-family:'Helvetica Neue',Arial,sans-serif;">
              LORIS PARFUM
            </p>
            <p style="margin:0;font-size:9px;color:#c9a45c;letter-spacing:9px;text-transform:uppercase;font-family:'Helvetica Neue',Arial,sans-serif;">
              LEIDEN
            </p>
            <div style="width:50px;height:1px;background-color:#c9a45c;margin:22px auto 0;"></div>
          </td>
        </tr>

        <!-- BEGROETING -->
        <tr>
          <td style="background-color:#ffffff;padding:44px 48px 28px;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;">
            <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c9a45c;font-family:'Helvetica Neue',Arial,sans-serif;">
              Orderbevestiging
            </p>
            <h1 style="margin:0 0 20px 0;font-size:26px;font-weight:700;color:#0a0a0a;letter-spacing:0px;font-family:'Helvetica Neue',Arial,sans-serif;">
              Bedankt, ${firstName}!
            </h1>
            <p style="margin:0;font-size:15px;color:#555;line-height:1.9;font-weight:300;font-family:'Helvetica Neue',Arial,sans-serif;">
              Uw bestelling is succesvol ontvangen en bevestigd.
              Wij danken u voor uw vertrouwen in Loris Parfum Leiden.
            </p>
          </td>
        </tr>

        <!-- BESTELNUMMER -->
        <tr>
          <td style="background-color:#ffffff;padding:0 48px 28px;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf9f7;border:1px solid #e6e0d2;padding:16px 24px;">
              <tr>
                <td style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#999;font-family:'Helvetica Neue',Arial,sans-serif;">
                  Bestelnummer
                </td>
                <td align="right" style="font-size:13px;font-weight:700;color:#0a0a0a;letter-spacing:2px;font-family:'Helvetica Neue',Arial,sans-serif;">
                  #${orderNumber}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PRODUCTENOVERZICHT -->
        <tr>
          <td style="background-color:#ffffff;padding:0 48px 0;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;">
            <p style="margin:0 0 14px 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c9a45c;font-family:'Helvetica Neue',Arial,sans-serif;">
              Besteld
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <thead>
                <tr>
                  <th align="left" style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;padding-bottom:10px;border-bottom:2px solid #e6e0d2;font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">
                    Product
                  </th>
                  <th align="center" style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;padding-bottom:10px;border-bottom:2px solid #e6e0d2;font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">
                    Aantal
                  </th>
                  <th align="right" style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;padding-bottom:10px;border-bottom:2px solid #e6e0d2;font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">
                    Bedrag
                  </th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- TOTAAL -->
        <tr>
          <td style="background-color:#ffffff;padding:0 48px 32px;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">
              <tr>
                <td style="padding-top:14px;font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
                  Totaal
                </td>
                <td align="right" style="padding-top:14px;font-size:22px;font-weight:700;color:#c9a45c;font-family:'Helvetica Neue',Arial,sans-serif;">
                  &euro;${total}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- GOUDEN SCHEIDINGSLIJN -->
        <tr>
          <td style="background-color:#ffffff;padding:0 48px;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;">
            <div style="height:1px;background-color:#c9a45c;opacity:0.4;"></div>
          </td>
        </tr>

        <!-- VERZENDMETHODE -->
        <tr>
          <td style="background-color:#ffffff;padding:28px 48px 36px;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;border-bottom:1px solid #e6e0d2;">
            <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c9a45c;font-family:'Helvetica Neue',Arial,sans-serif;">
              Ontvangst
            </p>
            <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
              ${shipping}
            </p>
            <p style="margin:0;font-size:14px;color:#666;line-height:1.8;font-weight:300;font-family:'Helvetica Neue',Arial,sans-serif;">
              Wij nemen zo snel mogelijk contact met u op via WhatsApp om een tijd af te spreken.
            </p>
          </td>
        </tr>

        <!-- WINKELADRES -->
        <tr>
          <td style="background-color:#0a0a0a;padding:36px 48px;">
            <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c9a45c;font-family:'Helvetica Neue',Arial,sans-serif;">
              Onze Winkel
            </p>
            <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
              Loris Parfum Leiden
            </p>
            <p style="margin:0 0 20px 0;font-size:14px;color:#999;line-height:1.8;font-weight:300;font-family:'Helvetica Neue',Arial,sans-serif;">
              Haarlemmerstraat 168<br>
              2312 GG Leiden
            </p>
            <p style="margin:0;font-size:13px;color:#777;font-family:'Helvetica Neue',Arial,sans-serif;">
              Vragen? Neem contact op via
              <a href="mailto:lorisleiden@snsbusiness.nl" style="color:#c9a45c;text-decoration:none;font-weight:500;">lorisleiden@snsbusiness.nl</a>
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:#060606;padding:22px 48px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#444;letter-spacing:1px;font-family:'Helvetica Neue',Arial,sans-serif;">
              &copy; ${year} Loris Parfum Leiden &mdash; Alle rechten voorbehouden
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ===== Start =====
app.listen(PORT, () => {
  console.log(`Loris webhook-server actief op poort ${PORT}`);
});
