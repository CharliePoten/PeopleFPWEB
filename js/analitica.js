/* ==========================================================================
   Analítica (Google Analytics 4), solo con consentimiento
   --------------------------------------------------------------------------
   La etiqueta de Google no se pega tal cual en el <head>: así se cargaría y
   pondría sus cookies antes de que nadie diga que sí, y eso es justo lo que
   prohíbe el art. 22.2 de la LSSI. Aquí:

     · Hasta que la persona acepta, no se descarga nada de Google ni se
       guarda ninguna cookie. Rechazar pesa lo mismo que aceptar: dos
       botones iguales, uno al lado del otro.
     · La elección dura 12 meses y se cambia cuando se quiera desde el pie
       («Configurar cookies»). Si alguien retira el sí, se borran las
       cookies de Analytics.
     · Solo en las páginas públicas: las de /cuenta/ no cargan este archivo.
     · Solo en peopleforpeople.es. En local o en una copia de pruebas el
       aviso sale igual, para poder verlo, pero no se envía nada: si no, las
       pruebas llenarían las estadísticas de visitas que no existen.
     · Sin Google Signals ni publicidad personalizada.

   Eventos de negocio (además de las páginas vistas):
     volunteer_signup_click       enlace al alta de voluntario
     organization_signup_click    enlace al alta de entidad
     lead_b2b_submit              formulario de contacto enviado por una
                                  ONG, un ayuntamiento o una empresa
     contact_submit               el mismo formulario, por cualquier otra
     waitlist_signup              alta en la lista de espera (solo el tipo
                                  de entidad, nunca el correo)
     resource_download            enlace a un documento (.pdf, .docx…)
   Nunca llevan datos de la persona: solo qué botón y desde qué sección.
   ========================================================================== */

(function () {
  'use strict';

  var ID = 'G-BNMCSPGJ4B';
  var CLAVE = 'pfp.cookies';
  var VIGENCIA_MS = 365 * 24 * 60 * 60 * 1000;
  var PRODUCCION = /^(www\.)?peopleforpeople\.es$/.test(window.location.hostname);

  var cargado = false;
  var aviso = null;

  /* ---------------------------------------------------------------------
     La elección
     --------------------------------------------------------------------- */

  function leerEleccion() {
    try {
      var e = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (!e || typeof e.analitica !== 'boolean') return null;
      // Pasado un año se vuelve a preguntar: el consentimiento no es eterno.
      if (!(Date.now() - new Date(e.fecha).getTime() < VIGENCIA_MS)) return null;
      return e;
    } catch (err) {
      return null;
    }
  }

  function guardarEleccion(si) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ analitica: si, fecha: new Date().toISOString(), version: 1 }));
    } catch (err) { /* modo privado: se preguntará en cada visita */ }
  }

  /* ---------------------------------------------------------------------
     Google Analytics
     --------------------------------------------------------------------- */

  function gtag() {
    window.dataLayer.push(arguments);
  }

  function cargarAnalitica() {
    if (cargado || !PRODUCCION) return;
    cargado = true;
    window['ga-disable-' + ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('js', new Date());
    gtag('config', ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }

  /* Al retirar el sí: que no se mande nada más y que no quede rastro. Las
     cookies las pone Google en el dominio principal, así que se borran con
     y sin dominio por si acaso. */
  function apagarAnalitica() {
    window['ga-disable-' + ID] = true;
    if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    var dominios = ['', '; domain=' + window.location.hostname, '; domain=.' + window.location.hostname.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (c) {
      var nombre = c.split('=')[0].trim();
      if (nombre === '_ga' || nombre.indexOf('_ga_') === 0) {
        dominios.forEach(function (d) {
          document.cookie = nombre + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
        });
      }
    });
  }

  function evento(nombre, datos) {
    if (!cargado || !window.gtag) return;
    // GA4 ya envía con `sendBeacon`: el evento sale aunque el clic lleve a
    // otra página.
    window.gtag('event', nombre, datos || {});
  }

  /* ---------------------------------------------------------------------
     El aviso
     --------------------------------------------------------------------- */

  function textos() {
    var d = (window.I18N && (window.I18N[document.documentElement.lang] || window.I18N.es)) || {};
    return function (clave, defecto) { return d[clave] || defecto; };
  }

  // Desde la raíz o desde una subcarpeta: la ruta a la política cambia.
  function rutaPrivacidad() {
    var enlace = document.querySelector('a[href$="privacidad.html"]');
    return enlace ? enlace.getAttribute('href') + '#cookies' : 'privacidad.html#cookies';
  }

  function crearAviso() {
    var T = textos();
    var caja = document.createElement('section');
    caja.className = 'aviso-cookies';
    caja.setAttribute('aria-label', T('cookies.aria', 'Aviso de cookies'));
    caja.setAttribute('data-i18n-aria', 'cookies.aria');
    caja.innerHTML =
      '<p class="aviso-cookies__texto">' +
      '<span data-i18n="cookies.texto"></span> ' +
      '<a data-i18n="cookies.mas"></a></p>' +
      '<div class="aviso-cookies__botones">' +
      '<button type="button" class="aviso-cookies__boton" data-eleccion="no" data-i18n="cookies.rechazar"></button>' +
      '<button type="button" class="aviso-cookies__boton" data-eleccion="si" data-i18n="cookies.aceptar"></button>' +
      '</div>';
    caja.querySelector('[data-i18n="cookies.texto"]').textContent =
      T('cookies.texto', 'Usamos cookies de Google Analytics para saber cómo se usa la web y mejorarla, solo si las aceptas.');
    var mas = caja.querySelector('a');
    mas.href = rutaPrivacidad();
    mas.textContent = T('cookies.mas', 'Más información');
    caja.querySelector('[data-eleccion="no"]').textContent = T('cookies.rechazar', 'Rechazar');
    caja.querySelector('[data-eleccion="si"]').textContent = T('cookies.aceptar', 'Aceptar');

    caja.addEventListener('click', function (e) {
      var b = e.target.closest('[data-eleccion]');
      if (!b) return;
      var si = b.getAttribute('data-eleccion') === 'si';
      guardarEleccion(si);
      if (si) cargarAnalitica();
      else apagarAnalitica();
      cerrarAviso();
    });
    return caja;
  }

  function abrirAviso() {
    if (!aviso) aviso = crearAviso();
    if (!aviso.isConnected) document.body.appendChild(aviso);
  }

  function cerrarAviso() {
    if (aviso && aviso.isConnected) aviso.remove();
  }

  /* «Configurar cookies» va al lado del enlace a la privacidad del pie. Se
     pone desde aquí y no en cada HTML: un solo sitio, y solo aparece donde
     el aviso funciona. Los pies son de dos tipos —lista o enlaces en una
     línea—, y en los dos queda igual de visible. */
  function ponerEnlaceDelPie() {
    var pie = document.querySelector('footer');
    var priv = pie && pie.querySelector('a[href$="privacidad.html"]');
    if (!pie || !priv || pie.querySelector('[data-cookies]')) return;

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pie-cookies';
    boton.setAttribute('data-cookies', '');
    boton.setAttribute('data-i18n', 'cookies.ajustes');
    boton.textContent = textos()('cookies.ajustes', 'Configurar cookies');
    boton.addEventListener('click', abrirAviso);

    var li = priv.closest('li');
    if (li) {
      var nuevo = document.createElement('li');
      nuevo.appendChild(boton);
      li.parentNode.insertBefore(nuevo, li.nextSibling);
    } else {
      var linea = priv.parentNode;
      linea.appendChild(document.createTextNode(' · '));
      linea.appendChild(boton);
    }
  }

  /* ---------------------------------------------------------------------
     Eventos
     --------------------------------------------------------------------- */

  var DOCUMENTO = /\.(pdf|docx?|odt|xlsx?|ods|pptx?|zip|csv)(\?|#|$)/i;

  function seccionDe(el) {
    var s = el.closest('section[id], header, footer, nav');
    if (!s) return 'pagina';
    return s.id || s.tagName.toLowerCase();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }

    if (/\/cuenta\/registro\.html$/.test(url.pathname)) {
      var rol = url.searchParams.get('rol');
      evento(rol === 'organization' ? 'organization_signup_click' : 'volunteer_signup_click', {
        ubicacion: seccionDe(a),
      });
    } else if (a.hasAttribute('download') || DOCUMENTO.test(url.pathname)) {
      evento('resource_download', { archivo: url.pathname.split('/').pop() });
    }
  });

  // Lo avisa `site.js` cuando el servidor confirma el envío. Solo llega el
  // tipo de perfil: ni nombre, ni correo, ni mensaje.
  var B2B = { ong: true, ayuntamiento: true, empresa: true };
  document.addEventListener('pfp:contacto-enviado', function (e) {
    var rol = (e.detail && e.detail.rol) || 'otro';
    evento(B2B[rol] ? 'lead_b2b_submit' : 'contact_submit', { tipo: rol });
  });

  document.addEventListener('pfp:lista-espera', function (e) {
    evento('waitlist_signup', { tipo: (e.detail && e.detail.perfil) || 'otro' });
  });

  /* ---------------------------------------------------------------------
     Arranque
     --------------------------------------------------------------------- */

  function arrancar() {
    ponerEnlaceDelPie();
    var e = leerEleccion();
    if (!e) abrirAviso();
    else if (e.analitica) cargarAnalitica();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
