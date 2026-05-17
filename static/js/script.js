/**
 * КанцПро — script.js  |  v3.0 2025
 * ─────────────────────────────────────────────────────────────────
 * Полная совместимость с Django-шаблоном: все data-* атрибуты и
 * классы из HTML-шаблона сохранены без изменений.
 *
 * Модули:
 *  Lang      — переключение языка (ru/ky)
 *  Cart      — корзина с localStorage, анимации, свайп
 *  Filter    — фильтрация каталога со stagger-анимацией
 *  Header    — sticky-тень + активные ссылки при скролле
 *  Burger    — мобильное меню
 *  Reveal    — плавное появление секций при скролле
 *  Toast     — уведомления с иконками
 *  Preloader — лёгкий fade-in страницы
 * ─────────────────────────────────────────────────────────────────
 * Подключить в base.html перед </body>:
 *   <script src="{% static 'js/script.js' %}"></script>
 */

'use strict';

/* ================================================================
   CONFIG
   ================================================================ */
const CONFIG = {
  currency:    'сом',
  defaultLang: 'ru',
  toastMs:     2800,
  staggerMs:   55,     // задержка между карточками при фильтрации
  revealDelay: 90,     // задержка между reveal-элементами
};

const CART_KEY = 'kancpro_cart_v3';

/* ================================================================
   TRANSLATIONS — из data-tr-ru / data-tr-ky на <body>
   ================================================================ */
const TR = (() => {
  const b = document.body;
  let ru = {}, ky = {};
  try { ru = JSON.parse(b.dataset.trRu || '{}'); } catch (e) { console.warn('[КанцПро] data-tr-ru:', e); }
  try { ky = JSON.parse(b.dataset.trKy || '{}'); } catch (e) { console.warn('[КанцПро] data-tr-ky:', e); }
  return { ru, ky };
})();

/* ================================================================
   STATE
   ================================================================ */
const State = {
  lang:           CONFIG.defaultLang,
  cart:           [],   // [{ id, name, name_ru, name_ky, price, emoji, qty }]
  activeCategory: 'all',
};

/* ================================================================
   HELPERS
   ================================================================ */
const $  = id  => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const t  = key => TR[State.lang]?.[key] ?? TR.ru?.[key] ?? key;

function formatPrice(n) {
  return `${Number(n).toLocaleString('ru-RU')} ${CONFIG.currency}`;
}

/* Безопасное сохранение / загрузка */
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(State.cart)); } catch (_) {}
}
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (Array.isArray(data)) State.cart = data;
  } catch (_) { State.cart = []; }
}

/* ================================================================
   TOAST — уведомления с иконками
   ================================================================ */
const Toast = (() => {
  let timer = null;

  const ICONS = {
    add:     `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#2DD4BF"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    remove:  `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#f87171"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    info:    `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#C9A84C"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
    clear:   `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#f87171"><path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z"/></svg>`,
  };

  /* Добавить стили для иконок в toast один раз */
  const ensureStyle = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const s = document.createElement('style');
      s.textContent = `
        .index-toast, .toast {
          display: flex; align-items: center; gap: 10px;
        }
        .index-toast svg, .toast svg {
          width: 18px; height: 18px; flex-shrink: 0;
        }
        .toast__text { flex: 1; }
      `;
      document.head.appendChild(s);
    };
  })();

  function show(msg, type = 'info') {
    const el = $('toast');
    if (!el) return;
    ensureStyle();

    el.innerHTML = `${ICONS[type] || ICONS.info}<span class="toast__text">${msg}</span>`;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), CONFIG.toastMs);
  }

  return { show };
})();

/* ================================================================
   LANG — переключение языка
   ================================================================ */
const Lang = {
  set(code) {
    if (!TR[code]) return;
    State.lang = code;
    document.documentElement.lang = code;

    /* Заголовок вкладки */
    const title = TR[code].siteTitle;
    if (title) document.title = title;

    /* [data-i18n] элементы */
    $$('[data-i18n]').forEach(el => {
      const val = TR[code][el.dataset.i18n] ?? TR.ru[el.dataset.i18n];
      if (val !== undefined) el.textContent = val;
    });

    /* Имена/описания товаров — data-lang-ru / data-lang-ky */
    $$('[data-lang-ru]').forEach(el => {
      const key = `lang${code[0].toUpperCase()}${code.slice(1)}`;
      el.textContent = el.dataset[key] || el.dataset.langRu || '';
    });

    /* Кнопки языка */
    $$('.index-lang-btn, .lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === code);
    });

    /* Обновить корзину (имена товаров) */
    Cart.renderItems();
  },
};

/* ================================================================
   CART — корзина
   ================================================================ */
const Cart = {
  _find: id => State.cart.find(i => i.id === id),

  /* ── Добавить товар ─────────────────────────────────────── */
  add(item) {
    const ex = this._find(item.id);
    if (ex) {
      ex.qty++;
    } else {
      State.cart.push({ ...item, qty: 1 });
    }
    this._sync();
    Toast.show(t('toastAdded') + item.name, 'add');
  },

  /* ── Изменить количество ────────────────────────────────── */
  changeQty(id, delta) {
    const item = this._find(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      const name = item.name;
      State.cart = State.cart.filter(i => i.id !== id);
      Toast.show(t('toastRemoved') + name, 'remove');
    }
    this._sync();
  },

  /* ── Очистить корзину ───────────────────────────────────── */
  clear() {
    /* Анимация удаления всех элементов */
    $$('.cart-item').forEach((el, i) => {
      el.style.transition = `opacity .2s ${i * 40}ms, transform .2s ${i * 40}ms`;
      el.style.opacity    = '0';
      el.style.transform  = 'translateX(20px)';
    });
    const delay = State.cart.length * 40 + 220;
    setTimeout(() => {
      State.cart = [];
      Toast.show(t('toastCleared'), 'clear');
      this._sync();
    }, delay);
  },

  /* ── Итог ───────────────────────────────────────────────── */
  total()    { return State.cart.reduce((s, i) => s + i.price * i.qty, 0); },
  totalQty() { return State.cart.reduce((s, i) => s + i.qty, 0); },

  /* ── Синхронизация счётчика и сохранение ───────────────── */
  _sync() {
    const countEl = $('cartCount');
    if (countEl) {
      const qty = this.totalQty();
      countEl.textContent = qty;
      /* Bounce-анимация счётчика */
      countEl.animate(
        [{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }],
        { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)' }
      );
    }
    this.renderItems();
    saveCart();
  },

  /* ── Отрисовка товаров в боковой панели ────────────────── */
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

    State.cart.forEach((item, idx) => {
      const name = item[`name_${State.lang}`] ?? item.name;
      const node = document.createElement('div');
      node.className  = 'cart-item';
      node.dataset.id = item.id;
      /* Stagger при открытии */
      node.style.opacity   = '0';
      node.style.transform = 'translateY(12px)';
      node.innerHTML = `
        <div class="cart-item__emoji" aria-hidden="true">${item.emoji || '📦'}</div>
        <div class="cart-item__info">
          <div class="cart-item__name">${escHtml(name)}</div>
          <div class="cart-item__price">${formatPrice(item.price * item.qty)}</div>
        </div>
        <div class="cart-item__qty">
          <button class="cart-qty-btn" data-action="dec" data-id="${item.id}" aria-label="Уменьшить">−</button>
          <span class="cart-qty-num">${item.qty}</span>
          <button class="cart-qty-btn" data-action="inc" data-id="${item.id}" aria-label="Увеличить">+</button>
        </div>`;
      body.appendChild(node);
      /* Анимация появления с задержкой */
      requestAnimationFrame(() => {
        setTimeout(() => {
          node.style.transition = 'opacity .25s ease, transform .25s ease';
          node.style.opacity    = '1';
          node.style.transform  = 'none';
        }, idx * 50);
      });
    });
  },

  /* ── Открыть / закрыть панель ───────────────────────────── */
  open() {
    $('cartSidebar')?.classList.add('open');
    $('cartOverlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    /* Фокус на заголовок для доступности */
    setTimeout(() => $('cartSidebar')?.querySelector('h3')?.focus(), 300);
  },
  close() {
    $('cartSidebar')?.classList.remove('open');
    $('cartOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
  },
};

/* Экранирование HTML (защита от XSS в именах товаров) */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ================================================================
   FILTER — фильтрация каталога со stagger-анимацией
   ================================================================ */
const Filter = {
  set(category) {
    if (State.activeCategory === category) return;
    State.activeCategory = category;

    /* Кнопки */
    $$('.index-filter-btn, .filter-btn').forEach(btn => {
      const active = btn.dataset.category === category;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    /* Карточки */
    const all     = $$('.index-product-card, .product-card');
    const visible = all.filter(c => category === 'all' || c.dataset.category === category);
    const hidden  = all.filter(c => !visible.includes(c));

    /* Сначала скрываем ненужные */
    hidden.forEach(c => {
      c.style.transition = 'opacity .15s ease, transform .15s ease';
      c.style.opacity    = '0';
      c.style.transform  = 'scale(.96)';
    });

    setTimeout(() => {
      hidden.forEach(c => { c.hidden = true; c.style.opacity = ''; c.style.transform = ''; });

      /* Показываем нужные со stagger */
      visible.forEach((card, i) => {
        card.hidden           = false;
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(16px)';
        card.style.transition = `opacity .28s ${i * CONFIG.staggerMs}ms ease,
                                  transform .28s ${i * CONFIG.staggerMs}ms ease`;
        requestAnimationFrame(() => {
          setTimeout(() => {
            card.style.opacity   = '1';
            card.style.transform = 'none';
          }, 10);
        });
        /* Убираем инлайн стили после завершения анимации */
        const duration = 300 + i * CONFIG.staggerMs;
        setTimeout(() => {
          card.style.transition = '';
          card.style.opacity    = '';
          card.style.transform  = '';
        }, duration + 50);
      });
    }, 160);
  },
};

/* ================================================================
   HEADER — тень при скролле + активные ссылки
   ================================================================ */
const Header = {
  _sections: [],

  init() {
    const header = document.querySelector('.index-header, .header');
    if (!header) return;

    /* Кэшируем секции для определения активной ссылки */
    this._sections = $$('#hero, #catalog, #about, #contact');

    const onScroll = () => {
      const y = window.scrollY;

      /* Тень */
      header.classList.toggle('scrolled', y > 20);

      /* Активная nav-ссылка */
      let current = '';
      this._sections.forEach(sec => {
        if (sec && sec.getBoundingClientRect().top <= 120) current = sec.id;
      });
      $$('.index-nav__link, .nav__link').forEach(link => {
        const href = link.getAttribute('href') || '';
        link.classList.toggle('active', href === `#${current}`);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* Запустить сразу */
  },
};

/* ================================================================
   BURGER — мобильное меню
   ================================================================ */
const Burger = {
  init() {
    const btn = $('burger');
    const nav = $('nav') || document.getElementById('nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });

    /* Закрыть при клике на ссылку */
    nav.querySelectorAll('.index-nav__link, .nav__link').forEach(link => {
      link.addEventListener('click', () => {
        btn.classList.remove('open');
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });

    /* Закрыть при клике вне меню */
    document.addEventListener('click', e => {
      if (!nav.contains(e.target) && !btn.contains(e.target)) {
        btn.classList.remove('open');
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  },
};

/* ================================================================
   REVEAL — плавное появление при скролле с задержкой
   ================================================================ */
const Reveal = {
  init() {
    const targets = $$(
      '.index-contact-card, .contact-card, ' +
      '.index-about__kpi-card, .about__kpi-card, ' +
      '.index-section-head, .section-head, ' +
      '.index-hero__kpi, .hero__kpi, ' +
      '.reveal'
    );

    /* Убираем дубли (элемент с двумя классами) */
    const unique = [...new Set(targets)];
    unique.forEach(el => el.classList.add('reveal'));

    if (!('IntersectionObserver' in window)) {
      unique.forEach(el => el.classList.add('visible'));
      return;
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        setTimeout(
          () => entry.target.classList.add('visible'),
          i * CONFIG.revealDelay
        );
        io.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    unique.forEach(el => io.observe(el));
  },
};

/* ================================================================
   PRODUCT DATA — читаем из data-* атрибутов кнопки «+»
   ================================================================ */
function readProduct(btn) {
  const code  = State.lang;
  const key   = `name${code[0].toUpperCase()}${code.slice(1)}`;
  return {
    id:      btn.dataset.id,
    name:    btn.dataset[key]   ?? btn.dataset.nameRu,
    name_ru: btn.dataset.nameRu ?? '',
    name_ky: btn.dataset.nameKy ?? btn.dataset.nameRu ?? '',
    price:   Number(btn.dataset.price) || 0,
    emoji:   btn.dataset.emoji || '📦',
  };
}

/* ================================================================
   PRELOADER — лёгкий fade-in страницы
   ================================================================ */
function initPageFade() {
  document.documentElement.style.opacity = '0';
  document.documentElement.style.transition = 'opacity .4s ease';
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.documentElement.style.opacity = '1';
    }, 10);
  });
}

/* ================================================================
   EVENTS
   ================================================================ */
function bindEvents() {

  /* Язык */
  $$('.index-lang-btn, .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => Lang.set(btn.dataset.lang));
  });

  /* Корзина — открыть */
  $('cartBtn')?.addEventListener('click', () => Cart.open());

  /* Корзина — закрыть */
  $('cartClose')?.addEventListener('click', () => Cart.close());

  /* Оверлей — закрыть */
  $('cartOverlay')?.addEventListener('click', () => Cart.close());

  /* «Перейти в каталог» из пустой корзины */
  $('cartGoShop')?.addEventListener('click', () => Cart.close());

  /* Изменение количества (делегирование) */
  $('cartItems')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    Cart.changeQty(btn.dataset.id, btn.dataset.action === 'inc' ? 1 : -1);
  });

  /* Оформить заказ */
  $('checkoutBtn')?.addEventListener('click', () => {
    Toast.show(t('toastCheckout'), 'info');
  });

  /* Очистить корзину */
  $('clearCartBtn')?.addEventListener('click', () => Cart.clear());

  /* Добавить в корзину */
  $$('.index-btn-add, .btn-add').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault(); /* Не переходим по ссылке */
      const product = readProduct(btn);
      Cart.add(product);

      /* Визуальная обратная связь */
      btn.classList.add('added');
      btn.disabled = true;
      btn.textContent = '✓';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.disabled    = false;
        btn.textContent = '+';
      }, 420);
    });
  });

  /* Фильтр каталога */
  $('filterBar')?.addEventListener('click', e => {
    const btn = e.target.closest('.index-filter-btn, .filter-btn');
    if (btn) Filter.set(btn.dataset.category);
  });

  /* Escape — закрыть корзину */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') Cart.close();
  });

  /* Свайп вправо — закрыть корзину на мобиле */
  (() => {
    const sidebar = $('cartSidebar');
    if (!sidebar) return;
    let startX = 0, startY = 0;
    sidebar.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    sidebar.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      /* Только горизонтальный свайп >60px */
      if (dx > 60 && dy < 40) Cart.close();
    }, { passive: true });
  })();

  /* Плавный скролл к якорям (полифилл для Safari) */
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id  = link.getAttribute('href').slice(1);
      const sec = id ? document.getElementById(id) : null;
      if (!sec) return;
      e.preventDefault();
      const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
      const top     = sec.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initPageFade();   /* 1. Плавный вход */
  loadCart();       /* 2. Загружаем корзину */
  Lang.set(CONFIG.defaultLang);  /* 3. Язык по умолчанию */
  Cart._sync();     /* 4. Счётчик + отрисовка */
  Header.init();    /* 5. Sticky + активные ссылки */
  Burger.init();    /* 6. Мобильное меню */
  Reveal.init();    /* 7. Scroll-reveal */
  bindEvents();     /* 8. Все события */
});