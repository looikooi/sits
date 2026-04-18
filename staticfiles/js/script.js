/**
 * КанцПро — script.js
 * Reads all product data from HTML data-* attributes.
 * Reads TRANSLATIONS from data-tr-ru / data-tr-ky on <body>.
 * Django-ready: just replace static <article> tags with {% for %} template.
 *
 * Modules: Lang | Cart | Filter | Header | Reveal | Toast
 * @version 2025.3
 */

'use strict';

/* ================================================================
   CONFIG
   ================================================================ */
const CONFIG = {
  currency:    'сом',
  defaultLang: 'ru',
  toastMs:     2600,
};

/* ================================================================
   TRANSLATIONS — loaded from data-tr-* on <body>
   (Keys marked (* product-level) are handled via data-lang-* in HTML)
   ================================================================ */
const TRANSLATIONS = (() => {
  const body = document.body;
  let ru = {};
  let ky = {};
  try { ru = JSON.parse(body.dataset.trRu || '{}'); } catch(e) { console.warn('data-tr-ru parse error', e); }
  try { ky = JSON.parse(body.dataset.trKy || '{}'); } catch(e) { console.warn('data-tr-ky parse error', e); }
  return { ru, ky };
})();

/* ================================================================
   STATE
   ================================================================ */
const State = {
  lang: CONFIG.defaultLang,
  cart: [],              // [{ id, name, price, emoji, qty }]
  activeCategory: 'all',
};

/* ================================================================
   HELPERS
   ================================================================ */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function t(key, prefix) {
  const val = TRANSLATIONS[State.lang][key] ?? TRANSLATIONS['ru'][key] ?? key;
  if (prefix !== undefined) return val + prefix;
  return val;
}

function formatPrice(amount) {
  return `${Number(amount).toLocaleString('ru-RU')} ${CONFIG.currency}`;
}

/* ================================================================
   LANG MODULE
   ================================================================ */
const Lang = {
  set(code) {
    if (!TRANSLATIONS[code]) return;
    State.lang = code;
    document.documentElement.lang = code;

    const siteTitle = TRANSLATIONS[code]['siteTitle'];
    if (siteTitle) document.title = siteTitle;

    /* Update all [data-i18n] elements */
    $$('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = TRANSLATIONS[code][key] ?? TRANSLATIONS['ru'][key];
      if (val !== undefined && val !== key) el.textContent = val;
    });

    /* Update product card texts (name, desc) — data-lang-ru / data-lang-ky */
    $$('[data-lang-ru]').forEach(el => {
      const dataKey = `lang${code.charAt(0).toUpperCase()}${code.slice(1)}`;
      const txt = el.dataset[dataKey] || el.dataset.langRu || '';
      el.textContent = txt;
    });

    /* Update lang buttons */
    $$('.index-lang-btn, .lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === code);
    });

    /* Re-render cart items so names update */
    Cart.renderItems();
  },
};

/* ================================================================
   TOAST MODULE
   ================================================================ */
const Toast = {
  _timer: null,
  show(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.remove('show'), CONFIG.toastMs);
  },
};

/* ================================================================
   CART MODULE
   ================================================================ */
const Cart = {
  _find: id => State.cart.find(i => i.id === id),

  add(item) {
    const existing = this._find(item.id);
    if (existing) {
      existing.qty++;
    } else {
      State.cart.push({ ...item, qty: 1 });
    }
    this._sync();
    const addedPrefix = TRANSLATIONS[State.lang]['toastAdded'] ?? 'Добавлено: ';
    Toast.show(addedPrefix + item.name);
  },

  changeQty(id, delta) {
    const item = this._find(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      const name = item.name;
      State.cart = State.cart.filter(i => i.id !== id);
      const removedPrefix = TRANSLATIONS[State.lang]['toastRemoved'] ?? 'Удалено: ';
      Toast.show(removedPrefix + name);
    }
    this._sync();
  },

  remove(id) {
    const item = this._find(id);
    if (!item) return;
    const name = item.name;
    State.cart = State.cart.filter(i => i.id !== id);
    const removedPrefix = TRANSLATIONS[State.lang]['toastRemoved'] ?? 'Удалено: ';
    Toast.show(removedPrefix + name);
    this._sync();
  },

  clear() {
    State.cart = [];
    Toast.show(TRANSLATIONS[State.lang]['toastCleared'] ?? 'Корзина очищена');
    this._sync();
  },

  total() {
    return State.cart.reduce((s, i) => s + i.price * i.qty, 0);
  },

  totalQty() {
    return State.cart.reduce((s, i) => s + i.qty, 0);
  },

  _sync() {
    const countEl = $('cartCount');
    if (countEl) {
      const qty = this.totalQty();
      countEl.textContent = qty;
      countEl.style.transform = 'scale(1.5)';
      requestAnimationFrame(() => {
        setTimeout(() => countEl.style.transform = '', 200);
      });
    }
    this.renderItems();
  },

  renderItems() {
    const body    = $('cartItems');
    const emptyEl = $('cartEmpty');
    const footEl  = $('cartFoot');
    const totalEl = $('cartTotalVal');
    const countEl = $('cartItemCount');
    if (!body) return;

    body.querySelectorAll('.cart-item').forEach(n => n.remove());

    if (State.cart.length === 0) {
      emptyEl.hidden = false;
      footEl.hidden  = true;
      return;
    }

    emptyEl.hidden = true;
    footEl.hidden  = false;

    if (totalEl) totalEl.textContent = formatPrice(this.total());
    if (countEl) countEl.textContent = this.totalQty();

    State.cart.forEach(item => {
      const lang = State.lang;
      const name = item[`name_${lang}`] ?? item.name;

      const node = document.createElement('div');
      node.className = 'cart-item';
      node.dataset.id = item.id;
      node.innerHTML = `
        <div class="cart-item__emoji" aria-hidden="true">${item.emoji}</div>
        <div class="cart-item__info">
          <div class="cart-item__name">${name}</div>
          <div class="cart-item__price">${formatPrice(item.price * item.qty)}</div>
        </div>
        <div class="cart-item__qty">
          <button class="cart-qty-btn" data-action="dec" data-id="${item.id}"
                  aria-label="Уменьшить количество">−</button>
          <span class="cart-qty-num">${item.qty}</span>
          <button class="cart-qty-btn" data-action="inc" data-id="${item.id}"
                  aria-label="Увеличить количество">+</button>
        </div>
      `;
      body.appendChild(node);
    });
  },

  open() {
    $('cartSidebar').classList.add('open');
    $('cartOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    $('cartSidebar').classList.remove('open');
    $('cartOverlay').classList.remove('open');
    document.body.style.overflow = '';
  },
};

/* ================================================================
   FILTER MODULE
   ================================================================ */
const Filter = {
  set(category) {
    State.activeCategory = category;

    $$('.index-filter-btn, .filter-btn').forEach(btn => {
      const sel = btn.dataset.category === category;
      btn.classList.toggle('active', sel);
      btn.setAttribute('aria-selected', String(sel));
    });

    $$('.index-product-card, .product-card').forEach(card => {
      const match = category === 'all' || card.dataset.category === category;
      card.hidden = !match;
    });

    /* Stagger reveal */
    const visible = [...$$('.index-product-card:not([hidden]), .product-card:not([hidden])')];
    visible.forEach((card, i) => {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = '';
      card.style.animationDelay = `${i * 0.04}s`;
    });
  },
};

/* ================================================================
   HEADER — scroll shadow
   ================================================================ */
const Header = {
  init() {
    const el = document.querySelector('.index-header, .header');
    if (!el) return;
    window.addEventListener('scroll', () => {
      el.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  },
};

/* ================================================================
   BURGER — mobile nav
   ================================================================ */
const Burger = {
  init() {
    const btn = $('burger');
    const nav = document.getElementById('nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });

    nav.querySelectorAll('.index-nav__link, .nav__link').forEach(link => {
      link.addEventListener('click', () => {
        btn.classList.remove('open');
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  },
};

/* ================================================================
   SCROLL REVEAL
   ================================================================ */
const Reveal = {
  init() {
    const targets = $$(
      '.index-contact-card, .contact-card, ' +
      '.index-about__kpi-card, .about__kpi-card, ' +
      '.index-section-head, .section-head, ' +
      '.index-hero__kpi, .hero__kpi'
    );
    /* Deduplicate (in case element has both classes) */
    const unique = [...new Set(targets)];
    unique.forEach(el => el.classList.add('reveal'));

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    unique.forEach(el => io.observe(el));
  },
};

/* ================================================================
   READ PRODUCT DATA FROM HTML btn-add DATA ATTRIBUTES
   ================================================================ */
function readProductFromBtn(btn) {
  const lang = State.lang;
  const dataKey = `name${lang.charAt(0).toUpperCase()}${lang.slice(1)}`;
  return {
    id:      btn.dataset.id,
    name:    btn.dataset[dataKey] ?? btn.dataset.nameRu,
    name_ru: btn.dataset.nameRu,
    name_ky: btn.dataset.nameKy ?? btn.dataset.nameRu,
    price:   Number(btn.dataset.price) || 0,
    emoji:   btn.dataset.emoji,
  };
}

/* ================================================================
   EVENTS
   ================================================================ */
function bindEvents() {

  /* Language */
  $$('.index-lang-btn, .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => Lang.set(btn.dataset.lang));
  });

  /* Cart open */
  $('cartBtn')?.addEventListener('click', () => Cart.open());

  /* Cart close */
  $('cartClose')?.addEventListener('click', () => Cart.close());

  /* Cart overlay */
  $('cartOverlay')?.addEventListener('click', () => Cart.close());

  /* Cart go shop link */
  $('cartGoShop')?.addEventListener('click', () => Cart.close());

  /* Cart qty (event delegation) */
  $('cartItems')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id    = btn.dataset.id;
    const delta = btn.dataset.action === 'inc' ? 1 : -1;
    Cart.changeQty(id, delta);
  });

  /* Checkout */
  $('checkoutBtn')?.addEventListener('click', () => {
    Toast.show(TRANSLATIONS[State.lang]['toastCheckout'] ?? 'Оформление заказа — скоро будет доступно');
  });

  /* Clear cart */
  $('clearCartBtn')?.addEventListener('click', () => Cart.clear());

  /* Add to cart — all .btn-add buttons */
  $$('.index-btn-add, .btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = readProductFromBtn(btn);
      Cart.add(product);
      btn.classList.add('added');
      btn.disabled = true;
      setTimeout(() => {
        btn.classList.remove('added');
        btn.disabled = false;
      }, 350);
    });
  });

  /* Filter bar */
  const filterBar = $('filterBar');
  filterBar?.addEventListener('click', e => {
    const btn = e.target.closest('.index-filter-btn, .filter-btn');
    if (btn) Filter.set(btn.dataset.category);
  });

  /* Close cart on Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('cartSidebar')?.classList.contains('open')) {
      Cart.close();
    }
  });

  /* Swipe to close cart on mobile */
  let touchStartX = 0;
  const cartSidebar = $('cartSidebar');
  cartSidebar?.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  cartSidebar?.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta > 60) Cart.close();
  }, { passive: true });
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Lang.set(CONFIG.defaultLang);
  Header.init();
  Burger.init();
  Reveal.init();
  Cart._sync();
  bindEvents();
});