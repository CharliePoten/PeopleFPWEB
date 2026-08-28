/* ==========================================================================
   El armazon de la consola de cuenta
   --------------------------------------------------------------------------
   Una sola definicion del menu lateral para todas las pantallas de `/cuenta`.
   Cada pagina dice quien es con `data-consola` en el `<body>` y aqui se le
   marca su entrada, se pinta la ficha de arriba y se piden los contadores.

   Por que vive aparte de `cuenta.js`: ese guion es el de los formularios de
   sesion —entrar, registro, recuperar—, paginas que NO llevan menu porque
   todavia no hay con que llenarlo. Meter el armazon dentro habria obligado a
   cargar la definicion del menu en la pantalla de recuperar contrasena.

   Nada de lo de aqui decide nada: que menu ve cada cual sale del rol que ya
   trae el perfil, y lo que se puede leer detras de cada enlace lo resuelve el
   servidor con sus politicas, exactamente igual que para la app. Esconder un
   enlace es cortesia, no seguridad.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  if (!PFP) return;

  /* ---------------------------------------------------------------------
     Iconos
     ---------------------------------------------------------------------
     En linea y no como archivos: son nueve dibujos de trescientos bytes y
     nueve peticiones mas al abrir la cuenta se notan mas que su peso. */

  var TRAZO = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

  function icono(d) {
    return '<svg class="lateral__icono" viewBox="0 0 24 24" aria-hidden="true" ' + TRAZO + '>' + d + '</svg>';
  }

  var ICONOS = {
    panel: icono('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
    gente: icono('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>'),
    reloj: icono('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    chat: icono('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 20.5l1.5-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>'),
    edificio: icono('<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h2a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/>'),
    papel: icono('<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h4"/>'),
    tarjeta: icono('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
    calendario: icono('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    medalla: icono('<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>'),
  };

  /* ---------------------------------------------------------------------
     El menu
     ---------------------------------------------------------------------
     Data-driven a proposito: anadir una pantalla es una linea aqui y un
     archivo nuevo, no tocar el pintado. Cada entrada:

       clave   lo que la pagina pone en `data-consola`
       href    a donde va
       i18n    clave del diccionario para el texto
       icono   cual de los de arriba
       cuenta  nombre del contador que le corresponde, si lleva */

  var MENU_ENTIDAD = [
    {
      titulo: 'c.nav.gCoordinacion',
      entradas: [
        { clave: 'panel',        href: 'index.html',        i18n: 'c.nav.panel',        icono: 'panel' },
        { clave: 'voluntariado', href: 'voluntariado.html', i18n: 'c.nav.voluntariado', icono: 'gente',  cuenta: 'solicitudes' },
        { clave: 'horas',        href: 'horas.html',        i18n: 'c.nav.horas',        icono: 'reloj',  cuenta: 'horas' },
        { clave: 'mensajes',     href: 'mensajes.html',     i18n: 'c.nav.mensajes',     icono: 'chat',   cuenta: 'mensajes' },
      ],
    },
    {
      titulo: 'c.nav.gEntidad',
      entradas: [
        { clave: 'organizacion', href: 'organizacion.html', i18n: 'c.nav.ficha',    icono: 'edificio' },
        { clave: 'informes',     href: 'informes.html',     i18n: 'c.nav.informes', icono: 'papel' },
        { clave: 'plan',         href: 'planes.html',       i18n: 'c.nav.plan',     icono: 'tarjeta' },
      ],
    },
  ];

  var MENU_VOLUNTARIO = [
    {
      titulo: 'c.nav.gTuActividad',
      entradas: [
        { clave: 'panel',      href: 'index.html',      i18n: 'c.nav.panel',      icono: 'panel' },
        { clave: 'actividad',  href: 'actividad.html',  i18n: 'c.nav.actividad',  icono: 'calendario' },
        { clave: 'mensajes',   href: 'mensajes.html',   i18n: 'c.nav.mensajes',   icono: 'chat', cuenta: 'mensajes' },
      ],
    },
    {
      titulo: 'c.nav.gTuCuenta',
      entradas: [
        { clave: 'perfil', href: 'voluntario.html', i18n: 'c.nav.perfil', icono: 'edificio' },
      ],
    },
  ];

  /* ---------------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------------- */

  function UI() {
    return window.PFP_UI || {};
  }

  function T(clave) {
    var t = UI().T;
    return t ? t(clave) : clave;
  }

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Iniciales para el hueco cuando no hay foto. Dos como mucho. */
  function iniciales(nombre) {
    var trozos = String(nombre || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!trozos.length) return '·';
    var uno = trozos[0].charAt(0);
    var dos = trozos.length > 1 ? trozos[trozos.length - 1].charAt(0) : '';
    return (uno + dos).toUpperCase();
  }

  /**
   * Un avatar: la foto si la hay, y si no las iniciales.
   *
   * `referrerpolicy` para que la peticion de la foto no lleve la URL de la
   * pantalla de cuenta al servidor de imagenes.
   */
  function avatar(foto, nombre, clase) {
    var cls = 'avatar' + (clase ? ' ' + clase : '');
    if (foto) {
      return (
        '<span class="' + cls + '"><img src="' + escapar(foto) + '" alt="" loading="lazy" ' +
        'referrerpolicy="no-referrer" /></span>'
      );
    }
    return '<span class="' + cls + '" aria-hidden="true">' + escapar(iniciales(nombre)) + '</span>';
  }

  /* ---------------------------------------------------------------------
     Pintado
     --------------------------------------------------------------------- */

  function pintarMenu(hueco, estado, activa) {
    var esEntidad = estado.perfil.role === 'organization' || !!estado.organizacion;
    var grupos = esEntidad ? MENU_ENTIDAD : MENU_VOLUNTARIO;

    var titulo = esEntidad && estado.organizacion
      ? estado.organizacion.nombre
      : estado.perfil.full_name || estado.perfil.email;

    /* «Voluntariado» y no «Voluntario»: es una etiqueta de rol debajo del
       nombre de una persona concreta, y el masculino generico ahi se lee
       como un error sobre ELLA. El sustantivo colectivo no tiene ese
       problema y dice lo mismo. */
    var pie = esEntidad
      ? (estado.organizacion ? T('c.nav.entidad') : T('c.mi.entidad'))
      : T('c.nav.voluntariado');

    var html =
      '<div class="lateral__ficha">' +
      avatar(estado.perfil.photo_url, titulo) +
      '<span class="lateral__nombre"><span title="' + escapar(titulo) + '">' + escapar(titulo) + '</span>' +
      '<small>' + escapar(pie) + '</small></span>' +
      '</div>' +
      '<nav class="lateral__navegacion" aria-label="' + escapar(T('c.nav.aria')) + '">';

    grupos.forEach(function (grupo) {
      html +=
        '<div class="lateral__grupo">' +
        '<p class="lateral__titulo">' + escapar(T(grupo.titulo)) + '</p>' +
        '<ul class="lateral__lista">';

      grupo.entradas.forEach(function (e) {
        var aqui = e.clave === activa;
        html +=
          '<li><a class="lateral__enlace" href="' + e.href + '"' +
          (aqui ? ' aria-current="page"' : '') + '>' +
          ICONOS[e.icono] +
          '<span class="lateral__texto">' + escapar(T(e.i18n)) + '</span>' +
          (e.cuenta
            ? '<span class="lateral__cuenta" data-cuenta="' + e.cuenta + '" hidden></span>'
            : '') +
          '</a></li>';
      });

      html += '</ul></div>';
    });

    html +=
      '</nav>' +
      '<div class="lateral__pie">' +
      (esEntidad
        ? '<a class="btn btn--ghost btn--small" href="actividad.html">' + escapar(T('c.nav.comoVoluntaria')) + '</a>'
        : '') +
      '<button class="btn btn--ghost btn--small" type="button" id="btn-salir">' +
      escapar(T('c.salir')) +
      '</button>' +
      '</div>';

    hueco.innerHTML = html;

    var salir = hueco.querySelector('#btn-salir');
    if (salir) {
      salir.addEventListener('click', function () {
        PFP.auth.signOut().then(function () {
          window.location.href = '../index.html';
        });
      });
    }
  }

  /**
   * Los numeritos del menu.
   *
   * Se piden despues de pintar y cada uno por su cuenta: son un adorno, y
   * esperar a que los tres contesten para ensenar el menu dejaria la
   * navegacion en blanco por un dato que no hace falta para navegar. Si uno
   * falla, su enlace se queda sin numerito y los otros dos siguen.
   */
  function pintarContadores(hueco, estado) {
    function poner(nombre, n) {
      var caja = hueco.querySelector('[data-cuenta="' + nombre + '"]');
      if (!caja) return;
      if (!n) {
        caja.hidden = true;
        return;
      }
      caja.textContent = n > 99 ? '99+' : String(n);
      caja.hidden = false;
    }

    PFP.db
      .rpc('my_unread')
      .then(function (filas) {
        poner('mensajes', (filas || []).reduce(function (n, f) { return n + (f.unread || 0); }, 0));
      })
      .catch(function () {});

    if (!estado.organizacion) return;

    PFP.db
      .rpc('pending_join_requests')
      .then(function (filas) {
        // La funcion devuelve las solicitudes de TODAS las entidades donde eres
        // administradora. Aqui solo interesa la que se esta mirando.
        poner('solicitudes', (filas || []).filter(function (f) {
          return f.organization_id === estado.organizacion.id;
        }).length);
      })
      .catch(function () {});

    PFP.db
      .rpc('pending_hours', { p_org: estado.organizacion.id })
      .then(function (filas) {
        poner('horas', (filas || []).length);
      })
      .catch(function () {});
  }

  /* ---------------------------------------------------------------------
     Montaje
     --------------------------------------------------------------------- */

  /**
   * Levanta la consola y devuelve el estado de la cuenta.
   *
   * La pagina que la llama recibe `{ perfil, organizacion, plan }` ya
   * cargado y se dedica solo a lo suyo: nadie vuelve a pedir el perfil.
   */
  function montar() {
    // Se va a recargar con los guiones buenos: pintar ahora solo enseñaria
    // media pantalla mal durante un instante.
    if (PFP.recargando) return new Promise(function () {});

    var ui = UI();
    if (!ui.exigirSesion || !ui.exigirSesion()) return Promise.reject(PFP.error('sin_sesion'));

    var hueco = document.getElementById('lateral');
    var activa = document.body.dataset.consola || '';

    return ui.cargarEstado().then(function (estado) {
      if (hueco) {
        pintarMenu(hueco, estado, activa);
        pintarContadores(hueco, estado);
      }
      return estado;
    });
  }

  window.PFP.consola = {
    montar: montar,
    avatar: avatar,
    iniciales: iniciales,
    escapar: escapar,
  };
})();
