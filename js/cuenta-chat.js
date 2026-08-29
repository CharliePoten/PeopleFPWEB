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
   solo mientras la pestaña está visible. No hay websockets a propósito —el
   sitio no carga dependencias externas y Realtime obligaría a traerse el SDK
   entero— pero el intervalo se afloja cuando no hay nadie mirando para no
   dejar una pestaña de fondo llamando al servidor toda la tarde.
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
      var qd =
        'select=id,sender_id,kind,body,sent_at' +
        '&thread_owner=eq.' + encodeURIComponent(p.duenyo) +
        '&thread_kind=eq.' + encodeURIComponent(p.clase2) +
        '&order=sent_at.desc&limit=' + PAGINA;
      if (antes) qd += '&sent_at=lt.' + encodeURIComponent(antes);
      peticion = PFP.db.select('messages', qd);
    } else {
      var q =
        'select=id,sender_id,kind,body,sent_at,public_profiles!messages_sender_id_fkey!inner(full_name)' +
        '&' + p.columna + '=eq.' + encodeURIComponent(p.ref) +
        '&order=sent_at.desc&limit=' + PAGINA;
      if (p.columna === 'organization_id') {
        q += '&admin_only=is.' + (p.soloResponsables ? 'true' : 'false');
      }
      if (antes) q += '&sent_at=lt.' + encodeURIComponent(antes);
      peticion = PFP.db.select('messages', q);
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

      var clases = 'chat__msg' + (mio ? ' chat__msg--mio' : '');
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

    caja.innerHTML = html;

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
          // no tumba el envio.
          if (p.clase2 === 'assistant') {
            PFP.fn.invoke('assistant', {}).catch(function () {});
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
      peticion = PFP.db.select(
        'messages',
        'select=id,sender_id,kind,body,sent_at' +
          '&thread_owner=eq.' + encodeURIComponent(p.duenyo) +
          '&thread_kind=eq.' + encodeURIComponent(p.clase2) +
          '&sent_at=gt.' + encodeURIComponent(ultimo) +
          '&order=sent_at.asc&limit=' + PAGINA,
      );
    } else {
      var q =
        'select=id,sender_id,kind,body,sent_at,public_profiles!messages_sender_id_fkey!inner(full_name)' +
        '&' + p.columna + '=eq.' + encodeURIComponent(p.ref) +
        '&sent_at=gt.' + encodeURIComponent(ultimo) +
        '&order=sent_at.asc&limit=' + PAGINA;
      if (p.columna === 'organization_id') {
        q += '&admin_only=is.' + (p.soloResponsables ? 'true' : 'false');
      }
      peticion = PFP.db.select('messages', q);
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

    UI.cargarEstado()
      .then(function (e) {
        yo = e.perfil.id;
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
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.dataset.pagina !== 'chat') return;
    if (!PFP.configurado) return;
    paginaChat();
  });
})();
