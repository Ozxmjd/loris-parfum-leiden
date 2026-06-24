/**
 * Loris Parfum Leiden — Winkelwagen Systeem
 *
 * STRIPE PAYMENT LINKS (al geconfigureerd):
 *    Frequence (E/K/U)          €19,99  → frequence
 *    Niche 50ml / Mystery /
 *      Extract Parfum           €35,00  → niche
 *    DMAR / Wild Horse          €30,00  → dmar
 *    Dubai 50ml                 €30,00  → dubai_50ml
 *    Dubai 100ml                €40,00  → dubai_100ml
 *    Signature                  €39,99  → signature
 *
 * Dubai 100ml producten: pas de titel van die pagina's aan naar
 *   "NAAM — Dubai 100ml — Loris Parfum Leiden"  (of voeg een override toe hieronder)
 */

(function () {
  'use strict';

  // ===== STRIPE PAYMENT LINKS =====
  var STRIPE_LINKS = {
    frequence:   'https://buy.stripe.com/bJeaEX5OZ26P7EB7A06sw00',
    niche:       'https://buy.stripe.com/bJe4gz3GRaDl4spbQg6sw01', // Niche 50ml + Mystery + Extract
    dmar:        'https://buy.stripe.com/4gM9AT4KV12L1gd07y6sw02', // DMAR + Wild Horse
    dubai_50ml:  'https://buy.stripe.com/cNidR94KV8vdaQNf2s6sw03',
    dubai_100ml: 'https://buy.stripe.com/cNi5kD4KV9zh5wt2fG6sw04',
    signature:   'https://buy.stripe.com/6oU00j5OZfXF9MJ1bC6sw05',
  };

  var WHATSAPP_NR = '31639135752';

  // ===== PRIJZEN PER CATEGORIE =====
  var CATEGORY_PRICES = {
    'Frequence Mannen':    19.99,
    'Frequence Vrouwen':   19.99,
    'Frequence Unisex':    19.99,
    'Dubai Collectie':     30.00, // 50ml standaard; 100ml via Dubai 100ml categorie
    'Dubai 100ml':         40.00,
    'Niche 50ml':          35.00,
    'Mystery Collectie':   35.00,
    'DMAR Collectie':      30.00,
    'Extract Parfum':      35.00,
    'Signature Collectie': 39.99,
  };

  var CATEGORY_STRIPE_KEY = {
    'Frequence Mannen':    'frequence',
    'Frequence Vrouwen':   'frequence',
    'Frequence Unisex':    'frequence',
    'Dubai Collectie':     'dubai_50ml',
    'Dubai 100ml':         'dubai_100ml',
    'Niche 50ml':          'niche',
    'Mystery Collectie':   'niche',
    'DMAR Collectie':      'dmar',
    'Extract Parfum':      'niche',
    'Signature Collectie': 'signature',
  };

  // Productspecifieke overrides (overschrijft categorie-prijs/Stripe-link)
  var PRODUCT_OVERRIDES = {
    'Wild Horse': { stripeKey: 'dmar', price: 30.00 },
  };

  // ===== WINKELWAGEN FUNCTIES =====
  function getCart() {
    try { return JSON.parse(localStorage.getItem('loris_cart') || '[]'); }
    catch (e) { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem('loris_cart', JSON.stringify(cart));
    updateAllBadges();
    window.dispatchEvent(new CustomEvent('loris-cart-updated'));
  }

  function getCartCount() {
    return getCart().reduce(function (s, i) { return s + i.qty; }, 0);
  }

  function addToCart(name, category, price, image, stripeKey) {
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name === name && cart[i].category === category) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty += 1;
    } else {
      var item = { name: name, category: category, price: price, image: image, qty: 1 };
      if (stripeKey) item.stripeKey = stripeKey;
      cart.push(item);
    }
    saveCart(cart);
  }

  function removeFromCart(name, category) {
    saveCart(getCart().filter(function (i) { return !(i.name === name && i.category === category); }));
  }

  function updateQty(name, category, qty) {
    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name === name && cart[i].category === category) {
        cart[i].qty = Math.max(1, parseInt(qty, 10) || 1);
        break;
      }
    }
    saveCart(cart);
  }

  // ===== CART BADGE =====
  function updateAllBadges() {
    var count = getCartCount();
    var badges = document.querySelectorAll('.loris-cart-count');
    for (var i = 0; i < badges.length; i++) {
      badges[i].textContent = count;
      badges[i].style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function createCartLink() {
    var count = getCartCount();
    var link = document.createElement('a');
    link.href = 'winkelwagen.html';
    link.className = 'loris-cart-nav-link';
    link.title = 'Winkelwagen';
    link.setAttribute('aria-label', 'Winkelwagen');
    link.style.cssText = 'position:relative;display:inline-flex;align-items:center;color:inherit;text-decoration:none;transition:color .3s;';
    link.innerHTML =
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>' +
        '<line x1="3" y1="6" x2="21" y2="6"/>' +
        '<path d="M16 10a4 4 0 01-8 0"/>' +
      '</svg>' +
      '<span class="loris-cart-count" style="position:absolute;top:-8px;right:-10px;background:#c9a45c;color:#0a0a0a;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:700;display:' + (count > 0 ? 'flex' : 'none') + ';align-items:center;justify-content:center;font-family:Montserrat,sans-serif;line-height:1;">' + count + '</span>';
    link.addEventListener('mouseenter', function () { link.style.color = '#c9a45c'; });
    link.addEventListener('mouseleave', function () { link.style.color = ''; });
    return link;
  }

  function injectCartIcon() {
    if (document.querySelector('.loris-cart-nav-link')) return;
    var cartLink = createCartLink();

    // index.html / parfum.html stijl → .nav-end
    var navEnd = document.querySelector('.nav-end');
    if (navEnd) { navEnd.appendChild(cartLink); return; }

    // zoeken.html stijl → ul.nav-links (list-item)
    var navList = document.querySelector('ul.nav-links');
    if (navList) {
      var li = document.createElement('li');
      li.appendChild(cartLink);
      navList.appendChild(li);
      return;
    }

    // Productpagina stijl → simpele <nav>
    var nav = document.querySelector('nav');
    if (nav) { nav.appendChild(cartLink); }
  }

  // ===== PRODUCTPAGINA DETECTIE =====
  function detectProductPage() {
    // Productpagina titels volgen: "PRODUCTNAAM — CATEGORIE — Loris Parfum Leiden"
    var parts = document.title.split(' — ');
    if (parts.length === 3 && parts[2].trim() === 'Loris Parfum Leiden') {
      var name = parts[0].trim();
      var category = parts[1].trim();

      // Productspecifieke override (bijv. Wild Horse → DMAR-link)
      var override = PRODUCT_OVERRIDES[name];
      if (override) {
        return { name: name, category: category, price: override.price, stripeKey: override.stripeKey };
      }

      var price = CATEGORY_PRICES[category];
      if (price) {
        return { name: name, category: category, price: price };
      }
    }
    return null;
  }

  function injectAddToCartSection(product) {
    if (document.querySelector('.loris-add-to-cart')) return;

    var imgEl = document.querySelector('.photo-frame img');
    var image = imgEl ? (imgEl.getAttribute('src') || '') : '';

    var div = document.createElement('div');
    div.className = 'loris-add-to-cart';
    div.style.cssText = 'text-align:center;padding:10px 40px 50px;background:#fff;';
    div.innerHTML =
      '<div style="max-width:350px;margin:0 auto;">' +
        '<p style="font-family:\'Playfair Display\',serif;font-size:30px;font-weight:600;color:#c9a45c;letter-spacing:1px;margin-bottom:22px;">' +
          '€' + product.price.toFixed(2).replace('.', ',') +
        '</p>' +
        '<button class="loris-atc-btn" style="width:100%;padding:16px 32px;background:#0a0a0a;color:#fff;border:2px solid #0a0a0a;font-family:Montserrat,sans-serif;font-size:13px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:all .3s;">' +
          'In Winkelwagen' +
        '</button>' +
        '<p class="loris-atc-feedback" style="margin-top:10px;min-height:18px;font-size:11px;color:#c9a45c;letter-spacing:1px;text-transform:uppercase;font-family:Montserrat,sans-serif;"></p>' +
      '</div>';

    var btn = div.querySelector('.loris-atc-btn');
    btn.addEventListener('mouseenter', function () {
      btn.style.background = '#c9a45c';
      btn.style.borderColor = '#c9a45c';
      btn.style.color = '#0a0a0a';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.background = '#0a0a0a';
      btn.style.borderColor = '#0a0a0a';
      btn.style.color = '#fff';
    });
    btn.addEventListener('click', function () {
      addToCart(product.name, product.category, product.price, image, product.stripeKey || null);
      var fb = div.querySelector('.loris-atc-feedback');
      fb.textContent = '✓ Toegevoegd aan winkelwagen';
      btn.textContent = 'Nog een toevoegen';
      setTimeout(function () {
        fb.textContent = '';
        btn.textContent = 'In Winkelwagen';
      }, 3000);
    });

    // Voeg in na product-nummer sectie, voor de geurnoten
    var anchor = document.querySelector('.product-number-section') || document.querySelector('.photo-section');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(div, anchor.nextSibling);
    } else {
      document.body.appendChild(div);
    }
  }

  // ===== INITIALISATIE =====
  function init() {
    injectCartIcon();
    var product = detectProductPage();
    if (product) injectAddToCartSection(product);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ===== PUBLIEKE API (voor winkelwagen.html) =====
  window.lorisCart = {
    getCart: getCart,
    saveCart: saveCart,
    removeFromCart: removeFromCart,
    updateQty: updateQty,
    getCartCount: getCartCount,
    STRIPE_LINKS: STRIPE_LINKS,
    CATEGORY_STRIPE_KEY: CATEGORY_STRIPE_KEY,
    PRODUCT_OVERRIDES: PRODUCT_OVERRIDES,
    WHATSAPP_NR: WHATSAPP_NR,
  };

}());
