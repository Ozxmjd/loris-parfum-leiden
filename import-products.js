/**
 * import-products.js
 * Reads all product HTML pages and imports them into Supabase loris_products.
 * Usage: node import-products.js <SUPABASE_SERVICE_KEY>
 *    or: SUPABASE_SERVICE_KEY=xxx node import-products.js
 */

const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ===== CONFIG =====
const SUPABASE_URL = 'https://sabtifsgkunqblqqrrsp.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.argv[2];
const DIR          = __dirname;

if (!SERVICE_KEY) {
  console.error('❌  Geef SUPABASE_SERVICE_KEY mee: node import-products.js <KEY>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ===== PRICE + ML RULES =====
// price(collection, ml) → euros
function getPrice(collection, ml) {
  const c = collection.toLowerCase();
  if (c.includes('frequence'))   return 19.99;
  if (c.includes('dmar'))        return 30;
  if (c.includes('mystery'))     return 35;
  if (c.includes('niche'))       return 35;
  if (c.includes('signature'))   return 39.99;
  if (c.includes('dubai')) {
    if (ml === 50) return 30;
    return 40; // 100ml default
  }
  // unknown collection — use ml as hint
  if (ml === 50)  return 30;
  if (ml === 100) return 40;
  return 35;
}

// ===== COLLECTION NORMALISATION =====
function normaliseCollection(raw) {
  const r = (raw || '').trim();
  // Map titles like "Niche 50ml Collectie" → "Niche 50ml"
  const map = {
    'niche 50ml collectie': 'Niche 50ml',
    'niche 50ml':           'Niche 50ml',
    'extract parfum':       'Niche 50ml',  // Extract treated as Niche
    'dmar collectie':       'DMAR Collectie',
    'dubai collectie':      'Dubai Collectie',
    'mystery collectie':    'Mystery Collectie',
    'signature collectie':  'Signature Collectie',
    'frequence mannen':     'Frequence Mannen',
    'frequence vrouwen':    'Frequence Vrouwen',
    'frequence unisex':     'Frequence Unisex',
  };
  return map[r.toLowerCase()] || r;
}

// ===== CATEGORY FROM PRODUCT-META =====
function parseCategory(meta) {
  if (!meta) return null;
  const m = meta.toLowerCase();
  if (m.includes('vrouw') || m.includes('dames') || m.includes('women')) return 'Dames';
  if (m.includes('man')   || m.includes('heren') || m.includes('men'))   return 'Heren';
  if (m.includes('unisex')) return 'Unisex';
  return null;
}

// ===== HTML PARSERS =====
function attr(html, tag, attrName) {
  const re = new RegExp('<' + tag + '[^>]*\\s' + attrName + '=["\']([^"\']*)["\']', 'i');
  const m  = html.match(re);
  return m ? m[1] : null;
}

function innerText(html, selector) {
  // selector = 'h1 class="product-title"' etc.  simplified: just tag + class
  const re = new RegExp('<[^>]+class="' + selector + '"[^>]*>([^<]*)<', 'i');
  const m  = html.match(re);
  return m ? m[1].trim() : null;
}

function parseNoteSection(html, heading) {
  // Find the note-block containing heading, then extract note-chip texts
  const blockRe = new RegExp(
    '<div class="note-block">[\\s\\S]*?' + heading + '[\\s\\S]*?<div class="note-chips">([\\s\\S]*?)</div>\\s*</div>',
    'i'
  );
  const bm = html.match(blockRe);
  if (!bm) return [];
  const chipRe = /<span class="note-chip">[^<]*(?:<span[^>]*>[^<]*<\/span>)?([^<]+)<\/span>/gi;
  const notes  = [];
  let cm;
  while ((cm = chipRe.exec(bm[1])) !== null) {
    const note = cm[1].trim();
    if (note) notes.push(note);
  }
  return notes;
}

function parseNotesFromDescription(desc) {
  const top  = [];
  const mid  = [];
  const base = [];
  if (!desc) return { top, mid, base };

  const tMatch = desc.match(/Topnoten:\s*([^.]+)\./i);
  const mMatch = desc.match(/Middennoten:\s*([^.]+)\./i);
  const bMatch = desc.match(/Basisnoten:\s*([^.]+)\./i);

  const split = s => s ? s.split(/,\s*/).map(n => n.trim()).filter(Boolean) : [];
  return {
    top:  tMatch ? split(tMatch[1]) : [],
    mid:  mMatch ? split(mMatch[1]) : [],
    base: bMatch ? split(bMatch[1]) : [],
  };
}

// ===== PARSE ONE HTML FILE =====
function parseProduct(filename) {
  const filepath = path.join(DIR, filename);
  const html = fs.readFileSync(filepath, 'utf8');

  // --- Title: "ProductName — Collection — Loris Parfum Leiden" ---
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) return null;
  const titleParts = titleMatch[1].split(/\s*[—–-]{1,2}\s*/);
  // Only process product pages (2+ parts before "Loris Parfum Leiden")
  if (titleParts.length < 3) return null;
  // Last part must be Loris Parfum Leiden (or similar)
  if (!titleParts[titleParts.length - 1].toLowerCase().includes('loris')) return null;

  const productName   = titleParts[0].trim();
  const rawCollection = titleParts[1].trim();
  const collection    = normaliseCollection(rawCollection);

  // --- Description meta → notes ---
  const descMeta = attr(html, 'meta', 'content') ||
    (() => { const m = html.match(/name="description"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+name="description"/i); return m ? m[1] : null; })();
  const { top, mid, base } = parseNotesFromDescription(descMeta);

  // Fallback: parse note-chip sections from HTML body
  const topNotes  = top.length  ? top  : parseNoteSection(html, 'Topnoten');
  const midNotes  = mid.length  ? mid  : parseNoteSection(html, 'Middennoten');
  const baseNotes = base.length ? base : parseNoteSection(html, 'Basisnoten');

  // --- Image URL: first img inside photo-section or photo-frame ---
  let imageUrl = null;
  const photoSectionMatch = html.match(/<section[^>]+class="photo-section"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
  if (photoSectionMatch) {
    imageUrl = photoSectionMatch[1];
  } else {
    // fallback: first img src that's an image path
    const imgMatch = html.match(/<img[^>]+src="(images\/[^"]+)"/i);
    if (imgMatch) imageUrl = imgMatch[1];
  }

  // --- product-meta → category + ml ---
  const metaMatch = html.match(/<p class="product-meta">([^<]+)<\/p>/i);
  const metaText  = metaMatch ? metaMatch[1].replace(/&bull;/g, '·').replace(/\s+/g, ' ').trim() : null;
  const category  = parseCategory(metaText);
  let   ml        = null;
  if (metaText) {
    const mlMatch = metaText.match(/(\d+)\s*ml/i);
    if (mlMatch) ml = parseInt(mlMatch[1]);
  }
  // Default ml for frequence series
  if (!ml && collection.toLowerCase().startsWith('frequence')) ml = 50;

  const price = getPrice(collection, ml);

  return {
    name: productName,
    collection,
    category: category || null,
    price,
    ml: ml || null,
    image_url: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : imageUrl) : null,
    top_notes:    topNotes,
    middle_notes: midNotes,
    base_notes:   baseNotes,
    active: true,
  };
}

// ===== COLLECT ALL PRODUCT FILES =====
function getProductFiles() {
  return fs.readdirSync(DIR)
    .filter(f => f.endsWith('.html'))
    .filter(f => {
      // Skip non-product/utility pages
      const skip = [
        'index', 'parfum', 'winkelwagen', 'bedankt', 'zoeken', 'product',
        'admin', 'frequence', 'dubai', 'niche-50ml$', 'niche-50ml-classic',
        'niche-black', 'niche-extract', 'mystery', 'dmar$', 'signature$',
        'dubai-mannen', 'dubai-vrouwen', 'dubai-unisex', 'bodycare', 'huisgeuren',
        'frequence-mannen', 'frequence-vrouwen', 'frequence-unisex',
        'niche-50ml.html',
      ];
      const base = f.replace('.html', '');
      return !skip.some(s => {
        if (s.endsWith('$')) return base === s.slice(0, -1);
        return base === s;
      });
    });
}

// ===== MAIN =====
async function main() {
  console.log('🔍  Productpagina\'s scannen...\n');

  const files    = getProductFiles();
  const products = [];
  const skipped  = [];

  for (const file of files) {
    try {
      const p = parseProduct(file);
      if (!p) { skipped.push({ file, reason: 'geen 2-delig title (collectiepagina)' }); continue; }
      products.push({ file, product: p });
    } catch (err) {
      skipped.push({ file, reason: err.message });
    }
  }

  console.log(`✅  ${products.length} producten herkend`);
  console.log(`⏭️   ${skipped.length} bestanden overgeslagen\n`);

  if (skipped.length) {
    console.log('Overgeslagen:');
    skipped.forEach(s => console.log(`  • ${s.file} — ${s.reason}`));
    console.log('');
  }

  // Preview first 5
  console.log('Voorbeeld (eerste 5):');
  products.slice(0, 5).forEach(({ file, product: p }) => {
    console.log(`  ${file} → ${p.name} | ${p.collection} | €${p.price} | ${p.ml ? p.ml + 'ml' : '—'}`);
    if (p.top_notes.length)  console.log(`    Topnoten:    ${p.top_notes.join(', ')}`);
    if (p.middle_notes.length) console.log(`    Middennoten: ${p.middle_notes.join(', ')}`);
    if (p.base_notes.length) console.log(`    Basisnoten:  ${p.base_notes.join(', ')}`);
  });
  console.log('');

  // ===== UPSERT TO SUPABASE =====
  console.log('⬆️   Importeren naar Supabase loris_products...\n');

  let imported = 0;
  let errors   = 0;
  const BATCH  = 25;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch  = products.slice(i, i + BATCH).map(({ product }) => product);
    const { data, error } = await supabase
      .from('loris_products')
      .upsert(batch, { onConflict: 'name,collection', ignoreDuplicates: false })
      .select('id, name');

    if (error) {
      console.error(`❌  Batch ${Math.floor(i / BATCH) + 1} fout: ${error.message}`);
      errors += batch.length;
    } else {
      imported += (data || batch).length;
      const names = (data || []).map(p => p.name).join(', ');
      console.log(`  ✓ Batch ${Math.floor(i / BATCH) + 1}: ${(data || batch).length} producten — ${names.substring(0, 80)}${names.length > 80 ? '...' : ''}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅  Geïmporteerd: ${imported}`);
  if (errors) console.log(`❌  Fouten:        ${errors}`);
  console.log('═══════════════════════════════════════');
  console.log('\nProducten zijn direct zichtbaar via product.html?id=<uuid>');
}

main().catch(err => {
  console.error('❌  Onverwachte fout:', err.message);
  process.exit(1);
});
