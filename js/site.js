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

    /* Y lo que no es contenido pero sí se lee: el texto de sugerencia de un
       campo, el del globo de ayuda y el nombre accesible de un botón que
       solo tiene un icono. Traducir el `alt` y dejar sin traducir el
       `aria-label` deja a quien usa lector de pantalla navegando la mitad
       del sitio en español. */
    var ATRIBUTOS = { placeholder: 'placeholder', title: 'title', aria: 'aria-label' };
    Object.keys(ATRIBUTOS).forEach(function (sufijo) {
      document.querySelectorAll('[data-i18n-' + sufijo + ']').forEach(function (el) {
        var key = el.getAttribute('data-i18n-' + sufijo);
        if (key in d) el.setAttribute(ATRIBUTOS[sufijo], d[key]);
        else if (window.console) {
          console.warn('[i18n] falta la clave "' + key + '" en "' + lang + '"');
        }
      });
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

     Lo que NO se puede hacer es dar por hecho que se ha abierto. Un
     `mailto:` no avisa de nada: no hay evento, ni error, ni forma de
     preguntarlo. En un Windows corriente lo atiende el propio navegador
     —o cualquier programa que se haya apuntado a `mailto:`, que los hay—
     y si detrás no hay nadie no pasa absolutamente nada. Antes aquí se
     enseñaba «se ha abierto tu programa de correo» a los 800ms, pasara lo
     que pasase: quien no tuviera gestor se marchaba convencido de haber
     escrito, y el mensaje no salía de su pantalla.

     Ahora se intenta abrir, y a la vez se deja siempre a mano la salida:
     copiar el mensaje y la dirección a la que mandarlo.
     --------------------------------------------------------------------- */

  var BUZON = 'peopleforpeopleofficial@gmail.com';

  /** Al portapapeles, con red por si no hay API o no es un sitio seguro. */
  function alPortapapeles(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (bien, mal) {
      var caja = document.createElement('textarea');
      caja.value = texto;
      caja.setAttribute('readonly', '');
      caja.style.position = 'fixed';
      caja.style.opacity = '0';
      document.body.appendChild(caja);
      caja.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(caja);
      if (ok) bien(); else mal(new Error('sin portapapeles'));
    });
  }

  var form = document.getElementById('contact-form');
  var planB = document.getElementById('plan-b');
  var copiar = document.getElementById('cf-copiar');
  var abrir = document.getElementById('cf-abrir');
  var caja = document.getElementById('cf-copia');
  var copia = '';

  if (copiar) {
    copiar.addEventListener('click', function () {
      var d = dict(document.documentElement.lang || DEFAULT_LANG);
      alPortapapeles(copia)
        .then(function () {
          copiar.textContent = d['contact.copiado'] || '';
        })
        .catch(function () {
          /* Sin portapapeles queda enseñarlo para que lo copie a mano:
             peor es dejarle sin el texto que acaba de escribir. */
          if (!caja) return;
          caja.hidden = false;
          caja.focus();
          caja.select();
          copiar.textContent = d['contact.noCopia'] || '';
        });
    });
  }

  if (form) {
  /**
   * Manda el mensaje al servidor.
   *
   * Va a la Edge Function `contacto`, que lo guarda, nos lo reenvia y le
   * manda un acuse a quien escribe. Antes esto abria el programa de correo
   * del visitante, y cuando no habia ninguno configurado —que es lo normal—
   * el mensaje no salia de su pantalla mientras la web le decia que si.
   *
   * Si la llamada falla queda el plan B de siempre: copiar el texto y la
   * direccion. Ahora es lo que debe ser, un recambio, y no el camino.
   */
  function enviarContacto(datos) {
    var cfg = window.PFP_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      return Promise.reject({ tipo: 'red' });
    }

    return fetch(cfg.supabaseUrl + '/functions/v1/contacto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + cfg.supabaseAnonKey,
      },
      body: JSON.stringify(datos),
    }).then(
      function (r) {
        return r.json().catch(function () { return {}; }).then(function (cuerpo) {
          if (r.ok) return cuerpo;
          throw { tipo: r.status === 429 ? 'limite' : (r.status === 400 ? 'datos' : 'servidor') };
        });
      },
      function () { throw { tipo: 'red' }; },
    );
  }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var lang = document.documentElement.lang || DEFAULT_LANG;
      var d = dict(lang);
      var status = document.getElementById('form-status');
      var boton = form.querySelector('button[type=submit]');

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var role = form.role.value;
      var message = form.message.value.trim();
      var consent = form.consent.checked;
      var trampa = form.web ? form.web.value : '';

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

      /* El plan B se prepara ya, pero no se enseña salvo que falle el
         envío: enseñarlo antes de tiempo hace pensar que ha ido mal. */
      copia = subject + '\n\n' + body;
      if (abrir) {
        abrir.setAttribute(
          "href",
          'mailto:' + BUZON + '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body),
        );
      }
      if (caja) { caja.value = copia; caja.hidden = true; }
      if (copiar) copiar.textContent = d['contact.copiar'] || '';
      if (planB) planB.hidden = true;

      if (boton) { boton.disabled = true; }
      status.textContent = d['contact.sending'] || '';
      status.setAttribute('data-state', '');

      enviarContacto({
        nombre: name,
        email: email,
        rol: role,
        mensaje: message,
        lang: lang,
        web: trampa,
      })
        .then(function (r) {
          if (boton) boton.disabled = false;
          /* Solo se menciona el acuse si el servidor dice que lo ha
             mandado. Volver a prometer correos que no salen sería repetir
             exactamente el fallo que esto viene a arreglar. */
          status.textContent = (r && r.acuse) ? (d['contact.okAcuse'] || '') : (d['contact.ok'] || '');
          status.setAttribute('data-state', 'ok');
          // Para `analitica.js`, que solo lo cuenta si se aceptaron las
          // cookies. Va el tipo de perfil, nunca lo que se ha escrito.
          document.dispatchEvent(new CustomEvent('pfp:contacto-enviado', { detail: { rol: role } }));
          form.reset();
        })
        .catch(function (err) {
          if (boton) boton.disabled = false;
          var tipo = (err && err.tipo) || 'servidor';

          if (tipo === 'limite') return fail('contact.errLimite');
          if (tipo === 'datos') return fail('contact.errFields');

          /* No se ha podido enviar. Aquí sí toca el plan B: la persona no
             puede quedarse sin forma de hacernos llegar lo que escribió. */
          fail('contact.errEnvio');
          if (planB) planB.hidden = false;
        });
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
