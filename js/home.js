(function () {
  'use strict';

  var header = document.getElementById('site-header');
  var hero = document.getElementById('top');
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('home-nav-toggle');
  var closeButton = nav && nav.querySelector('.nav__close');
  var backdrop = document.querySelector('.nav__backdrop');
  var lastFocused = null;

  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.setAttribute('data-open', String(open));
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (backdrop) backdrop.classList.toggle('is-visible', open);

    if (open) {
      lastFocused = document.activeElement;
      window.setTimeout(function () { if (closeButton) closeButton.focus(); }, 60);
    } else if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
      lastFocused = null;
    }
  }

  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      setMenu(nav.getAttribute('data-open') !== 'true');
    });
    if (closeButton) closeButton.addEventListener('click', function () { setMenu(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setMenu(false); });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.getAttribute('data-open') === 'true') setMenu(false);
    });
  }

  /* El progreso del primer scroll encadena tres estados de una sola marca:
     logotipo horizontal -> icono de la app -> icono de cabecera. */
  if (header && hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var wordmark = hero.querySelector('.hero__lockup--wordmark');
    var appIcon = hero.querySelector('.hero__lockup--app-icon');
    var brand = header.querySelector('.brand');
    var ticking = false;

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function ease(value) { return 1 - Math.pow(1 - value, 3); }

    function paintHero() {
      ticking = false;
      var total = Math.max(1, hero.offsetHeight - window.innerHeight);
      var progress = clamp(window.scrollY / total, 0, 1);
      var wordmarkFade = ease(clamp((progress - 0.07) / 0.22, 0, 1));
      var iconEmergence = ease(clamp((progress - 0.05) / 0.25, 0, 1));
      var movement = ease(clamp((progress - 0.3) / 0.35, 0, 1));
      var iconHandoff = ease(clamp((progress - 0.61) / 0.14, 0, 1));
      var copyOpacity = ease(clamp((progress - 0.34) / 0.32, 0, 1));
      var headerBrandOpacity = iconHandoff;
      var headerBackground = ease(clamp((progress - 0.37) / 0.23, 0, 1));
      var brandRect = brand.getBoundingClientRect();
      var startX = window.innerWidth / 2;
      var startY = window.innerHeight / 2;
      var targetX = brandRect.left + brandRect.width / 2;
      var targetY = header.offsetHeight / 2;

      hero.style.setProperty('--hero-progress', progress.toFixed(4));
      hero.style.setProperty('--hero-copy-opacity', copyOpacity.toFixed(4));
      hero.style.setProperty('--hero-wordmark-opacity', (1 - wordmarkFade).toFixed(4));
      hero.style.setProperty('--hero-wordmark-scale', (1 - wordmarkFade * 0.04).toFixed(4));
      hero.style.setProperty('--hero-icon-opacity', (iconEmergence * (1 - iconHandoff)).toFixed(4));
      hero.style.setProperty('--hero-icon-scale', (0.32 + iconEmergence * 0.68 - movement * 0.68).toFixed(4));
      hero.style.setProperty('--hero-icon-x', (startX + (targetX - startX) * movement).toFixed(2) + 'px');
      hero.style.setProperty('--hero-icon-y', (startY + (targetY - startY) * movement).toFixed(2) + 'px');
      header.style.setProperty('--header-bg', headerBackground.toFixed(4));
      header.style.setProperty('--header-brand-opacity', headerBrandOpacity.toFixed(4));
      header.classList.toggle('is-solid', progress > 0.46 || window.scrollY >= total);
    }

    function requestPaint() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paintHero);
    }

    window.addEventListener('scroll', requestPaint, { passive: true });
    window.addEventListener('resize', requestPaint);
    if (wordmark && appIcon) paintHero();
  } else if (header) {
    header.classList.add('is-solid');
    header.style.setProperty('--header-bg', '1');
    header.style.setProperty('--header-brand-opacity', '1');
  }

  /* Los botones de inscripción llegan al mismo formulario, ya con el tipo
     de participante seleccionado. No se envía nada hasta pulsar Enviar. */
  var roleSelect = document.getElementById('cf-role');
  var queryRole = new URLSearchParams(window.location.search).get('role');
  if (roleSelect && queryRole && roleSelect.querySelector('option[value="' + queryRole + '"]')) {
    roleSelect.value = queryRole;
  }
  document.querySelectorAll('[data-role-target]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (!roleSelect) return;
      roleSelect.value = link.getAttribute('data-role-target') || 'otro';
      window.setTimeout(function () { roleSelect.focus({ preventScroll: true }); }, 700);
    });
  });
})();
