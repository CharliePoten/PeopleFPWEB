/* ==========================================================================
   Mensajería
   --------------------------------------------------------------------------
   Las mismas tablas y las mismas reglas que la app. Nada de lo que hay aquí
   decide quién puede leer o escribir qué: eso lo resuelven las políticas de
   `messages` en el servidor, y esta pantalla se limita a pedir lo que le
   dejen y a enseñarlo bien.

   Cuatro clases de conversación, y todas se pintan igual:

     · `peer:<id>`        una persona. Se abre solo con alguien de tu entidad.
     · `mission:<id>`     quienes participan en una misión.
     · `help:<id>`        quien pidió ayuda y quien la aceptó.
     · `org:<id>:all`     el canal de la entidad; `:admin`, el de responsables.

   El identificador es el mismo texto que devuelve `my_conversations()` en la
   base de datos. Compartirlo con el servidor y con la app evita el clásico
   error de tener tres formas de nombrar la misma conversación.

   Sobre el sondeo: se pregunta por mensajes nuevos cada pocos segundos, y
   solo mientras la pestaña está visible. Los mensajes no van por Realtime a
   propósito —el sitio no carga dependencias externas y eso obligaría a
   traerse el SDK entero—, y el intervalo se afloja cuando no hay nadie
   mirando para no dejar una pestaña de fondo llamando al servidor toda la
   tarde.

   La excepción es «escribiendo…»: dura unos segundos y por sondeo llegaría
   siempre tarde. Va por un canal privado de Realtime con el cliente mínimo
   de `PFP.realtime`, el mismo canal que usa la app. Y cuando alguien deja de
   escribir se piden los mensajes en el momento: lo normal es que acabe de
   mandar uno.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  var UI = window.PFP_UI;
  if (!PFP || !UI) return;

  var T = UI.T;
  var $ = UI.$;
  var $$ = UI.$$;

  /* Cada cuánto se pregunta por mensajes nuevos. */
  var SONDEO_ACTIVO = 4000;
  var SONDEO_FONDO = 30000;

  /* Cuántos mensajes se traen de golpe. Suficiente para llenar la pantalla
     con margen; el resto se pide al subir. */
  var PAGINA = 40;

  /* ---------------------------------------------------------------------
     Estado
     --------------------------------------------------------------------- */

  var yo = null;            // mi id de perfil
  var hilos = [];           // conversaciones de la lista
  var abierta = null;       // id de la conversación abierta
  var mensajes = [];        // mensajes de la abierta, de más viejo a más nuevo
  var reloj = null;
  var filtro = '';
  var pestana = 'todos';   // todos | personas | grupos | solicitudes
  var solicitudes = { recibidas: [], enviadas: [] };
  var solicitudAbierta = null;
  var pegadoAbajo = true;   // ¿está el usuario mirando el final?
  var hayMas = true;        // ¿queda historia por cargar hacia arriba?
  var cargando = false;
  var miNombre = '';        // mi nombre de pila, para «Ana está escribiendo»
  var miFoto = null;        // mi foto, para mis notas de voz

  /* ---------------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------------- */

  /**
   * Escapa antes de meter nada en el HTML.
   *
   * Todo lo que se pinta aquí lo ha escrito una persona: el nombre de una
   * entidad, el cuerpo de un mensaje. Sin esto, un mensaje con `<script>`
   * dentro se ejecuta en el navegador de quien lo lee.
   */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Iniciales para el avatar cuando no hay foto. */
  function iniciales(nombre) {
    var partes = String(nombre || '?').trim().split(/\s+/);
    var a = partes[0] ? partes[0][0] : '?';
    var b = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (a + b).toUpperCase();
  }

  function idioma() {
    return document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES';
  }

  function hora(iso) {
    return new Date(iso).toLocaleTimeString(idioma(), { hour: '2-digit', minute: '2-digit' });
  }

  function mismoDia(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  /** «Hoy», «Ayer» o la fecha. Es el separador entre días. */
  function etiquetaDia(iso) {
    var d = new Date(iso);
    var hoy = new Date();
    var ayer = new Date(hoy.getTime() - 86400000);
    if (mismoDia(d, hoy)) return T('c.chat.hoy');
    if (mismoDia(d, ayer)) return T('c.chat.ayer');
    return d.toLocaleDateString(idioma(), { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * La hora en la lista de conversaciones.
   *
   * Hoy la hora, ayer «Ayer», esta semana el día, antes la fecha corta. Es
   * lo que hace que una lista de veinte se lea de un vistazo.
   */
  function horaCorta(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var hoy = new Date();
    if (mismoDia(d, hoy)) return hora(iso);
    if (mismoDia(d, new Date(hoy.getTime() - 86400000))) return T('c.chat.ayer');
    if (hoy - d < 7 * 86400000) return d.toLocaleDateString(idioma(), { weekday: 'short' });
    return d.toLocaleDateString(idioma(), { day: '2-digit', month: '2-digit' });
  }

  /**
   * Descompone el identificador de una conversación.
   *
   * Devuelve con qué columna de `messages` se filtra y con qué valor. Es la
   * misma correspondencia que usa la app; tenerla en un solo sitio evita que
   * una pantalla lea de una columna y escriba en otra.
   */
  function partes(id) {
    var t = String(id || '').split(':');
    if (t[0] === 'peer') return { clase: 'peer', otro: t[1] };
    // Soporte y asistente cuelgan de su dueño y su clase, no de una misión
    // ni de una entidad. Los dos comparten columna, por eso hace falta
    // filtrar tambien por `thread_kind`: sin eso saldrian mezclados.
    if (t[0] === 'support' || t[0] === 'assistant') {
      return { clase: 'directo', clase2: t[0], duenyo: t[1] };
    }
    if (t[0] === 'mission') return { clase: 'grupo', columna: 'mission_id', ref: t[1] };
    if (t[0] === 'help') return { clase: 'grupo', columna: 'help_request_id', ref: t[1] };
    if (t[0] === 'org') {
      return {
        clase: 'grupo',
        columna: 'organization_id',
        ref: t[1],
        soloResponsables: t[2] === 'admin',
      };
    }
    return null;
  }

  /* ---------------------------------------------------------------------
     Carga de la lista
     --------------------------------------------------------------------- */

  /**
   * Trae las conversaciones: las de dos, las de grupo y los sin leer.
   *
   * Las tres a la vez y no en cadena: son independientes, y en serie son
   * tres viajes de ida y vuelta antes de poder pintar nada.
   */
  function cargarHilos() {
    // Un fallo de una de las tres no puede dejar la lista en blanco: si las
    // de dos no llegan pero las de grupo sí, se enseña lo que haya. Lo único
    // que se deja pasar es la falta de sesión, porque eso no lo arregla
    // reintentar y hay que salir a entrar.
    function tolerante(nombre) {
      return PFP.db.rpc(nombre).catch(function (e) {
        if (e && e.codigo === 'sin_sesion') throw e;
        return [];
      });
    }

    // Las solicitudes van en la misma tanda: son otra cosa que puede haber
    // llegado desde la ultima vez, y pedirlas aparte seria otro viaje.
    cargarSolicitudes().then(function () { if (pestana === 'solicitudes') pintarLista(); });

    return Promise.all([
      tolerante('my_peer_threads'),
      tolerante('my_conversations'),
      tolerante('my_unread'),
      tolerante('my_direct_threads'),
    ]).then(function (r) {
      var personas = r[0] || [];
      var grupos = r[1] || [];
      var sinLeer = {};
      (r[2] || []).forEach(function (f) {
        sinLeer[f.conversation_key] = f.unread;
      });

      var lista = [];

      personas.forEach(function (p) {
        lista.push({
          id: 'peer:' + p.peer_id,
          clase: 'peer',
          nombre: p.peer_name || T('c.chat.alguien'),
          foto: p.peer_photo || null,
          otro: p.peer_id,
          previo: p.last_body,
          previoMio: p.last_sender === yo,
          fecha: p.last_message_at,
          sinLeer: p.unread || 0,
        });
      });

      // Soporte y asistente. El titulo se pone aqui y no se usa el que
      // manda el servidor: aquel viene fijo en castellano, y en aleman
      // quedaria a medias.
      (r[3] || []).forEach(function (d) {
        var esAsistente = d.kind === 'assistant';
        lista.push({
          id: d.id,
          clase: 'directo',
          nombre: T(esAsistente ? 'c.chat.asistente' : 'c.chat.soporte'),
          subtitulo: T(esAsistente ? 'c.chat.asistenteSub' : 'c.chat.soporteSub'),
          previo: null,
          fecha: d.last_message_at,
          sinLeer: sinLeer[d.id] || 0,
        });
      });

      grupos.forEach(function (g) {
        // Una misión o una petición en la que nadie ha escrito nunca no es
        // una conversación: enseñarla aquí llenaría la lista de entradas
        // vacías que no llevan a ningún sitio. Los canales de una entidad sí
        // se enseñan vacíos —el general y el de responsables— porque son un
        // sitio fijo al que ir, no algo que ocurra.
        var esCanal = g.kind === 'organization' || g.kind === 'organization_admin';
        if (!g.last_message_at && !esCanal) return;
        lista.push({
          id: g.id,
          clase: 'grupo',
          nombre: g.title,
          subtitulo: g.subtitle,
          previo: null,
          fecha: g.last_message_at,
          sinLeer: sinLeer[g.id] || 0,
          participantes: g.participants,
        });
      });

      // Por reciente. Las que nunca han tenido un mensaje, al final.
      lista.sort(function (a, b) {
        if (!a.fecha && !b.fecha) return a.nombre.localeCompare(b.nombre);
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return new Date(b.fecha) - new Date(a.fecha);
      });

      hilos = lista;
      pintarLista();
      pintarTotal();
    });
  }

  /**
   * Solicitudes de contacto, en las dos direcciones.
   *
   * Las columnas son EXACTAMENTE las que pide la app, con el nombre de la
   * clave ajena puesto a mano: `message_requests` apunta a `profiles` por
   * dos sitios —quien pregunta y quien recibe— y sin decir por cuál,
   * PostgREST no devuelve nada.
   */
  var COLS_SOLICITUD =
    'id,from_profile,to_profile,help_request_id,mission_id,body,status,created_at,' +
    'autor:public_profiles!message_requests_from_profile_fkey(full_name,photo_url),' +
    'destino:public_profiles!message_requests_to_profile_fkey(full_name,photo_url),' +
    'help_requests(title),missions(title)';

  function cargarSolicitudes() {
    if (!yo) return Promise.resolve();

    return PFP.db
      .select(
        'message_requests',
        'select=' + encodeURIComponent(COLS_SOLICITUD) +
          '&status=eq.pending&order=created_at.desc',
      )
      .then(function (filas) {
        var recibidas = [];
        var enviadas = [];

        (filas || []).forEach(function (r) {
          var item = {
            id: r.id,
            de: r.from_profile,
            para: r.to_profile,
            nombre: (r.from_profile === yo ? r.destino : r.autor || {}).full_name || T('c.chat.alguien'),
            foto: ((r.from_profile === yo ? r.destino : r.autor) || {}).photo_url || null,
            asunto: (r.help_requests && r.help_requests.title) ||
                    (r.missions && r.missions.title) || '',
            cuerpo: r.body,
            fecha: r.created_at,
          };
          // La política de lectura deja ver también las propias; se separan
          // aquí en vez de pedirlas dos veces.
          if (r.to_profile === yo) recibidas.push(item);
          else if (r.from_profile === yo) enviadas.push(item);
        });

        solicitudes = { recibidas: recibidas, enviadas: enviadas };
        pintarPestanas();
      })
      .catch(function (e) {
        if (e && e.codigo === 'sin_sesion') throw e;
        // Que fallen las solicitudes no puede dejar sin mensajes a nadie.
      });
  }

  /** El numerito de la pestaña de solicitudes: solo las que esperan respuesta. */
  function pintarPestanas() {
    var b = $('.chat__tabs [data-tab="solicitudes"]');
    if (!b) return;
    var n = solicitudes.recibidas.length;
    b.textContent = T('c.chat.fSolicitudes') + (n ? ' (' + n + ')' : '');
    b.setAttribute('data-pendientes', n ? 'true' : 'false');
  }

  /**
   * Cuántos sin leer en total, en el título de la pestaña.
   *
   * Es lo que hace que se vea que ha llegado algo con la pestaña de fondo,
   * que es donde va a estar la mitad del tiempo.
   */
  function pintarTotal() {
    var total = hilos.reduce(function (n, h) {
      return n + (h.sinLeer || 0);
    }, 0);
    document.title =
      (total > 0 ? '(' + (total > 99 ? '99+' : total) + ') ' : '') +
      T('c.chat.titulo') + ' — PeopleForPeople';
  }

  /* ---------------------------------------------------------------------
     Pintado de la lista
     --------------------------------------------------------------------- */

  function avatarHTML(h) {
    if (h.clase === 'directo') {
      return '<span class="chat__av chat__av--directo" aria-hidden="true">' +
        (h.id.indexOf('assistant:') === 0 ? '✦' : '?') + '</span>';
    }
    if (h.clase === 'grupo') {
      return '<span class="chat__av chat__av--grupo" aria-hidden="true">' +
        esc(iniciales(h.nombre)) + '</span>';
    }
    if (h.foto) {
      return '<span class="chat__av"><img src="' + esc(h.foto) + '" alt="" loading="lazy" /></span>';
    }
    return '<span class="chat__av" aria-hidden="true">' + esc(iniciales(h.nombre)) + '</span>';
  }

  function pintarLista() {
    var caja = $('#chat-hilos');
    if (!caja) return;

    // El buscador filtra conversaciones; en solicitudes no tiene nada que
    // filtrar. Se decide aqui y no en el clic de la pestaña porque tambien
    // se cambia de pestaña por codigo —al aceptar una solicitud— y alli se
    // quedaba escondido para siempre.
    var buscador = $('.chat__buscar');
    if (buscador) buscador.hidden = pestana === 'solicitudes';

    if (pestana === 'solicitudes') return pintarSolicitudes(caja);

    var q = filtro.trim().toLowerCase();
    var visibles = hilos.filter(function (h) {
      if (pestana === 'personas' && h.clase !== 'peer') return false;
      // Soporte y asistente no son una persona con la que hablas: son un
      // canal. Van con los grupos, que es donde se buscan.
      if (pestana === 'grupos' && h.clase === 'peer') return false;
      if (!q) return true;
      return (h.nombre + ' ' + (h.subtitulo || '')).toLowerCase().indexOf(q) !== -1;
    });

    if (visibles.length === 0) {
      caja.innerHTML =
        '<p class="chat__vacio">' + esc(q ? T('c.chat.sinResultados') : T('c.chat.sinHilos')) + '</p>';
      return;
    }

    // Sin cabeceras de sección: la lista va por reciente, así que personas y
    // grupos se entremezclan y una cabecera por cada cambio saldría cuatro
    // veces. Para separarlos están las pestañas de arriba.
    var html = '';

    visibles.forEach(function (h) {
      var previo = h.previo
        ? (h.previoMio ? T('c.chat.tu') + ' ' : '') + h.previo
        : h.subtitulo || '';

      html +=
        '<button class="chat__hilo" type="button" role="option"' +
        ' data-id="' + esc(h.id) + '"' +
        ' data-sinleer="' + (h.sinLeer > 0 ? 'true' : 'false') + '"' +
        ' aria-current="' + (h.id === abierta ? 'true' : 'false') + '">' +
        avatarHTML(h) +
        '<span class="chat__hiloCuerpo">' +
        '<span class="chat__hiloTop">' +
        '<span class="chat__hiloNombre">' + esc(h.nombre) + '</span>' +
        '<span class="chat__hiloHora">' + esc(horaCorta(h.fecha)) + '</span>' +
        '</span>' +
        '<span class="chat__hiloPrev">' +
        '<span class="chat__hiloTexto">' + esc(previo) + '</span>' +
        (h.sinLeer > 0
          ? '<span class="chat__badge" aria-label="' +
            esc(T('c.chat.sinLeerN').replace('{n}', h.sinLeer)) +
            '">' + (h.sinLeer > 99 ? '99+' : h.sinLeer) + '</span>'
          : '') +
        '</span>' +
        '</span>' +
        '</button>';
    });

    caja.innerHTML = html;
  }

  function filaSolicitud(sol, enviada) {
    return (
      '<button class="chat__hilo" type="button" role="option"' +
      ' data-solicitud="' + esc(sol.id) + '"' +
      ' aria-current="' + (sol.id === solicitudAbierta ? 'true' : 'false') + '">' +
      (sol.foto
        ? '<span class="chat__av"><img src="' + esc(sol.foto) + '" alt="" loading="lazy" /></span>'
        : '<span class="chat__av" aria-hidden="true">' + esc(iniciales(sol.nombre)) + '</span>') +
      '<span class="chat__hiloCuerpo">' +
      '<span class="chat__hiloTop">' +
      '<span class="chat__hiloNombre">' + esc(sol.nombre) + '</span>' +
      '<span class="chat__hiloHora">' + esc(horaCorta(sol.fecha)) + '</span>' +
      '</span>' +
      '<span class="chat__hiloPrev">' +
      '<span class="chat__hiloTexto">' +
      (enviada ? esc(T('c.chat.solEnviadaPref')) + ' ' : '') + esc(sol.cuerpo) +
      '</span>' +
      (enviada ? '' : '<span class="chat__badge">1</span>') +
      '</span></span></button>'
    );
  }

  function pintarSolicitudes(caja) {
    var r = solicitudes.recibidas;
    var e = solicitudes.enviadas;

    if (r.length === 0 && e.length === 0) {
      caja.innerHTML = '<p class="chat__vacio">' + esc(T('c.chat.sinSolicitudes')) + '</p>';
      return;
    }

    var html = '';
    if (r.length) {
      html += '<p class="chat__grupo">' + esc(T('c.chat.solRecibidas')) + '</p>';
      r.forEach(function (s) { html += filaSolicitud(s, false); });
    }
    if (e.length) {
      html += '<p class="chat__grupo">' + esc(T('c.chat.solEnviadas')) + '</p>';
      e.forEach(function (s) { html += filaSolicitud(s, true); });
    }
    caja.innerHTML = html;
  }

  /** Busca una solicitud por id en cualquiera de las dos listas. */
  function buscarSolicitud(id) {
    var todas = solicitudes.recibidas.concat(solicitudes.enviadas);
    for (var i = 0; i < todas.length; i++) if (todas[i].id === id) return todas[i];
    return null;
  }

  /**
   * La ficha de una solicitud, en el panel de la derecha.
   *
   * No es una conversación: no hay campo de escribir. Hasta que se acepta no
   * existe canal, y enseñar un cajetín que no envía nada sería mentir.
   */
  function abrirSolicitud(id) {
    var sol = buscarSolicitud(id);
    if (!sol) return;

    solicitudAbierta = id;
    abierta = null;
    var recibida = sol.para === yo;

    $('#chat').setAttribute('data-vista', 'conversacion');
    $('#chat-nada').hidden = true;
    $('#chat-conv').hidden = false;
    $('#chat-cab-nombre').textContent = sol.nombre;
    $('#chat-cab-sub').textContent = recibida
      ? T('c.chat.solRecibidaSub')
      : T('c.chat.solEnviadaSub');

    var caja = $('#chat-mensajes');
    caja.innerHTML =
      (sol.asunto
        ? '<p class="chat__dia">' + esc(T('c.chat.solSobre').replace('{asunto}', sol.asunto)) + '</p>'
        : '') +
      '<div class="chat__msg' + (recibida ? '' : ' chat__msg--mio') + ' chat__msg--primero">' +
      esc(sol.cuerpo).replace(/\n/g, '<br />') +
      '<span class="chat__pie">' + esc(hora(sol.fecha)) + '</span></div>' +
      (recibida
        ? '<div class="chat__solAcciones">' +
          '<button class="chat__solBtn chat__solBtn--si" type="button" data-aceptar="' + esc(sol.id) + '">' +
          esc(T('c.chat.solAceptar')) + '</button>' +
          '<button class="chat__solBtn" type="button" data-rechazar="' + esc(sol.id) + '">' +
          esc(T('c.chat.solRechazar')) + '</button>' +
          '<p class="chat__solNota">' + esc(T('c.chat.solNota')) + '</p>' +
          '</div>'
        : '<p class="chat__solNota">' + esc(T('c.chat.solEsperando')) + '</p>');

    // Sin campo de escribir: todavia no hay conversacion.
    $('.chat__escribir').hidden = true;
    pintarLista();
  }

  /** Acepta: el servidor abre la conversacion y mete dentro el mensaje. */
  function aceptarSolicitud(id) {
    var b = $('[data-aceptar="' + id + '"]');
    if (b) { b.disabled = true; b.textContent = T('c.espera'); }

    PFP.db
      .rpc('accept_message_request', { request_id: id })
      .then(function () {
        solicitudAbierta = null;
        $('.chat__escribir').hidden = false;
        // La conversacion nueva ya existe: se recarga todo y se cambia a la
        // pestaña donde ahora vive.
        return Promise.all([cargarSolicitudes(), cargarHilos()]).then(function () {
          pestana = 'todos';
          $$('.chat__tabs button').forEach(function (o) {
            o.setAttribute('aria-selected', String(o.dataset.tab === 'todos'));
          });
          pintarLista();
          cerrarPanel();
        });
      })
      .catch(function (e) {
        if (b) { b.disabled = false; b.textContent = T('c.chat.solAceptar'); }
        UI.avisar('aviso', UI.explicar(e));
      });
  }

  function rechazarSolicitud(id) {
    var b = $('[data-rechazar="' + id + '"]');
    if (b) { b.disabled = true; b.textContent = T('c.espera'); }

    PFP.db
      .update('message_requests', 'id=eq.' + encodeURIComponent(id), {
        status: 'declined',
        resolved_at: new Date().toISOString(),
      })
      .then(function () {
        solicitudAbierta = null;
        return cargarSolicitudes().then(function () {
          pintarLista();
          cerrarPanel();
        });
      })
      .catch(function (e) {
        if (b) { b.disabled = false; b.textContent = T('c.chat.solRechazar'); }
        UI.avisar('aviso', UI.explicar(e));
      });
  }

  /** Deja el panel derecho como al entrar. */
  function cerrarPanel() {
    cerrarEscribiendo();
    pararNota();
    abierta = null;
    solicitudAbierta = null;
    $('#chat-conv').hidden = true;
    $('#chat-nada').hidden = false;
    $('.chat__escribir').hidden = false;
    $('#chat').setAttribute('data-vista', 'lista');
  }

  /* ---------------------------------------------------------------------
     Abrir una conversación
     --------------------------------------------------------------------- */

  function hiloActual() {
    for (var i = 0; i < hilos.length; i++) if (hilos[i].id === abierta) return hilos[i];
    return null;
  }

  function abrir(id) {
    // Lo que sonaba era de la conversación anterior.
    if (id !== abierta) pararNota();
    abierta = id;
    solicitudAbierta = null;
    // Puede venir de una solicitud, que lo esconde.
    var escribir = $('.chat__escribir');
    if (escribir) escribir.hidden = false;
    mensajes = [];
    hayMas = true;
    pegadoAbajo = true;
    $('#chat').setAttribute('data-vista', 'conversacion');

    var h = hiloActual();
    $('#chat-cab-nombre').textContent = h ? h.nombre : '';
    $('#chat-cab-sub').textContent = h
      ? h.clase === 'grupo'
        ? h.subtitulo || T('c.chat.nPersonas').replace('{n}', h.participantes || 0)
        : T('c.chat.persona')
      : '';
    $('#chat-nada').hidden = true;
    $('#chat-conv').hidden = false;

    abrirEscribiendo(id);
    pintarLista();
    return cargarMensajes(true);
  }

  /**
   * Trae mensajes.
   *
   * `reinicio` a true cuando se abre la conversación; a false cuando se pide
   * historia hacia atrás al llegar arriba del todo.
   */
  function cargarMensajes(reinicio) {
    var p = partes(abierta);
    if (!p) return Promise.resolve();

    var antes = reinicio || mensajes.length === 0 ? null : mensajes[0].sent_at;
    cargando = true;

    var peticion;
    if (p.clase === 'peer') {
      peticion = PFP.db.rpc('peer_messages', {
        p_other: p.otro,
        p_before: antes,
        p_limit: PAGINA,
      });
    } else if (p.clase === 'directo') {
      peticion = pedirConVoz(function (cols) {
        var qd =
          'select=id,sender_id,kind,body,sent_at' + cols +
          '&thread_owner=eq.' + encodeURIComponent(p.duenyo) +
          '&thread_kind=eq.' + encodeURIComponent(p.clase2) +
          '&order=sent_at.desc&limit=' + PAGINA;
        if (antes) qd += '&sent_at=lt.' + encodeURIComponent(antes);
        return PFP.db.select('messages', qd);
      });
    } else {
      peticion = pedirConVoz(function (cols) {
        var q =
          'select=id,sender_id,kind,body,sent_at' + cols +
          ',public_profiles!messages_sender_id_fkey!inner(full_name)' +
          '&' + p.columna + '=eq.' + encodeURIComponent(p.ref) +
          '&order=sent_at.desc&limit=' + PAGINA;
        if (p.columna === 'organization_id') {
          q += '&admin_only=is.' + (p.soloResponsables ? 'true' : 'false');
        }
        if (antes) q += '&sent_at=lt.' + encodeURIComponent(antes);
        return PFP.db.select('messages', q);
      });
    }

    return peticion
      .then(function (filas) {
        cargando = false;
        var nuevos = (filas || []).slice().reverse(); // del servidor vienen del más nuevo al más viejo
        if (nuevos.length < PAGINA) hayMas = false;

        nuevos.forEach(function (m) {
          if (m.public_profiles) m.autor = m.public_profiles.full_name;
        });

        if (reinicio) {
          mensajes = nuevos;
        } else {
          var tengo = {};
          mensajes.forEach(function (m) { tengo[m.id] = true; });
          mensajes = nuevos.filter(function (m) { return !tengo[m.id]; }).concat(mensajes);
        }

        pintarMensajes(reinicio);
        marcarLeida();
        refrescarEscuchas(false);
      })
      .catch(function (e) {
        cargando = false;
        UI.avisar('aviso', UI.explicar(e));
      });
  }

  /** Dice al servidor que lo he leído hasta ahora, y apaga el numerito. */
  function marcarLeida() {
    var h = hiloActual();
    if (!h || !h.sinLeer) return;
    h.sinLeer = 0;
    pintarLista();
    pintarTotal();
    PFP.db.rpc('mark_conversation_read', { p_key: abierta }).catch(function () {});
  }

  /* ---------------------------------------------------------------------
     Pintado de los mensajes
     --------------------------------------------------------------------- */

  function pintarMensajes(alFinal) {
    var caja = $('#chat-mensajes');
    if (!caja) return;

    // Se guarda para poder conservar la posición al añadir historia arriba:
    // sin esto, cargar mensajes viejos te arranca de donde estabas leyendo.
    var altoAntes = caja.scrollHeight;
    var arribaAntes = caja.scrollTop;

    if (mensajes.length === 0) {
      caja.innerHTML =
        '<p class="chat__vacio">' + esc(T('c.chat.conversacionVacia')) + '</p>';
      return;
    }

    var html = hayMas
      ? '<button class="chat__cargarMas" type="button" id="chat-mas">' +
        esc(T('c.chat.cargarMas')) + '</button>'
      : '';

    var diaPrevio = null;
    var autorPrevio = null;

    mensajes.forEach(function (m) {
      var dia = etiquetaDia(m.sent_at);
      if (dia !== diaPrevio) {
        html += '<p class="chat__dia">' + esc(dia) + '</p>';
        diaPrevio = dia;
        autorPrevio = null;
      }

      var mio = m.sender_id === yo;
      var sigue = autorPrevio === m.sender_id;
      autorPrevio = m.sender_id;

      var clases = 'chat__msg' + (mio ? ' chat__msg--mio' : '') + (metaVoz(m) ? ' chat__msg--voz' : '');
      clases += sigue ? ' chat__msg--sigue' : ' chat__msg--primero';

      var estado = '';
      if (mio) {
        if (m.enviando) estado = '<span class="chat__estado" title="' + esc(T('c.chat.enviando')) + '">◷</span>';
        else if (m.fallo) estado = '<span class="chat__estado chat__estado--error" title="' + esc(T('c.chat.noEnviado')) + '">!</span>';
        else estado = '<span class="chat__estado" aria-hidden="true">✓</span>';
      }

      html +=
        '<div class="' + clases + '">' +
        // El nombre solo en el primero de una tanda, y nunca en los propios.
        (!mio && !sigue && m.autor
          ? '<span class="chat__autor">' + esc(m.autor) + '</span>'
          : '') +
        cuerpoHTML(m) +
        '<span class="chat__pie">' + esc(hora(m.sent_at)) + estado + '</span>' +
        '</div>';
    });

    // Debajo del último: «escribiendo…», o el aviso del asistente.
    html += '<div id="chat-cola"></div>';

    caja.innerHTML = html;
    pintarCola();
    // Las notas de voz se ponen al día aparte: lo que suena no se reinicia
    // porque haya llegado un mensaje.
    pintarNotas();

    var mas = $('#chat-mas');
    if (mas) mas.addEventListener('click', function () { cargarMensajes(false); });

    if (alFinal) {
      caja.scrollTop = caja.scrollHeight;
    } else {
      // Historia añadida arriba: se compensa el alto nuevo.
      caja.scrollTop = caja.scrollHeight - altoAntes + arribaAntes;
    }
  }

  /**
   * El cuerpo de un mensaje.
   *
   * Los saltos de línea se respetan —un mensaje escrito en tres líneas se lee
   * en tres— y una ubicación se convierte en un enlace al mapa en vez de
   * enseñar unas coordenadas que no dicen nada.
   */
  function cuerpoHTML(m) {
    if (metaVoz(m)) return notaHTML(m);
    if (m.kind === 'location' && m.lat != null && m.lng != null) {
      var url = 'https://www.google.com/maps/search/?api=1&query=' + m.lat + ',' + m.lng;
      return (
        '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">📍 ' +
        esc(m.body || T('c.chat.ubicacion')) + '</a>'
      );
    }
    return esc(m.body).replace(/\n/g, '<br />');
  }

  /* ---------------------------------------------------------------------
     Notas de voz
     ---------------------------------------------------------------------
     Las graba la app. Aquí se escuchan igual que allí, que es igual que en
     WhatsApp: reproducir, la onda —lo escuchado coloreado y un punto que se
     arrastra—, la duración, y la cara de quien habla con un micrófono:
     verde si te la han mandado y no la has escuchado, azul cuando sí (en las
     tuyas, azul cuando la ha escuchado quien tenía que hacerlo). Mientras
     suena, la cara se cambia por la velocidad: 1×, 1,5×, 2×.

     Un solo <audio> para toda la página, y su estado fuera del HTML: la
     conversación se vuelve a pintar entera cada vez que llega un mensaje, y
     si el reproductor viviera en la burbuja se cortaría a media nota.
     --------------------------------------------------------------------- */

  var BARRAS_VOZ = 34;
  var VELOCIDADES = [1, 1.5, 2];
  var CLAVE_VELOCIDAD = 'pfp.velocidadVoz';
  /* Cada cuánto, como mucho, se pregunta si alguien ha escuchado lo mío. */
  var ESCUCHAS_CADA_MS = 10000;

  var ICONO_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  var ICONO_PAUSA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/></svg>';
  var ICONO_MICRO =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5.5a3.5 3.5 0 0 0-7 0V11a3.5 3.5 0 0 0 3.5 3.5zm6-3.5a6 6 0 0 1-12 0H4.5a7.5 7.5 0 0 0 6.75 7.46V21h1.5v-2.54A7.5 7.5 0 0 0 19.5 11z"/></svg>';

  var voz = {
    audio: null,
    id: null,          // la nota cargada en el reproductor
    cargando: false,
    pos: {},           // dónde se quedó cada nota que no suena, en ms
    firmas: {},        // ruta → { url, hasta }: firmar cada vez retrasa el play
    velocidad: leerVelocidad(),
    escuchas: {},      // id → { yo: bool, otros: n }
    escuchasDesde: 0,  // cuándo se preguntó por última vez
    escuchasPausa: 0,  // sin la 0060 en el servidor, se deja de preguntar un rato
    arrastre: null,    // { id, fraccion } mientras se arrastra el punto
    bucle: 0,
  };

  function leerVelocidad() {
    try {
      var v = Number(window.localStorage.getItem(CLAVE_VELOCIDAD));
      return VELOCIDADES.indexOf(v) >= 0 ? v : 1;
    } catch (e) {
      return 1;
    }
  }

  /** Duración y onda, o null si el mensaje no es una nota de voz. */
  function metaVoz(m) {
    var meta = m && m.attachment_meta;
    if (!meta || meta.voice !== true || !m.attachment_path || m.kind !== 'audio') return null;
    return {
      ms: Number(meta.duration_ms) || 0,
      onda: Array.isArray(meta.waveform) ? meta.waveform : [],
    };
  }

  /** «0:07», «1:23», «12:05». */
  function duracion(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var seg = s % 60;
    return Math.floor(s / 60) + ':' + (seg < 10 ? '0' : '') + seg;
  }

  function etiquetaVelocidad(v) {
    return String(v).replace('.', ',') + '×';
  }

  /** Las 64 barras guardadas, reducidas a las que caben: el pico de cada tramo. */
  function reducirOnda(onda, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var desde = Math.floor((i * onda.length) / n);
      var hasta = Math.max(desde + 1, Math.floor(((i + 1) * onda.length) / n));
      var pico = 0;
      for (var j = desde; j < hasta && j < onda.length; j++) if (onda[j] > pico) pico = onda[j];
      out.push(pico);
    }
    var max = Math.max.apply(null, out.concat([0]));
    return out.map(function (v) { return max > 0 ? Math.round((v / max) * 100) : 0; });
  }

  function buscarMensaje(id) {
    for (var i = 0; i < mensajes.length; i++) if (mensajes[i].id === id) return mensajes[i];
    return null;
  }

  /** Cuántas personas tienen que escuchar una nota mía para que salga en azul. */
  function oyentesNecesarios() {
    var h = hiloActual();
    if (h && h.clase === 'grupo') return Math.max(1, (h.participantes || 2) - 1);
    return 1;
  }

  function notaHTML(m) {
    var meta = metaVoz(m);
    var mio = m.sender_id === yo;
    var h = hiloActual();
    var nombre = mio ? miNombre : m.autor || (h && h.nombre) || '';
    var foto = mio ? miFoto : h && h.clase === 'peer' ? h.foto : null;

    var barras = reducirOnda(meta.onda, BARRAS_VOZ)
      .map(function (v) {
        return '<span class="voz__barra" style="height:' + (12 + v * 0.88).toFixed(0) + '%"></span>';
      })
      .join('');

    return (
      '<div class="voz" data-voz="' + esc(m.id) + '">' +
      '<button type="button" class="voz__play" data-voz-accion="play"></button>' +
      '<div class="voz__centro">' +
      '<div class="voz__onda" data-voz-accion="ir" role="slider" tabindex="0"' +
      ' aria-label="' + esc(T('c.chat.vozNota')) + '" aria-valuemin="0"' +
      ' aria-valuemax="' + Math.round(meta.ms / 1000) + '">' +
      barras +
      '<span class="voz__punto" aria-hidden="true"></span>' +
      '</div>' +
      '<span class="voz__tiempo"></span>' +
      '</div>' +
      '<span class="voz__lado">' +
      '<span class="voz__cara" aria-hidden="true">' +
      (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy" />' : esc(iniciales(nombre))) +
      '<span class="voz__micro">' + ICONO_MICRO + '</span>' +
      '</span>' +
      '<button type="button" class="voz__velocidad" data-voz-accion="velocidad"></button>' +
      '</span>' +
      '</div>'
    );
  }

  /** Pone una burbuja al día sin volver a pintarla: se llama en cada fotograma mientras suena. */
  function pintarNota(id) {
    var el = document.querySelector('.voz[data-voz="' + CSS.escape(id) + '"]');
    var m = buscarMensaje(id);
    var meta = metaVoz(m);
    if (!el || !meta) return;

    var a = voz.audio;
    var activa = voz.id === id;
    var sonando = activa && a && !a.paused;
    var dur = meta.ms;
    var pos = activa && a ? a.currentTime * 1000 : voz.pos[id] || 0;
    if (voz.arrastre && voz.arrastre.id === id) pos = voz.arrastre.fraccion * dur;
    var progreso = dur > 0 ? Math.min(1, Math.max(0, pos / dur)) : 0;
    var enMarcha = activa || pos > 0 || (voz.arrastre && voz.arrastre.id === id);

    el.classList.toggle('voz--activa', activa);
    el.classList.toggle('voz--cargando', activa && voz.cargando);

    var play = el.querySelector('.voz__play');
    var icono = sonando ? 'pausa' : 'play';
    if (play.dataset.icono !== icono) {
      play.innerHTML = sonando ? ICONO_PAUSA : ICONO_PLAY;
      play.dataset.icono = icono;
    }
    // El micrófono: verde sin escuchar, azul escuchada. Sin saberlo aún
    // (o sin la 0060 en el servidor), el color de siempre.
    var mio = m.sender_id === yo;
    var e = voz.escuchas[id];
    var escuchada = e ? (mio ? e.otros >= oyentesNecesarios() : e.yo) : false;
    var micro = el.querySelector('.voz__micro');
    micro.classList.toggle('voz__micro--escuchada', escuchada);
    micro.classList.toggle('voz__micro--nueva', !mio && !!e && !e.yo);

    play.setAttribute(
      'aria-label',
      (sonando ? T('c.chat.vozPausar') : T('c.chat.vozReproducir').replace('{d}', duracion(dur))) +
        (escuchada ? '. ' + T('c.chat.vozEscuchada') : ''),
    );

    var barras = el.querySelectorAll('.voz__barra');
    for (var i = 0; i < barras.length; i++) {
      barras[i].classList.toggle('voz__barra--hecha', !!enMarcha && (i + 0.5) / barras.length <= progreso);
    }
    el.querySelector('.voz__punto').style.left = (progreso * 100).toFixed(2) + '%';
    el.querySelector('.voz__tiempo').textContent = duracion(enMarcha ? pos : dur);
    var onda = el.querySelector('.voz__onda');
    onda.setAttribute('aria-valuenow', String(Math.round(pos / 1000)));
    onda.setAttribute('aria-valuetext', duracion(pos));

    var vel = el.querySelector('.voz__velocidad');
    vel.textContent = etiquetaVelocidad(voz.velocidad);
    vel.setAttribute('aria-label', T('c.chat.vozVelocidad').replace('{v}', etiquetaVelocidad(voz.velocidad)));
  }

  function pintarNotas() {
    mensajes.forEach(function (m) { if (metaVoz(m)) pintarNota(m.id); });
  }

  function elAudio() {
    if (voz.audio) return voz.audio;
    var a = new Audio();
    a.preload = 'auto';

    a.addEventListener('playing', function () {
      voz.cargando = false;
      var m = buscarMensaje(voz.id);
      // Empezar a escucharla cuenta como escuchada, como en WhatsApp.
      if (m && m.sender_id !== yo) marcarEscuchada(m.id);
      seguirBucle();
    });
    a.addEventListener('pause', function () { if (voz.id) pintarNota(voz.id); });
    a.addEventListener('waiting', function () {
      voz.cargando = true;
      if (voz.id) pintarNota(voz.id);
    });
    a.addEventListener('ended', function () {
      var id = voz.id;
      voz.id = null;
      delete voz.pos[id];
      pintarNota(id);
      // Si justo detrás va otra nota de la misma persona, empieza sola,
      // como en WhatsApp. De otra persona no: una respuesta tuya no se pone
      // a sonar porque acabe la nota a la que contestaba.
      var acabada = buscarMensaje(id);
      var i = mensajes.indexOf(acabada);
      var sig = i >= 0 ? mensajes[i + 1] : null;
      if (sig && metaVoz(sig) && sig.sender_id === acabada.sender_id) reproducirNota(sig, 0);
    });
    a.addEventListener('error', function () {
      if (!voz.id || !a.getAttribute('src')) return;
      var id = voz.id;
      voz.id = null;
      voz.cargando = false;
      pintarNota(id);
      UI.avisar('aviso', T('c.chat.vozError'));
    });

    voz.audio = a;
    return a;
  }

  /** Mientras suena, la burbuja se mueve con el sonido; parada, no gasta nada. */
  function seguirBucle() {
    if (voz.bucle) return;
    var paso = function () {
      voz.bucle = 0;
      if (!voz.id) return;
      pintarNota(voz.id);
      if (voz.audio && !voz.audio.paused) voz.bucle = window.requestAnimationFrame(paso);
    };
    voz.bucle = window.requestAnimationFrame(paso);
  }

  function firmarNota(ruta) {
    var f = voz.firmas[ruta];
    if (f && f.hasta > Date.now()) return Promise.resolve(f.url);
    return PFP.almacen.firmar('chat-attachments', ruta, 3600).then(function (url) {
      // Se da por caducada antes que el servidor: una que vence a mitad de
      // una nota larga cortaría la descarga.
      voz.firmas[ruta] = { url: url, hasta: Date.now() + 50 * 60000 };
      return url;
    });
  }

  function reproducirNota(m, desdeMs) {
    var a = elAudio();
    var anterior = voz.id;
    // La que sonaba se queda donde estaba, como en WhatsApp.
    if (anterior && anterior !== m.id) {
      voz.pos[anterior] = a.currentTime * 1000;
      a.pause();
    }
    voz.id = m.id;
    voz.cargando = true;
    delete voz.pos[m.id];
    if (anterior && anterior !== m.id) pintarNota(anterior);
    pintarNota(m.id);

    firmarNota(m.attachment_path)
      .then(function (url) {
        if (voz.id !== m.id) return;
        a.src = url;
        a.defaultPlaybackRate = voz.velocidad;
        a.playbackRate = voz.velocidad;
        if (desdeMs > 0) {
          a.addEventListener('loadedmetadata', function una() {
            a.removeEventListener('loadedmetadata', una);
            a.currentTime = desdeMs / 1000;
          });
        }
        return a.play();
      })
      .catch(function (e) {
        if (voz.id !== m.id) return;
        voz.id = null;
        voz.cargando = false;
        pintarNota(m.id);
        // Que el navegador no deje sonar sin un clic no es un error de la nota.
        if (!e || e.name !== 'NotAllowedError') UI.avisar('aviso', T('c.chat.vozError'));
      });
  }

  function alternarNota(id) {
    var m = buscarMensaje(id);
    if (!m || !metaVoz(m)) return;
    var a = elAudio();
    if (voz.id === id) {
      if (a.paused) {
        a.playbackRate = voz.velocidad;
        a.play().catch(function () {});
      } else {
        a.pause();
      }
      pintarNota(id);
      return;
    }
    reproducirNota(m, voz.pos[id] || 0);
  }

  /** Ir a un punto de la nota, suene o no. */
  function irEnNota(id, ms) {
    var m = buscarMensaje(id);
    var meta = metaVoz(m);
    if (!meta) return;
    var destino = Math.max(0, Math.min(meta.ms, ms));
    if (voz.id === id && voz.audio) voz.audio.currentTime = destino / 1000;
    else voz.pos[id] = destino;
    pintarNota(id);
  }

  function cambiarVelocidad() {
    var i = VELOCIDADES.indexOf(voz.velocidad);
    voz.velocidad = VELOCIDADES[(i + 1) % VELOCIDADES.length];
    if (voz.audio) {
      voz.audio.defaultPlaybackRate = voz.velocidad;
      voz.audio.playbackRate = voz.velocidad;
    }
    try { window.localStorage.setItem(CLAVE_VELOCIDAD, String(voz.velocidad)); } catch (e) { /* sin almacenamiento, solo esta vez */ }
    if (voz.id) pintarNota(voz.id);
  }

  /** Al cambiar de conversación o cerrarla, lo que sonaba se para. */
  function pararNota() {
    if (voz.audio && !voz.audio.paused) voz.audio.pause();
    voz.id = null;
    voz.cargando = false;
  }

  function marcarEscuchada(id) {
    var e = voz.escuchas[id];
    if (e && e.yo) return;
    voz.escuchas[id] = { yo: true, otros: e ? e.otros : 0 };
    pintarNota(id);
    PFP.db.rpc('mark_voice_played', { p_message: id }).catch(function () {});
  }

  /**
   * Pregunta cómo están las notas de la conversación abierta. Con `soloMias`,
   * solo las mías que aún no ha escuchado quien tenía que hacerlo: es lo único
   * que puede cambiar sin que yo haga nada.
   */
  function refrescarEscuchas(soloMias) {
    if (Date.now() < voz.escuchasPausa) return Promise.resolve();
    var necesarios = oyentesNecesarios();
    var ids = mensajes
      .filter(function (m) {
        if (!metaVoz(m) || String(m.id).indexOf('tmp-') === 0) return false;
        if (!soloMias) return true;
        var e = voz.escuchas[m.id];
        return m.sender_id === yo && (!e || e.otros < necesarios);
      })
      .map(function (m) { return m.id; })
      .slice(-200);
    if (ids.length === 0) return Promise.resolve();

    voz.escuchasDesde = Date.now();
    return PFP.db
      .rpc('voice_play_state', { p_ids: ids })
      .then(function (filas) {
        (filas || []).forEach(function (f) {
          var antes = voz.escuchas[f.message_id];
          voz.escuchas[f.message_id] = {
            // Lo apuntado aquí no se deshace porque el servidor aún no lo tenga.
            yo: !!f.played_by_me || !!(antes && antes.yo),
            otros: Number(f.played_by_others) || 0,
          };
          pintarNota(f.message_id);
        });
      })
      .catch(function () {
        // Sin la 0060, o sin red: se vuelve a probar dentro de un minuto, no
        // en cada vuelta del sondeo.
        voz.escuchasPausa = Date.now() + 60000;
      });
  }

  /** Clics, arrastre y teclado de las notas, para toda la conversación a la vez. */
  function engancharNotas(caja) {
    caja.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-voz-accion]');
      if (!b) return;
      var nota = b.closest('.voz');
      if (!nota) return;
      var accion = b.getAttribute('data-voz-accion');
      if (accion === 'play') alternarNota(nota.dataset.voz);
      else if (accion === 'velocidad') cambiarVelocidad();
    });

    // Arrastrar el punto, o hacer clic en cualquier sitio de la onda.
    caja.addEventListener('pointerdown', function (ev) {
      var onda = ev.target.closest('.voz__onda');
      if (!onda || ev.button !== 0) return;
      var id = onda.closest('.voz').dataset.voz;
      var fraccion = function (e) {
        var r = onda.getBoundingClientRect();
        return r.width > 0 ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0;
      };
      ev.preventDefault();
      onda.setPointerCapture(ev.pointerId);
      voz.arrastre = { id: id, fraccion: fraccion(ev) };
      pintarNota(id);

      var mover = function (e) {
        voz.arrastre.fraccion = fraccion(e);
        pintarNota(id);
      };
      var soltar = function (e) {
        onda.removeEventListener('pointermove', mover);
        onda.removeEventListener('pointerup', soltar);
        onda.removeEventListener('pointercancel', soltar);
        var f = e.type === 'pointercancel' ? null : fraccion(e);
        voz.arrastre = null;
        var meta = metaVoz(buscarMensaje(id));
        if (f !== null && meta) irEnNota(id, f * meta.ms);
        else pintarNota(id);
      };
      onda.addEventListener('pointermove', mover);
      onda.addEventListener('pointerup', soltar);
      onda.addEventListener('pointercancel', soltar);
    });

    caja.addEventListener('keydown', function (ev) {
      var onda = ev.target.closest && ev.target.closest('.voz__onda');
      if (!onda) return;
      var id = onda.closest('.voz').dataset.voz;
      var meta = metaVoz(buscarMensaje(id));
      if (!meta) return;
      var ahora = voz.id === id && voz.audio ? voz.audio.currentTime * 1000 : voz.pos[id] || 0;
      var destino = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') destino = ahora + 5000;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') destino = ahora - 5000;
      else if (ev.key === 'Home') destino = 0;
      else if (ev.key === 'End') destino = meta.ms;
      else if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        alternarNota(id);
        return;
      }
      if (destino === null) return;
      ev.preventDefault();
      irEnNota(id, destino);
    });
  }

  /**
   * Las columnas de las notas se piden solo si el servidor las tiene: sin la
   * 0059, pedir `attachment_meta` tumbaba la conversación entera. Se intenta
   * con ellas y, si la base no la conoce, se sigue sin ellas.
   */
  var columnasVoz = ',attachment_path,attachment_meta';
  function pedirConVoz(hacer) {
    return hacer(columnasVoz).catch(function (e) {
      var texto = (e && (e.detalle || e.message)) || '';
      if (columnasVoz.indexOf('attachment_meta') >= 0 && /attachment_meta/.test(texto)) {
        columnasVoz = ',attachment_path';
        return hacer(columnasVoz);
      }
      throw e;
    });
  }

  /* ---------------------------------------------------------------------
     Enviar
     --------------------------------------------------------------------- */

  function enviar() {
    var campo = $('#chat-texto');
    var texto = campo.value.trim();
    if (!texto || !abierta) return;

    var p = partes(abierta);
    if (!p) return;

    // Aparece en pantalla antes de que el servidor conteste. Es lo que hace
    // que la conversación se sienta viva; el reloj de al lado dice que
    // todavía va en camino, y si falla se marca en vez de desaparecer.
    var provisional = {
      id: 'tmp-' + Date.now(),
      sender_id: yo,
      body: texto,
      kind: 'text',
      sent_at: new Date().toISOString(),
      enviando: true,
    };
    mensajes.push(provisional);
    campo.value = '';
    ajustarAlto(campo);
    avisarEscribiendo(false);
    pegadoAbajo = true;
    pintarMensajes(true);

    var envio;
    if (p.clase === 'peer') {
      envio = PFP.db.rpc('send_peer_message', { p_other: p.otro, p_body: texto });
    } else if (p.clase === 'directo') {
      envio = PFP.db
        .insert(
          'messages',
          {
            sender_id: yo,
            thread_owner: p.duenyo,
            thread_kind: p.clase2,
            body: texto,
            kind: 'text',
          },
          true,
        )
        .then(function (r) {
          // Al asistente hay que despertarlo: es quien contesta. Si falla, el
          // mensaje ya esta guardado y se puede reintentar; por eso el error
          // no tumba el envio: lo dice el aviso con «Volver a intentarlo».
          if (p.clase2 === 'assistant') {
            var guardado = Array.isArray(r) ? r[0] : r;
            if (guardado && guardado.sent_at) provisional.sent_at = guardado.sent_at;
            provisional.enviando = false;
            pedirAsistente();
          }
          return r;
        });
    } else {
      /* `sender_id` va explicito: la columna no tiene valor por defecto y la
         politica de escritura exige que sea quien firma la sesion. Sin el, el
         servidor responde «new row violates row-level security policy», que
         suena a permisos y en realidad era una columna sin rellenar. */
      var fila = { sender_id: yo, body: texto, kind: 'text' };
      fila[p.columna] = p.ref;
      if (p.columna === 'organization_id') fila.admin_only = !!p.soloResponsables;
      envio = PFP.db.insert('messages', fila, true);
    }

    envio
      .then(function (r) {
        var guardado = Array.isArray(r) ? r[0] : r;
        provisional.enviando = false;
        if (guardado && guardado.id) provisional.id = guardado.id;
        if (guardado && guardado.sent_at) provisional.sent_at = guardado.sent_at;
        pintarMensajes(true);
        refrescarPrevio(texto);
      })
      .catch(function (e) {
        provisional.enviando = false;
        provisional.fallo = true;
        pintarMensajes(true);
        UI.avisar('aviso', UI.explicar(e));
      });
  }

  /** Deja la conversación arriba de la lista con el texto recién enviado. */
  function refrescarPrevio(texto) {
    var h = hiloActual();
    if (!h) return;
    h.previo = texto;
    h.previoMio = true;
    h.fecha = new Date().toISOString();
    hilos.sort(function (a, b) {
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return new Date(b.fecha) - new Date(a.fecha);
    });
    pintarLista();
  }

  /** El campo crece con el texto, hasta el tope que pone el CSS. */
  function ajustarAlto(campo) {
    campo.style.height = 'auto';
    campo.style.height = Math.min(campo.scrollHeight, 144) + 'px';
  }

  /* ---------------------------------------------------------------------
     «Escribiendo…» y el asistente
     --------------------------------------------------------------------- */

  /* Cuánto dura un «escribiendo» sin un aviso nuevo, por si se cae la red a
     media frase; y cada cuánto, como mucho, se repite el mío. Los mismos
     que en la app. */
  var CADUCA_MS = 6000;
  var CADA_MS = 2500;

  /* Cuánto se espera al asistente. Su función se rinde con Google a los 30 s
     y deja su propio aviso; si a los 60 no hay nada, no ha podido ni
     escribir, y el aviso lo pone esta pantalla. */
  var ESPERA_ASISTENTE_MS = 60000;

  var canalEscribiendo = null;
  var escribiendo = {};     // id → { nombre, hasta }
  var ultimoAviso = 0;      // cuándo avisé de que escribo; 0 si no hay aviso vivo
  var relojCola = null;
  var asistente = { pedidoEn: null, falloEn: null };

  /**
   * El canal de «escribiendo» de una conversación, o null si no tiene.
   *
   * El mismo nombre que en la app y que entiende la regla del servidor. La
   * de dos se llama distinto para cada uno —`peer:<la otra persona>`—, así que
   * su canal lleva la pareja ordenada. El hilo del asistente no tiene.
   */
  function temaEscribiendo(id) {
    var t = String(id || '').split(':');
    if (!t[1] || !yo) return null;
    if (t[0] === 'peer') {
      if (t[1] === yo) return null;
      var par = [yo, t[1]].sort();
      return 'typing:peer:' + par[0] + ':' + par[1];
    }
    if (t[0] === 'mission' || t[0] === 'help' || t[0] === 'support') return 'typing:' + t[0] + ':' + t[1];
    if (t[0] === 'org') return 'typing:org:' + t[1] + ':' + (t[2] === 'admin' ? 'admin' : 'all');
    return null;
  }

  function abrirEscribiendo(id) {
    cerrarEscribiendo();
    var tema = temaEscribiendo(id);
    if (!tema || !PFP.realtime) return;

    canalEscribiendo = PFP.realtime.canal(tema, function (evento, carga) {
      if (evento !== 'typing' || typeof carga.id !== 'string' || carga.id === yo) return;
      var estaba = !!escribiendo[carga.id];
      if (carga.typing === false) {
        delete escribiendo[carga.id];
      } else {
        escribiendo[carga.id] = {
          nombre: typeof carga.name === 'string' ? carga.name.slice(0, 40) : '',
          hasta: Date.now() + CADUCA_MS,
        };
      }
      pintarCola();
      // Al dejar de escribir, lo normal es que acabe de mandarlo: se pide ya,
      // sin esperar a la siguiente vuelta del sondeo.
      if (estaba && carga.typing === false) traerNuevos().catch(function () {});
    });
  }

  function cerrarEscribiendo() {
    if (canalEscribiendo) {
      avisarEscribiendo(false);
      canalEscribiendo.cerrar();
      canalEscribiendo = null;
    }
    escribiendo = {};
    ultimoAviso = 0;
  }

  /**
   * Avisa a los demás de que escribo, o de que he dejado de hacerlo.
   *
   * Se puede llamar con cada tecla: el aviso sale como mucho cada 2,5 s. El
   * de «he dejado de escribir», al enviar o al vaciar el campo, hace que los
   * puntos se vayan en el momento y no seis segundos después.
   */
  function avisarEscribiendo(si) {
    if (!canalEscribiendo || !yo) return;
    var ahora = Date.now();
    if (si && ahora - ultimoAviso < CADA_MS) return;
    if (!si && ultimoAviso === 0) return;
    ultimoAviso = si ? ahora : 0;
    canalEscribiendo.enviar('typing', { id: yo, name: miNombre, typing: si });
  }

  /**
   * ¿Le toca contestar al asistente?
   *
   * `esperando` mientras el último mensaje es una pregunta mía ya guardada y
   * hay margen; `fallo` si la llamada ha fallado o se ha acabado el margen.
   * Se deduce de lo que hay: en cuanto entra su respuesta, o su aviso, el
   * último deja de ser mío.
   */
  function estadoAsistente() {
    var p = partes(abierta);
    if (!p || p.clase2 !== 'assistant') return 'nada';
    var ultimo = mensajes[mensajes.length - 1];
    if (!ultimo || ultimo.sender_id !== yo || ultimo.enviando || ultimo.fallo) return 'nada';
    if (asistente.falloEn !== null) return 'fallo';
    var desde = Math.max(Date.parse(ultimo.sent_at), asistente.pedidoEn || 0);
    return Date.now() - desde < ESPERA_ASISTENTE_MS ? 'esperando' : 'fallo';
  }

  /** Despierta al asistente, o le vuelve a preguntar. */
  function pedirAsistente() {
    asistente = { pedidoEn: Date.now(), falloEn: null };
    pintarCola();
    var lang = document.documentElement.lang === 'de' ? 'de' : 'es';
    PFP.fn.invoke('assistant', { lang: lang }).then(
      function () {
        // La función contesta después de haber escrito la respuesta —o su
        // aviso—: se trae ya, sin esperar al sondeo.
        traerNuevos().catch(function () {});
      },
      function () {
        asistente.falloEn = Date.now();
        pintarCola();
      },
    );
  }

  function puntosHTML(etiqueta, nombre) {
    return (
      '<div class="chat__escribiendo">' +
      (nombre ? '<span class="chat__autor">' + esc(nombre) + '</span>' : '') +
      '<span class="chat__puntos" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="sr-only">' + esc(etiqueta) + '</span>' +
      '</div>'
    );
  }

  /** «Ana está escribiendo», «Ana y Luis están…», «Varias personas…». */
  function quienEscribe(lista) {
    var nombres = lista.map(function (e) { return e.nombre; }).filter(Boolean);
    if (lista.length === 1) {
      return nombres[0] ? T('c.chat.escribeUno').replace('{n}', nombres[0]) : T('c.chat.escribeAlguien');
    }
    if (lista.length === 2 && nombres.length === 2) {
      return T('c.chat.escribenDos').replace('{a}', nombres[0]).replace('{b}', nombres[1]);
    }
    return T('c.chat.escribenVarios');
  }

  /** Encima de los puntos, en un grupo: «Ana», «Ana y Luis», «Varias personas». */
  function nombresEscriben(lista) {
    var nombres = lista.map(function (e) { return e.nombre; }).filter(Boolean);
    if (lista.length === 1) return nombres[0] || '';
    if (lista.length === 2 && nombres.length === 2) {
      return T('c.chat.nombresDos').replace('{a}', nombres[0]).replace('{b}', nombres[1]);
    }
    return T('c.chat.variasPersonas');
  }

  /**
   * Lo que va debajo del último mensaje: tres puntos, el aviso del
   * asistente o nada. Se repinta solo cuando cambia, para que la animación
   * no vuelva a empezar con cada aviso.
   */
  function pintarCola() {
    var cola = $('#chat-cola');
    if (!cola) return;
    clearTimeout(relojCola);
    relojCola = null;

    var ahora = Date.now();
    var html = '';
    var estado = estadoAsistente();

    if (estado === 'esperando') {
      html = puntosHTML(T('c.chat.asistenteEscribe'), '');
      var ultimo = mensajes[mensajes.length - 1];
      var desde = Math.max(Date.parse(ultimo.sent_at), asistente.pedidoEn || 0);
      relojCola = setTimeout(pintarCola, desde + ESPERA_ASISTENTE_MS - ahora + 50);
    } else if (estado === 'fallo') {
      html =
        '<div class="chat__msg chat__msg--primero chat__fallo" role="status">' +
        '<p>' + esc(T('c.chat.asistenteFallo')) + '</p>' +
        '<button class="btn btn--ghost chat__reintentar" type="button" data-reintentar>' +
        esc(T('c.chat.reintentar')) + '</button>' +
        '</div>';
    } else {
      var lista = [];
      Object.keys(escribiendo).forEach(function (id) {
        if (escribiendo[id].hasta > ahora) lista.push(escribiendo[id]);
        else delete escribiendo[id];
      });
      if (lista.length) {
        var h = hiloActual();
        // En un grupo hace falta saber quién; en una de dos, no.
        html = puntosHTML(quienEscribe(lista), h && h.clase === 'grupo' ? nombresEscriben(lista) : '');
        var proximo = Math.min.apply(null, lista.map(function (e) { return e.hasta; }));
        relojCola = setTimeout(pintarCola, proximo - ahora + 50);
      }
    }

    if (cola.innerHTML === html) return;
    cola.innerHTML = html;
    if (pegadoAbajo) {
      var caja = $('#chat-mensajes');
      caja.scrollTop = caja.scrollHeight;
    }
  }

  /* ---------------------------------------------------------------------
     Sondeo
     --------------------------------------------------------------------- */

  /**
   * Cuántas vueltas seguidas ha fallado el sondeo.
   *
   * Un fallo suelto es un túnel. Varios seguidos es que algo no va a
   * arreglarse solo, y seguir preguntando cada cuatro segundos es castigar
   * al servidor sin ninguna posibilidad de acertar.
   */
  var fallosSeguidos = 0;
  var MAX_FALLOS = 5;

  function sondear() {
    if (document.hidden) return;

    var tareas = [cargarHilos()];
    if (abierta) {
      // Solo lo nuevo: se pide desde el último que ya tengo.
      tareas.push(traerNuevos());
      // ¿Han escuchado ya mis notas? Más despacio que los mensajes, y fuera
      // de las tareas: que falle no es perder la conexión.
      if (Date.now() - voz.escuchasDesde > ESCUCHAS_CADA_MS) refrescarEscuchas(true);
    }

    Promise.all(tareas)
      .then(function () {
        fallosSeguidos = 0;
      })
      .catch(function (e) {
        // Sin sesión no hay nada que reintentar: se sale a entrar.
        if (e && e.codigo === 'sin_sesion') {
          if (reloj) clearInterval(reloj);
          UI.ir('entrar.html');
          return;
        }
        fallosSeguidos++;
        if (fallosSeguidos >= MAX_FALLOS && reloj) {
          clearInterval(reloj);
          reloj = null;
          UI.avisar('aviso', T('c.chat.sinConexion'));
        }
      });
  }

  function traerNuevos() {
    var p = partes(abierta);
    if (!p) return Promise.resolve();

    var ultimo = null;
    for (var i = mensajes.length - 1; i >= 0; i--) {
      if (!mensajes[i].enviando && !mensajes[i].fallo) { ultimo = mensajes[i].sent_at; break; }
    }
    if (!ultimo) return Promise.resolve();

    var peticion;
    if (p.clase === 'peer') {
      // La función devuelve hacia atrás desde una fecha; para lo nuevo se
      // pide la última página y se descarta lo que ya se tiene.
      peticion = PFP.db.rpc('peer_messages', { p_other: p.otro, p_before: null, p_limit: PAGINA });
    } else if (p.clase === 'directo') {
      peticion = pedirConVoz(function (cols) {
        return PFP.db.select(
          'messages',
          'select=id,sender_id,kind,body,sent_at' + cols +
            '&thread_owner=eq.' + encodeURIComponent(p.duenyo) +
            '&thread_kind=eq.' + encodeURIComponent(p.clase2) +
            '&sent_at=gt.' + encodeURIComponent(ultimo) +
            '&order=sent_at.asc&limit=' + PAGINA,
        );
      });
    } else {
      peticion = pedirConVoz(function (cols) {
        var q =
          'select=id,sender_id,kind,body,sent_at' + cols +
          ',public_profiles!messages_sender_id_fkey!inner(full_name)' +
          '&' + p.columna + '=eq.' + encodeURIComponent(p.ref) +
          '&sent_at=gt.' + encodeURIComponent(ultimo) +
          '&order=sent_at.asc&limit=' + PAGINA;
        if (p.columna === 'organization_id') {
          q += '&admin_only=is.' + (p.soloResponsables ? 'true' : 'false');
        }
        return PFP.db.select('messages', q);
      });
    }

    return peticion.then(function (filas) {
      var lista = (filas || []).slice();
      if (p.clase === 'peer') lista.reverse();

      var conocidos = {};
      mensajes.forEach(function (m) { conocidos[m.id] = true; });

      var añadidos = 0;
      lista.forEach(function (m) {
        if (conocidos[m.id]) return;
        if (new Date(m.sent_at) <= new Date(ultimo)) return;
        if (m.public_profiles) m.autor = m.public_profiles.full_name;
        mensajes.push(m);
        añadidos++;
      });

      if (!añadidos) return;
      pintarMensajes(pegadoAbajo);
      refrescarEscuchas(false);
      if (pegadoAbajo) marcarLeida();
      else pintarNuevosAbajo(añadidos);
    });
  }

  /* Cuántos han llegado mientras leías hacia arriba. */
  var nuevosSinVer = 0;
  function pintarNuevosAbajo(n) {
    nuevosSinVer += n;
    var b = $('#chat-abajo');
    if (!b) return;
    b.hidden = false;
    $('#chat-abajo-n').textContent = nuevosSinVer;
    $('#chat-abajo-n').hidden = false;
  }

  function irAbajo() {
    var caja = $('#chat-mensajes');
    caja.scrollTop = caja.scrollHeight;
    nuevosSinVer = 0;
    $('#chat-abajo').hidden = true;
    marcarLeida();
  }

  function reprogramar() {
    if (reloj) clearInterval(reloj);
    reloj = setInterval(sondear, document.hidden ? SONDEO_FONDO : SONDEO_ACTIVO);
  }

  /* ---------------------------------------------------------------------
     Nueva conversación
     --------------------------------------------------------------------- */

  function abrirDialogo() {
    var dlg = $('#chat-dlg');
    var lista = $('#chat-dlg-lista');
    lista.innerHTML = '<p class="chat__dlgVacio">' + esc(T('c.cargando')) + '</p>';
    if (dlg.showModal) dlg.showModal();

    PFP.db
      .rpc('contactable_people')
      .then(function (gente) {
        if (!gente || gente.length === 0) {
          lista.innerHTML =
            '<p class="chat__dlgVacio">' + esc(T('c.chat.sinContactos')) + '</p>';
          return;
        }
        lista.innerHTML = gente
          .map(function (p) {
            return (
              '<button class="chat__hilo" type="button" data-persona="' + esc(p.id) + '"' +
              ' data-nombre="' + esc(p.full_name) + '"' +
              ' data-foto="' + esc(p.photo_url || '') + '">' +
              (p.photo_url
                ? '<span class="chat__av"><img src="' + esc(p.photo_url) + '" alt="" /></span>'
                : '<span class="chat__av" aria-hidden="true">' + esc(iniciales(p.full_name)) + '</span>') +
              '<span class="chat__hiloCuerpo">' +
              '<span class="chat__hiloNombre">' + esc(p.full_name) + '</span>' +
              '<span class="chat__hiloPrev"><span class="chat__hiloTexto">' +
              esc(p.org_name || '') + (p.is_admin ? ' · ' + esc(T('c.chat.responsable')) : '') +
              '</span></span></span></button>'
            );
          })
          .join('');
      })
      .catch(function (e) {
        lista.innerHTML = '<p class="chat__dlgVacio">' + esc(UI.explicar(e)) + '</p>';
      });
  }

  /**
   * Empieza una conversación con alguien.
   *
   * Se abre en blanco, sin escribir nada todavía: la conversación no existe
   * en la base de datos hasta el primer mensaje, y crear filas vacías para
   * que aparezca en la lista dejaría el listado lleno de conversaciones que
   * nadie empezó.
   */
  function empezarCon(id, nombre, foto) {
    var existe = null;
    hilos.forEach(function (h) { if (h.id === 'peer:' + id) existe = h; });

    if (!existe) {
      hilos.unshift({
        id: 'peer:' + id,
        clase: 'peer',
        nombre: nombre,
        foto: foto || null,
        otro: id,
        previo: null,
        fecha: null,
        sinLeer: 0,
      });
    }
    abrir('peer:' + id);
    setTimeout(function () { $('#chat-texto').focus(); }, 50);
  }

  /* ---------------------------------------------------------------------
     Arranque
     --------------------------------------------------------------------- */

  function paginaChat() {
    if (!UI.exigirSesion()) return;

    var caja = $('#chat-mensajes');
    engancharNotas(caja);

    UI.cargarEstado()
      .then(function (e) {
        yo = e.perfil.id;
        miNombre = String(e.perfil.full_name || '').trim().split(/\s+/)[0] || '';
        miFoto = e.perfil.photo_url || null;
        return cargarHilos();
      })
      .then(function () {
        // Con `?con=<id>` se entra directo a una conversación. Es lo que
        // permite enlazar «escribir a esta persona» desde otra pantalla.
        var con = new URLSearchParams(window.location.search).get('con');
        if (con) {
          var h = null;
          hilos.forEach(function (x) { if (x.id === 'peer:' + con) h = x; });
          if (h) abrir(h.id);
          else PFP.db.rpc('contactable_people').then(function (gente) {
            (gente || []).forEach(function (p) {
              if (p.id === con) empezarCon(p.id, p.full_name, p.photo_url);
            });
          }).catch(function () {});
        }
        reprogramar();
      })
      .catch(function (err) {
        if (err.codigo === 'sin_sesion') return UI.ir('entrar.html');
        UI.avisar('aviso', UI.explicar(err));
      });

    /* --- Interacción --- */

    $('#chat-hilos').addEventListener('click', function (ev) {
      var b = ev.target.closest('.chat__hilo');
      if (!b) return;
      if (b.dataset.solicitud) abrirSolicitud(b.dataset.solicitud);
      else if (b.dataset.id) abrir(b.dataset.id);
    });

    // Aceptar y rechazar viven dentro del panel de mensajes, que se repinta
    // entero: por eso el oyente va en el contenedor y no en cada botón.
    $('#chat-mensajes').addEventListener('click', function (ev) {
      if (ev.target.closest('[data-reintentar]')) return pedirAsistente();
      var si = ev.target.closest('[data-aceptar]');
      if (si) return aceptarSolicitud(si.dataset.aceptar);
      var no = ev.target.closest('[data-rechazar]');
      if (no) return rechazarSolicitud(no.dataset.rechazar);
    });

    $('#chat-buscar').addEventListener('input', function (ev) {
      filtro = ev.target.value;
      pintarLista();
    });

    $$('.chat__tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        pestana = b.dataset.tab;
        $$('.chat__tabs button').forEach(function (o) {
          o.setAttribute('aria-selected', String(o === b));
        });
        pintarLista();
      });
    });

    $('#chat-volver').addEventListener('click', function () {
      // `cerrarPanel()` y no solo cambiar de vista: hay que devolver el panel
      // derecho a como estaba al entrar. Si no, queda la conversacion abierta
      // por debajo sin ninguna elegida, y al pasar a una pantalla ancha —o al
      // girar el movil— aparece vacia en vez del «elige una conversacion».
      cerrarPanel();
      pintarLista();
    });

    var campo = $('#chat-texto');
    campo.addEventListener('input', function () {
      ajustarAlto(campo);
      $('#chat-enviar').disabled = campo.value.trim() === '';
      avisarEscribiendo(campo.value.trim() !== '');
    });
    campo.addEventListener('blur', function () {
      avisarEscribiendo(false);
    });

    campo.addEventListener('keydown', function (ev) {
      // Enter envía, Mayús+Enter hace párrafo. Es lo que espera cualquiera
      // que haya usado un chat, y escribir varias líneas sigue siendo posible.
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        enviar();
      }
    });

    $('#chat-enviar').addEventListener('click', enviar);
    $('#chat-abajo').addEventListener('click', irAbajo);
    $('#chat-nuevo').addEventListener('click', abrirDialogo);
    $('#chat-dlg-cerrar').addEventListener('click', function () { $('#chat-dlg').close(); });

    $('#chat-dlg-lista').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-persona]');
      if (!b) return;
      $('#chat-dlg').close();
      empezarCon(b.dataset.persona, b.dataset.nombre, b.dataset.foto);
    });

    caja.addEventListener('scroll', function () {
      var falta = caja.scrollHeight - caja.scrollTop - caja.clientHeight;
      pegadoAbajo = falta < 40;
      if (pegadoAbajo && nuevosSinVer) irAbajo();
      // Arriba del todo: se pide más historia.
      if (caja.scrollTop < 60 && hayMas && !cargando) cargarMensajes(false);
    });

    document.addEventListener('visibilitychange', function () {
      reprogramar();
      if (!document.hidden) sondear();
    });

    window.addEventListener('beforeunload', function () {
      if (reloj) clearInterval(reloj);
      cerrarEscribiendo();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.dataset.pagina !== 'chat') return;
    if (!PFP.configurado) return;
    paginaChat();
  });
})();
