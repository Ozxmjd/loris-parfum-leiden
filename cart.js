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

  function addToCart(name, category, price, image, stripeKey, qty) {
    var amount = Math.max(1, Math.min(10, parseInt(qty, 10) || 1));
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name === name && cart[i].category === category) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty = Math.min(10, existing.qty + amount);
    } else {
      var item = { name: name, category: category, price: price, image: image, qty: amount };
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
    link.style.cssText = 'position:relative;display:inline-flex;align-items:center;color:#c9a45c;text-decoration:none;transition:opacity .3s;';
    link.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="9" cy="21" r="1"/>' +
        '<circle cx="20" cy="21" r="1"/>' +
        '<path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>' +
      '</svg>' +
      '<span class="loris-cart-count" style="position:absolute;top:-8px;right:-10px;background:#c9a45c;color:#0a0a0a;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:700;display:' + (count > 0 ? 'flex' : 'none') + ';align-items:center;justify-content:center;font-family:Montserrat,sans-serif;line-height:1;">' + count + '</span>';
    link.addEventListener('mouseenter', function () { link.style.opacity = '0.75'; });
    link.addEventListener('mouseleave', function () { link.style.opacity = '1'; });
    return link;
  }

  function injectCartIcon() {
    if (document.querySelector('.loris-cart-nav-link')) return;
    var cartLink = createCartLink();

    // === Strategie 1: pagina's met .nav-end (index, parfum, bodycare, huisgeuren) ===
    // Injecteer VÓÓR de hamburger-knop zodat het icoon ook op mobiel zichtbaar blijft.
    var navEnd = document.querySelector('.nav-end');
    if (navEnd) {
      var toggle = navEnd.querySelector('.nav-toggle, button');
      if (toggle) {
        navEnd.insertBefore(cartLink, toggle);
      } else {
        navEnd.appendChild(cartLink);
      }
      return;
    }

    // === Strategie 2: pagina's met .header-inner maar zonder .nav-end (zoeken.html) ===
    // Injecteer VÓÓR de hamburger-knop in .header-inner.
    var headerInner = document.querySelector('.header-inner');
    if (headerInner) {
      var toggle2 = headerInner.querySelector('.nav-toggle, button');
      if (toggle2) {
        headerInner.insertBefore(cartLink, toggle2);
      } else {
        headerInner.appendChild(cartLink);
      }
      return;
    }

    // === Strategie 3: simpele nav (frequence, product-pagina's, etc.) ===
    // <nav> krijgt display:none op mobiel → injecteer in <header> zelf (BUITEN nav).
    // Header is display:flex → cart-icoon komt rechts van de logo/nav te staan.
    var header = document.querySelector('header');
    if (header) {
      var nav = header.querySelector('nav');
      if (nav) {
        header.insertBefore(cartLink, nav.nextSibling);
      } else {
        header.appendChild(cartLink);
      }
    }
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
        // Prijs
        '<p style="font-family:\'Playfair Display\',serif;font-size:30px;font-weight:600;color:#c9a45c;letter-spacing:1px;margin-bottom:20px;">' +
          '€' + product.price.toFixed(2).replace('.', ',') +
        '</p>' +
        // Aantal-selector
        '<div class="loris-qty-wrap" style="display:flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
          '<button class="loris-qty-minus" style="width:44px;height:44px;background:#0a0a0a;color:#fff;border:none;font-size:22px;line-height:1;cursor:pointer;transition:background .2s;flex-shrink:0;display:flex;align-items:center;justify-content:center;">&#8722;</button>' +
          '<span class="loris-qty-val" style="width:64px;height:44px;display:flex;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;font-size:15px;font-weight:600;color:#0a0a0a;background:#fff;border-top:1px solid #e6e0d2;border-bottom:1px solid #e6e0d2;border-left:1px solid #e6e0d2;border-right:1px solid #e6e0d2;user-select:none;">1</span>' +
          '<button class="loris-qty-plus" style="width:44px;height:44px;background:#0a0a0a;color:#fff;border:none;font-size:22px;line-height:1;cursor:pointer;transition:background .2s;flex-shrink:0;display:flex;align-items:center;justify-content:center;">+</button>' +
        '</div>' +
        // Knop
        '<button class="loris-atc-btn" style="width:100%;padding:16px 32px;background:#0a0a0a;color:#fff;border:2px solid #0a0a0a;font-family:Montserrat,sans-serif;font-size:13px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;transition:all .3s;">' +
          'In Winkelwagen' +
        '</button>' +
        '<p class="loris-atc-feedback" style="margin-top:10px;min-height:18px;font-size:11px;color:#c9a45c;letter-spacing:1px;text-transform:uppercase;font-family:Montserrat,sans-serif;"></p>' +
      '</div>';

    // Aantal-selector logica
    var qtyVal = div.querySelector('.loris-qty-val');
    var minusBtn = div.querySelector('.loris-qty-minus');
    var plusBtn = div.querySelector('.loris-qty-plus');

    function getQty() { return parseInt(qtyVal.textContent, 10) || 1; }

    minusBtn.addEventListener('click', function () {
      if (getQty() > 1) qtyVal.textContent = getQty() - 1;
    });
    plusBtn.addEventListener('click', function () {
      if (getQty() < 10) qtyVal.textContent = getQty() + 1;
    });

    // Hover-effecten op qty knoppen
    [minusBtn, plusBtn].forEach(function (qb) {
      qb.addEventListener('mouseenter', function () { qb.style.background = '#c9a45c'; });
      qb.addEventListener('mouseleave', function () { qb.style.background = '#0a0a0a'; });
    });

    // Hover-effect op atc-knop
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
      var qty = getQty();
      addToCart(product.name, product.category, product.price, image, product.stripeKey || null, qty);
      var fb = div.querySelector('.loris-atc-feedback');
      fb.textContent = '✓ ' + qty + (qty === 1 ? ' fles' : ' flessen') + ' toegevoegd';
      btn.textContent = 'Nog meer toevoegen';
      qtyVal.textContent = '1'; // reset naar 1 na toevoegen
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
