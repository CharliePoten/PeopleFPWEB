/* ==========================================================================
   Comportamiento del sitio
   --------------------------------------------------------------------------
   Sin dependencias externas a propósito. La versión anterior cargaba
   ScrollReveal y Boxicons desde CDN, lo que ata la web a que dos servicios
   de terceros sigan vivos, y además envía la IP de cada visitante a esos
   dominios sin haberlo consentido — algo incómodo de sostener en una web
   con aviso de privacidad. Todo lo de aquí son unas pocas líneas propias.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'pfp.lang';
  var DEFAULT_LANG = 'es';

  /* ---------------------------------------------------------------------
     Idioma
     --------------------------------------------------------------------- */

  function dict(lang) {
    return (window.I18N && window.I18N[lang]) || {};
  }

  function applyLanguage(lang) {
    var d = dict(lang);
    if (!d || !Object.keys(d).length) return;

    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key in d) el.textContent = d[key];
      else if (window.console) console.warn('[i18n] falta la clave "' + key + '" en "' + lang + '"');
    });

    // Textos alternativos de imágenes: los lee quien no ve la foto, así que
    // también tienen que estar en su idioma.
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      if (key in d) el.setAttribute('alt', d[key]);
    });

    document.querySelectorAll('.lang [data-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === lang));
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* modo privado */ }
  }

  function initialLanguage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && window.I18N[saved]) return saved;
    } catch (e) { /* sin almacenamiento */ }

    // Sin preferencia guardada manda el idioma del navegador, pero solo si
    // es uno de los dos que tenemos; el resto del mundo ve español.
    var browser = (navigator.language || '').slice(0, 2).toLowerCase();
    return window.I18N && window.I18N[browser] ? browser : DEFAULT_LANG;
  }

  document.querySelectorAll('.lang [data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLanguage(btn.getAttribute('data-lang'));
    });
  });

  applyLanguage(initialLanguage());

  /* ---------------------------------------------------------------------
     Menú en móvil
     --------------------------------------------------------------------- */

  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      toggle.setAttribute('aria-expanded', String(!open));
    });

    // Al elegir un destino el menú se cierra solo: si no, tapa justo la
    // sección a la que se acaba de saltar.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------------------------------------------------------------------
     Apariciones al desplazar
     --------------------------------------------------------------------- */

  var reveals = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    // Navegador antiguo: se muestra todo. Nunca contenido invisible.
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     Sección activa en el menú
     --------------------------------------------------------------------- */

  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  var links = {};
  document.querySelectorAll('.nav__link').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') links[href.slice(1)] = a;
  });

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'page');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------------------------------------------------------------
     Formulario de contacto
     ---------------------------------------------------------------------
     Abre el programa de correo con el mensaje ya escrito, en vez de enviar
     los datos a un servicio de terceros. Es menos vistoso, pero significa
     que la web no almacena ni transmite datos personales a nadie: el
     mensaje va directo del visitante a nuestro buzón. Menos que declarar
     en el aviso de privacidad y menos que puede fallar.
     --------------------------------------------------------------------- */

  var form = document.getElementById('contact-form');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var lang = document.documentElement.lang || DEFAULT_LANG;
      var d = dict(lang);
      var status = document.getElementById('form-status');

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var role = form.role.value;
      var message = form.message.value.trim();
      var consent = form.consent.checked;

      function fail(key) {
        status.textContent = d[key] || '';
        status.setAttribute('data-state', 'error');
      }

      if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail('contact.errFields');
      }
      if (!consent) return fail('contact.errConsent');

      var subject = '[' + role + '] ' + name + ' — People for People';
      var body = message + '\n\n—\n' + name + '\n' + email;

      status.textContent = d['contact.sending'] || '';
      status.setAttribute('data-state', '');

      window.location.href =
        'mailto:peopleforpeopleofficial@gmail.com' +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      setTimeout(function () {
        status.textContent = d['contact.ok'] || '';
        status.setAttribute('data-state', 'ok');
      }, 800);
    });
  }

  /* ---------------------------------------------------------------------
     Visor de imagen ampliada

     Las fotos del collage se abren a pantalla completa. Se guarda desde
     dónde se abrió para devolver el foco al cerrar: quien navega con
     teclado no debe acabar al principio de la página cada vez.
     --------------------------------------------------------------------- */

  var visor = document.getElementById('visor');

  if (visor) {
    var visorImg = visor.querySelector('img');
    var origen = null;

    function abrirVisor(src, alt, boton) {
      origen = boton || null;
      visorImg.src = src;
      visorImg.alt = alt || '';
      visor.classList.add('abierto');
      // Un fotograma de margen para que la transición tenga desde dónde
      // partir; sin esto aparece de golpe.
      requestAnimationFrame(function () {
        visor.classList.add('visible');
      });
      document.body.style.overflow = 'hidden';
      visor.querySelector('.visor__cerrar').focus();
    }

    function cerrarVisor() {
      visor.classList.remove('visible');
      document.body.style.overflow = '';
      setTimeout(function () {
        visor.classList.remove('abierto');
        visorImg.removeAttribute('src');
        if (origen) origen.focus();
        origen = null;
      }, 250);
    }

    document.addEventListener('click', function (e) {
      var boton = e.target.closest('[data-ampliar]');
      if (boton) {
        var img = boton.querySelector('img');
        abrirVisor(boton.getAttribute('data-ampliar'), img ? img.alt : '', boton);
      }
    });

    visor.addEventListener('click', function (e) {
      // Se cierra al tocar el fondo o la equis, no al tocar la propia foto.
      if (e.target === visor || e.target.closest('.visor__cerrar')) cerrarVisor();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && visor.classList.contains('abierto')) cerrarVisor();
    });
  }
})();
