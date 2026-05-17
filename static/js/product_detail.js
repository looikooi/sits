/**
 * КанцПро — product_detail.js  |  v3.0 2025
 * ─────────────────────────────────────────────────────────────────
 * Страница детали товара. Переиспользует логику корзины из script.js
 * ЧЕРЕЗ тот же localStorage-ключ — корзина общая с главной страницей.
 *
 * Зависимости: script.js (уже подключён в base.html)
 * Данные товара: window.PRODUCT_DATA (из Django-шаблона)
 *
 * Модули:
 *  QtyControl   — счётчик количества + subtotal
 *  AddToCart    — кнопки «В корзину» (основная + мобильная)
 *  MobileBuyBar — появление sticky-бара при скролле
 *  RelatedCards — кнопки «+» в похожих товарах
 *  Thumb        — переключение миниатюр галереи
 *  LangSync     — синхронизация языка с data-lang-* на этой странице
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/* ================================================================
   ЖДЁМ script.js — он инициализирует Cart, Lang, Toast и т.д.
   Если script.js подключён в base.html до этого файла,
   DOMContentLoaded уже сработал, поэтому используем defer-паттерн.
   ================================================================ */
(function () {

  /* ── HELPERS ──────────────────────────────────────────────── */
  const $  = id  => document.getElementById(id);
  const $$ = sel => [...document.querySelectorAll(sel)];

  /* ── PRODUCT DATA из Django ───────────────────────────────── */
  const PD = window.PRODUCT_DATA || {};

  /* ── QTY STATE ────────────────────────────────────────────── */
  let qty = 1;
  const MIN_QTY = 1;
  const MAX_QTY = 99;

  /* ================================================================
     QtyControl — счётчик количества
     ================================================================ */
  const QtyControl = {
    el:       null,
    decBtn:   null,
    incBtn:   null,
    subtotal: null,

    init() {
      this.el       = $('qtyVal');
      this.decBtn   = $('qtyDec');
      this.incBtn   = $('qtyInc');
      this.subtotal = $('pdSubtotalVal');
      if (!this.el) return;

      this.decBtn?.addEventListener('click', () => this.change(-1));
      this.incBtn?.addEventListener('click', () => this.change(+1));
      this.render();
    },

    change(delta) {
      const next = qty + delta;
      if (next < MIN_QTY || next > MAX_QTY) return;
      qty = next;
      this.render();

      /* Анимация значения */
      this.el.animate(
        [{ transform: `translateY(${delta > 0 ? '-6px' : '6px'})`, opacity: '.4' },
         { transform: 'none', opacity: '1' }],
        { duration: 180, easing: 'ease' }
      );
    },

    render() {
      if (!this.el) return;

      /* Счётчик */
      this.el.textContent = qty;

      /* Кнопки */
      if (this.decBtn) this.decBtn.disabled = qty <= MIN_QTY;
      if (this.incBtn) this.incBtn.disabled = qty >= MAX_QTY;

      /* Subtotal */
      if (this.subtotal && PD.price) {
        const total = (PD.price * qty).toLocaleString('ru-RU');
        this.subtotal.textContent = `${total} сом`;

        /* Подсветка при изменении */
        const box = $('pdSubtotal');
        if (box) {
          box.classList.add('highlight');
          clearTimeout(this._hlTimer);
          this._hlTimer = setTimeout(() => box.classList.remove('highlight'), 600);
        }
      }
    },
  };

  /* ================================================================
     AddToCart — кнопки «В корзину»
     ================================================================ */
  const AddToCart = {
    init() {
      const mainBtn   = $('addToCartBtn');
      const mobileBtn = $('mobileBuyBtn');

      if (mainBtn)   mainBtn.addEventListener('click',   () => this.add(mainBtn));
      if (mobileBtn) mobileBtn.addEventListener('click', () => this.add(mobileBtn));
    },

    add(btn) {
      if (!window.Cart) {
        console.warn('[product_detail] Cart не найден. Убедитесь, что script.js подключён.');
        return;
      }

      const lang    = window.State?.lang || 'ru';
      const nameKey = `name${lang[0].toUpperCase()}${lang.slice(1)}`;
      const name    = btn.dataset[nameKey] || btn.dataset.nameRu || PD.nameRu;

      /* Добавляем qty раз (или сразу qty штук) */
      window.Cart.add({
        id:      String(PD.id),
        name,
        name_ru: PD.nameRu || btn.dataset.nameRu,
        name_ky: PD.nameKy || btn.dataset.nameKy,
        price:   Number(btn.dataset.price) || PD.price,
        emoji:   btn.dataset.emoji || PD.emoji || '📦',
        qty:     qty - 1, /* Cart.add уже прибавляет 1, поэтому qty-1 доп. */
      });

      /* Если qty > 1, добавляем разницу вручную */
      if (qty > 1) {
        const item = window.State?.cart?.find(i => i.id === String(PD.id));
        if (item) {
          item.qty = item.qty + qty - 1; /* Корректируем */
          window.Cart._sync();
        }
      }

      /* Визуальная обратная связь */
      this._feedback(btn);
    },

    _feedback(btn) {
      const label = btn.querySelector('[data-i18n="addToCart"], span');
      const orig  = label?.textContent;

      btn.classList.add('added');
      btn.disabled = true;
      if (label) label.textContent = '✓ Добавлено';

      setTimeout(() => {
        btn.classList.remove('added');
        btn.disabled = false;
        if (label && orig) label.textContent = orig;
      }, 1400);
    },
  };

  /* ================================================================
     MobileBuyBar — появляется при скролле мимо кнопки покупки
     ================================================================ */
  const MobileBuyBar = {
    bar:       null,
    sentinel:  null,

    init() {
      this.bar = $('mobileBuyBar');
      if (!this.bar) return;

      /* Следим за кнопкой покупки как сентинелом */
      this.sentinel = $('addToCartBtn');
      if (!this.sentinel || !('IntersectionObserver' in window)) {
        /* Fallback: всегда показываем на мобиле */
        this.bar.classList.add('visible');
        return;
      }

      const io = new IntersectionObserver(entries => {
        /* Показываем bar когда кнопка НЕ видна */
        this.bar.classList.toggle('visible', !entries[0].isIntersecting);
      }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });

      io.observe(this.sentinel);
    },
  };

  /* ================================================================
     RelatedCards — кнопки «+» у похожих товаров
     ================================================================ */
  const RelatedCards = {
    init() {
      $$('.btn-add').forEach(btn => {
        /* Клон, чтобы убрать старые листенеры */
        btn.addEventListener('click', e => {
          e.preventDefault();
          if (!window.Cart) return;

          const lang    = window.State?.lang || 'ru';
          const nameKey = `name${lang[0].toUpperCase()}${lang.slice(1)}`;

          window.Cart.add({
            id:      btn.dataset.id,
            name:    btn.dataset[nameKey] ?? btn.dataset.nameRu,
            name_ru: btn.dataset.nameRu,
            name_ky: btn.dataset.nameKy ?? btn.dataset.nameRu,
            price:   Number(btn.dataset.price) || 0,
            emoji:   btn.dataset.emoji || '📦',
          });

          /* Feedback */
          const orig = btn.textContent;
          btn.textContent = '✓';
          btn.classList.add('added');
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = orig;
            btn.classList.remove('added');
            btn.disabled = false;
          }, 420);
        });
      });
    },
  };

  /* ================================================================
     Thumb — переключение миниатюр
     ================================================================ */
  const Thumb = {
    init() {
      const thumbs  = $$('.pd-thumb');
      const mainImg = document.querySelector('.pd-gallery__photo');
      if (!thumbs.length || !mainImg) return;

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbs.forEach(t => { t.classList.remove('pd-thumb--active'); t.removeAttribute('aria-current'); });
          thumb.classList.add('pd-thumb--active');
          thumb.setAttribute('aria-current', 'true');

          const src = thumb.querySelector('img')?.src;
          if (src && mainImg.src !== src) {
            mainImg.style.opacity = '0';
            mainImg.style.transform = 'scale(.97)';
            setTimeout(() => {
              mainImg.src = src;
              mainImg.style.transition = 'opacity .3s ease, transform .3s ease';
              mainImg.style.opacity = '1';
              mainImg.style.transform = 'none';
            }, 180);
          }
        });
      });
    },
  };

  /* ================================================================
     LangSync — при смене языка обновляем data-lang-* на странице
     (script.js уже делает это, но product_detail может быть загружен
      позже, поэтому слушаем кастомное событие)
     ================================================================ */
  const LangSync = {
    init() {
      /* Уже обрабатывается script.js через [data-lang-ru] сканирование.
         Здесь просто триггерим обновление если язык уже выбран. */
      const activeLang = document.querySelector('.lang-btn.active')?.dataset.lang;
      if (activeLang && window.Lang) {
        /* Не перезапускаем полностью, просто синхронизируем data-lang-* */
        $$('[data-lang-ru]').forEach(el => {
          const key = `lang${activeLang[0].toUpperCase()}${activeLang.slice(1)}`;
          el.textContent = el.dataset[key] || el.dataset.langRu || '';
        });
      }
    },
  };

  /* ================================================================
     REVEAL — появление блоков при скролле
     ================================================================ */
  function initReveal() {
    const els = $$('.pd-perk, .pd-price-block, .pd-gallery, .related-grid .product-card');
    if (!('IntersectionObserver' in window)) return;

    els.forEach(el => {
      el.style.opacity   = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity .5s ease, transform .5s ease';
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach((e, i) => {
        if (!e.isIntersecting) return;
        setTimeout(() => {
          e.target.style.opacity   = '1';
          e.target.style.transform = 'none';
        }, i * 70);
        io.unobserve(e.target);
      });
    }, { threshold: 0.08 });

    els.forEach(el => io.observe(el));
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    QtyControl.init();
    AddToCart.init();
    MobileBuyBar.init();
    RelatedCards.init();
    Thumb.init();
    LangSync.init();
    initReveal();
  }

  /* script.js слушает DOMContentLoaded и инициализирует Cart/Lang.
     product_detail.js запускается после (defer или внизу body),
     поэтому DOM гарантированно готов. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();