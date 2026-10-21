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

  /* Al llegar, una sola marca encadena tres estados —logotipo horizontal ->
     icono de la app -> icono de cabecera— y debajo aparecen el mensaje y los
     botones.

     Antes lo movía el scroll, y la primera pantalla era solo el logotipo: ni
     qué es esto ni qué hacer hasta bajar unos 500 px por una pantalla azul.
     La coreografía es la misma, pero la mueve el reloj y dura dos segundos.
     Se ve una vez por visita: quien vuelve a la portada, llega con un ancla
     o tiene la página ya bajada la encuentra hecha, y quien toca algo
     mientras dura no tiene que esperar a que acabe. */
  if (header && hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var wordmark = hero.querySelector('.hero__lockup--wordmark');
    var appIcon = hero.querySelector('.hero__lockup--app-icon');
    var brand = header.querySelector('.brand');
    var ESPERA_MS = 600;
    var DURACION_MS = 1800;
    var CLAVE_INTRO = 'pfp.introVista';
    var progreso = 1;
    var animacion = null;

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function ease(value) { return 1 - Math.pow(1 - value, 3); }

    function paintHero(progress) {
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
      header.classList.toggle('is-solid', progress > 0.46);
    }

    function terminar() {
      if (animacion) window.cancelAnimationFrame(animacion);
      animacion = null;
      if (progreso === 1) return;
      progreso = 1;
      paintHero(1);
    }

    if (wordmark && appIcon) {
      var vista = false;
      try { vista = sessionStorage.getItem(CLAVE_INTRO) === '1'; } catch (e) { /* sin almacenamiento */ }
      if (!vista && window.scrollY === 0 && !window.location.hash) progreso = 0;
      paintHero(progreso);

      if (progreso < 1) {
        try { sessionStorage.setItem(CLAVE_INTRO, '1'); } catch (e) { /* modo privado */ }
        var inicio = null;
        var paso = function (t) {
          if (inicio === null) inicio = t;
          progreso = clamp((t - inicio - ESPERA_MS) / DURACION_MS, 0, 1);
          paintHero(progreso);
          animacion = progreso < 1 ? window.requestAnimationFrame(paso) : null;
        };
        animacion = window.requestAnimationFrame(paso);
        ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'].forEach(function (evento) {
          window.addEventListener(evento, terminar, { passive: true, once: true });
        });
      }

      window.addEventListener('resize', function () { paintHero(progreso); });
    }
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

/* ==========================================================================
   Carrusel del panel de coordinación
   --------------------------------------------------------------------------
   Tres capturas: la del centro destacada y una a cada lado, detrás. Se pasa
   con las flechas, con los puntos, tocando una de las de los lados, con el
   teclado o arrastrando en el móvil.

   La posición la lleva un atributo y la animación la hace el CSS. Nada de
   mover pixeles desde aquí: así el navegador puede animarlo en la tarjeta
   gráfica, y quien tenga puesto «menos movimiento» se lo salta con una regla
   de CSS en vez de con una rama de código.
   ========================================================================== */

(function () {
  'use strict';

  var pista = document.getElementById('panel-demo');
  if (!pista) return;

  var fotos = Array.prototype.slice.call(pista.querySelectorAll('[data-shot]'));
  if (fotos.length < 2) return;

  var pie = document.getElementById('panel-pie');
  var puntos = Array.prototype.slice.call(document.querySelectorAll('[data-ir]'));
  var flechas = Array.prototype.slice.call(document.querySelectorAll('[data-mover]'));
  var actual = 0;

  function pintar() {
    var n = fotos.length;
    var saltan = [];

    fotos.forEach(function (f, i) {
      // Distancia a la del centro, por el camino más corto: con tres, la
      // última está a la izquierda de la primera, no a dos saltos.
      var d = ((i - actual) % n + n) % n;
      if (d > n / 2) d -= n;

      var pos = d === 0 ? 'centro' : d === -1 ? 'izq' : d === 1 ? 'der' : 'fuera';
      var antes = f.getAttribute('data-pos');

      /* La que da la vuelta pasa de un extremo al otro. Animar ese viaje la
         haría cruzar toda la anchura por detrás de la del centro: un bicho
         atravesando la pantalla cada vez que se pasa de captura. Se le quita
         la transición ese fotograma, así que reaparece ya en el otro lado y
         el ojo solo sigue a las dos que de verdad se mueven. */
      if ((antes === 'izq' && pos === 'der') || (antes === 'der' && pos === 'izq')) {
        f.setAttribute('data-salta', '');
        saltan.push(f);
      }

      f.setAttribute('data-pos', pos);
      // Lo que no está al frente no debe recibir el foco al tabular.
      var img = f.querySelector('img');
      if (img) img.setAttribute('draggable', 'false');
    });

    if (saltan.length) {
      // Un único recálculo para todas: sin leerlo, el navegador junta las dos
      // escrituras del atributo y el salto no llega a ocurrir.
      void pista.offsetWidth;
      saltan.forEach(function (f) { f.removeAttribute('data-salta'); });
    }

    /* El pie es uno solo y va debajo, en flujo. Se le cambia tambien la
       clave de idioma y no solo el texto: asi, si alguien cambia de idioma
       con el carrusel a mitad, el repaso de `site.js` lo traduce como a
       cualquier otra frase de la pagina. */
    if (pie) {
      var clave = fotos[actual].getAttribute('data-pie');
      var dicc = (window.I18N || {})[document.documentElement.lang];
      if (clave) {
        pie.setAttribute('data-i18n', clave);
        if (dicc && clave in dicc) pie.textContent = dicc[clave];
      }
    }

    puntos.forEach(function (p, i) {
      p.setAttribute('aria-current', i === actual ? 'true' : 'false');
    });
  }

  function ir(i) {
    var n = fotos.length;
    actual = ((i % n) + n) % n;
    pintar();
  }

  flechas.forEach(function (b) {
    b.addEventListener('click', function () {
      ir(actual + Number(b.dataset.mover));
    });
  });

  puntos.forEach(function (p) {
    p.addEventListener('click', function () {
      ir(Number(p.dataset.ir));
    });
  });

  /* Pulsar una de los lados la trae al centro: es lo que uno intenta. */
  fotos.forEach(function (f, i) {
    f.addEventListener('click', function () {
      if (f.getAttribute('data-pos') !== 'centro') ir(i);
    });
  });

  /* Teclado: el carrusel es un grupo enfocable y las flechas lo mueven. */
  pista.setAttribute('tabindex', '0');
  pista.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); ir(actual - 1); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); ir(actual + 1); }
  });

  /* Arrastrar en el móvil. Se mira solo el eje X y con un umbral: sin él,
     bajar por la página con el dedo encima cambiaría de captura. */
  var x0 = null;
  var arrastrado = false;

  pista.addEventListener('pointerdown', function (ev) {
    x0 = ev.clientX;
    arrastrado = false;
  });

  pista.addEventListener('pointerup', function (ev) {
    if (x0 === null) return;
    var dx = ev.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) {
      arrastrado = true;
      ir(actual + (dx < 0 ? 1 : -1));
    }
  });

  pista.addEventListener('pointercancel', function () {
    x0 = null;
  });

  /* Al soltar, el navegador manda ademas un `click`. Si se venia de un
     arrastre, ese clic cae sobre la captura que acaba de apartarse —el dedo
     empezo encima de ella— y el manejador de ahi abajo la devuelve al centro:
     el gesto se deshacia solo, y en el movil parecia que pasar el dedo no
     hacia nada. Se corta en captura, antes de que llegue a la figura. */
  pista.addEventListener('click', function (ev) {
    if (!arrastrado) return;
    arrastrado = false;
    ev.stopPropagation();
  }, true);

  pintar();
})();
