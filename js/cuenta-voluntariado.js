/* ==========================================================================
   Voluntariado
   --------------------------------------------------------------------------
   La tabla de quien esta con la entidad, y encima las solicitudes de alta
   sin resolver.

   El filtrado y la busqueda se hacen EN MEMORIA, sobre lo que ya trajo
   `org_roster`. No es pereza: una entidad grande son un par de cientos de
   filas, caben de sobra, y hacerlo asi significa que teclear en el buscador
   no dispara una consulta por letra. El dia que una entidad pase de unos
   miles habra que paginar en el servidor; hasta entonces esto es mas rapido
   y aguanta quedarse sin cobertura a mitad de una emergencia.

   Lo que NO se decide aqui: quien puede ver esta pantalla. `org_roster` solo
   contesta a quien administra la entidad. Si no lo eres, llega una lista
   vacia y se dice; esconder el enlace es cortesia, no seguridad.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  if (!PFP || !PFP.consola) return;

  var UI = window.PFP_UI || {};
  var T = UI.T;
  var esc = PFP.consola.escapar;
  var avatar = PFP.consola.avatar;

  function $(sel, raiz) {
    return (raiz || document).querySelector(sel);
  }
  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }

  function con(clave, valores) {
    var t = T(clave);
    for (var k in valores) t = t.split('{' + k + '}').join(valores[k]);
    return t;
  }
  function plural(base, n) {
    return n === 1 ? T(base + '1') : con(base, { n: n });
  }

  function lang() {
    return document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES';
  }

  function numero(n, decimales) {
    return Number(n || 0).toLocaleString(lang(), { maximumFractionDigits: decimales || 0 });
  }

  /**
   * Fecha corta. El ano solo cuando NO es este.
   *
   * En una columna de «ultima vez» casi todo es de este ano, y repetir 2026
   * en cada fila obliga a partir la celda en dos lineas sin decir nada.
   */
  /** Con ano siempre. Es la que va al CSV, que se archiva. */
  function fechaEntera(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(lang(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var opciones = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opciones.year = 'numeric';
    return d.toLocaleDateString(lang(), opciones);
  }

  /* --- Catalogo de habilidades: identificador -> nombre en el idioma puesto --- */

  var NOMBRE_HABILIDAD = (function () {
    var mapa = {};
    (window.PFP_HABILIDADES || []).forEach(function (h) {
      mapa[h.id] = h;
    });
    return function (id) {
      var h = mapa[id];
      if (!h) return id;
      return (document.documentElement.lang === 'de' ? h.de : h.es) || h.es || id;
    };
  })();

  /* --- Estado de la pantalla --- */

  var estado = null;
  var filas = [];
  var solicitudes = [];
  var marcadas = {};
  var busqueda = '';
  var filtro = 'todas';

  /* =====================================================================
     FILTRADO
     ===================================================================== */

  var HACE_90_DIAS = Date.now() - 90 * 24 * 3600 * 1000;

  function pasaFiltro(f) {
    if (filtro === 'revisar') return f.docs !== 'ok';
    if (filtro === 'admin') return !!f.is_admin;
    if (filtro === 'activas') {
      return !!f.last_mission_at && new Date(f.last_mission_at).getTime() >= HACE_90_DIAS;
    }
    if (filtro === 'paradas') {
      return !f.last_mission_at || new Date(f.last_mission_at).getTime() < HACE_90_DIAS;
    }
    return true;
  }

  function pasaBusqueda(f) {
    if (!busqueda) return true;
    var texto = [f.full_name, f.email, f.city, f.province].join(' ').toLowerCase();
    // Cada palabra por separado: «lucia valencia» tiene que encontrar a
    // Lucia de Valencia aunque el nombre y la ciudad no esten pegados.
    return busqueda.split(/\s+/).every(function (t) {
      return texto.indexOf(t) !== -1;
    });
  }

  function visibles() {
    return filas.filter(function (f) {
      return pasaFiltro(f) && pasaBusqueda(f);
    });
  }

  /* =====================================================================
     PINTADO
     ===================================================================== */

  var COLOR_DOCS = { ok: 'ok', caduca: 'espera', caducado: 'mal', falta: 'mal' };
  var TEXTO_DOCS = {
    ok: 'c.v.docOk',
    caduca: 'c.v.docCaduca',
    caducado: 'c.v.docCaducado',
    falta: 'c.v.docFalta',
  };

  /**
   * Dos habilidades y «+N», con el resto en el titulo.
   *
   * Con mas, la celda crece a cuatro lineas y empuja fuera de la pantalla
   * las dos columnas que mas se miran: cuando trabajo alguien y si tiene los
   * papeles en regla.
   */
  function etiquetasHabilidad(f) {
    var todas = f.skills || [];
    if (!todas.length) {
      return '<span class="etiqueta">' + esc(T('c.v.sinHabilidades')) + '</span>';
    }
    var acreditadas = {};
    (f.skills_credentialed || []).forEach(function (id) {
      acreditadas[id] = true;
    });

    var html = todas.slice(0, 2).map(function (id) {
      return (
        '<span class="etiqueta' + (acreditadas[id] ? ' etiqueta--acreditada' : '') + '">' +
        esc(NOMBRE_HABILIDAD(id)) + '</span>'
      );
    });

    if (todas.length > 2) {
      html.push(
        '<span class="etiqueta" title="' +
          esc(todas.slice(2).map(NOMBRE_HABILIDAD).join(', ')) + '">' +
          esc(con('c.v.masN', { n: todas.length - 2 })) + '</span>',
      );
    }
    return html.join('');
  }

  function filaTabla(f) {
    var marcada = !!marcadas[f.profile_id];

    return (
      '<tr data-id="' + esc(f.profile_id) + '" data-marcada="' + (marcada ? 'true' : 'false') + '">' +
      '<td class="tabla__estrecha"><input type="checkbox" data-marcar="' + esc(f.profile_id) + '"' +
      (marcada ? ' checked' : '') + ' aria-label="' + esc(f.full_name) + '" /></td>' +

      '<td><span class="persona">' + avatar(f.photo_url, f.full_name) +
      '<span class="persona__texto"><strong>' + esc(f.full_name) + '</strong>' +
      '<small>' + esc(f.email || '') + (f.city ? ' · ' + esc(f.city) : '') + '</small>' +
      '</span></span></td>' +

      '<td><span class="etiquetas">' + etiquetasHabilidad(f) + '</span></td>' +

      '<td class="tabla__num">' + esc(numero(f.hours_org, 1)) + '</td>' +
      '<td>' + esc(f.last_mission_at ? fechaCorta(f.last_mission_at) : T('c.v.nunca')) + '</td>' +

      '<td><span class="marca marca--' + (COLOR_DOCS[f.docs] || 'espera') + '">' +
      esc(T(TEXTO_DOCS[f.docs] || 'c.v.docOk')) + '</span>' +
      (f.is_admin ? ' <span class="etiqueta">' + esc(T('c.v.admin')) + '</span>' : '') + '</td>' +

      '<td><a class="btn btn--ghost btn--small" href="mensajes.html?con=' +
      encodeURIComponent(f.profile_id) + '">' + esc(T('c.v.escribir')) + '</a></td>' +
      '</tr>'
    );
  }

  function pintarTabla() {
    var caja = $('#tabla-cuerpo');
    if (!caja) return;

    var lista = visibles();

    if (!lista.length) {
      var vacio = filas.length ? T('c.v.vacioFiltro') : T('c.v.vacio');
      var sub = filas.length ? '' : T('c.v.vacioSub');
      caja.innerHTML =
        '<tr><td colspan="7"><div class="tarjeta__vacio"><strong>' + esc(vacio) + '</strong>' +
        esc(sub) + '</div></td></tr>';
    } else {
      caja.innerHTML = lista.map(filaTabla).join('');
    }

    var cuenta = $('#cuenta-filas');
    if (cuenta) cuenta.textContent = plural('c.v.total', lista.length);

    pintarLote();
    engancharMarcas();
  }

  /** La barra azul de arriba, solo cuando hay algo marcado. */
  function pintarLote() {
    var barra = $('#lote');
    if (!barra) return;

    var n = Object.keys(marcadas).length;
    barra.hidden = n === 0;
    if (!n) return;

    var texto = $('#lote-texto');
    if (texto) texto.textContent = plural('c.v.marcadas', n);
  }

  function engancharMarcas() {
    $$('[data-marcar]').forEach(function (c) {
      c.addEventListener('change', function () {
        var id = c.dataset.marcar;
        if (c.checked) marcadas[id] = true;
        else delete marcadas[id];

        var fila = c.closest('tr');
        if (fila) fila.dataset.marcada = c.checked ? 'true' : 'false';

        pintarLote();
        sincronizarTodas();
      });
    });
  }

  /**
   * La casilla de la cabecera.
   *
   * Marca y desmarca SOLO lo visible: si el filtro esconde a ciento veinte
   * personas, «seleccionar todas» no puede llevarse por delante a quien no
   * se esta viendo.
   */
  function sincronizarTodas() {
    var todas = $('#marcar-todas');
    if (!todas) return;

    var lista = visibles();
    var marcadasVisibles = lista.filter(function (f) {
      return marcadas[f.profile_id];
    }).length;

    todas.checked = lista.length > 0 && marcadasVisibles === lista.length;
    todas.indeterminate = marcadasVisibles > 0 && marcadasVisibles < lista.length;
  }

  /* --- Solicitudes de alta --- */

  function pintarSolicitudes() {
    var caja = $('#solicitudes-cuerpo');
    if (!caja) return;

    if (!solicitudes.length) {
      caja.innerHTML = '<div class="tarjeta__vacio">' + esc(T('c.v.sinSolicitudes')) + '</div>';
      return;
    }

    caja.innerHTML =
      '<ul class="cola">' +
      solicitudes.map(function (s) {
        return (
          '<li class="cola__fila" data-solicitud="' + esc(s.id) + '">' +
          avatar(null, s.full_name) +
          '<span class="cola__texto"><strong>' + esc(s.full_name) + '</strong>' +
          '<span>' + esc(s.message || fechaCorta(s.created_at)) + '</span></span>' +
          '<span class="cola__acciones">' +
          '<button class="btn btn--primary btn--small" type="button" data-aceptar="' + esc(s.id) + '">' +
          esc(T('c.v.aceptar')) + '</button>' +
          '<button class="btn btn--ghost btn--small" type="button" data-rechazar="' + esc(s.id) + '">' +
          esc(T('c.v.rechazar')) + '</button>' +
          '</span></li>'
        );
      }).join('') +
      '</ul>';

    engancharSolicitudes();
  }

  function resolver(id, aceptar, boton) {
    UI.limpiarAvisos();
    UI.ocupado(boton, true);

    PFP.db
      .rpc('resolve_join_request', { p_request: id, p_accept: aceptar })
      .then(function () {
        solicitudes = solicitudes.filter(function (s) {
          return s.id !== id;
        });
        pintarSolicitudes();

        /* Al aceptar hay una persona nueva en la entidad. Se recarga la
           tabla en vez de inventarse la fila: el servidor sabe sus horas,
           sus habilidades y como tiene los papeles, y aqui no. */
        if (aceptar) cargarRoster();
      })
      .catch(function (err) {
        UI.ocupado(boton, false);
        UI.avisar('aviso', UI.explicar(err), 'error');
      });
  }

  function engancharSolicitudes() {
    $$('[data-aceptar]').forEach(function (b) {
      b.addEventListener('click', function () {
        resolver(b.dataset.aceptar, true, b);
      });
    });
    $$('[data-rechazar]').forEach(function (b) {
      b.addEventListener('click', function () {
        resolver(b.dataset.rechazar, false, b);
      });
    });
  }

  /* =====================================================================
     EXPORTAR
     ===================================================================== */

  /**
   * Una celda de CSV.
   *
   * Lo de `'` delante cuando empieza por `= + - @` no es manía: una hoja de
   * calculo trata eso como una FORMULA. Un nombre escrito por otra persona
   * que empiece por `=` se ejecutaria al abrir el archivo en el ordenador de
   * quien coordina.
   */
  function celda(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportar() {
    var n = Object.keys(marcadas).length;
    // Lo marcado si hay algo marcado; si no, lo que se esta viendo. Exportar
    // las doscientas cuando el filtro enseña doce sorprenderia a cualquiera.
    var lista = n
      ? filas.filter(function (f) { return marcadas[f.profile_id]; })
      : visibles();

    if (!lista.length) return;

    var cabecera = [
      T('c.v.cPersona'), T('c.email'), T('c.vol.tel'), T('c.vol.ciudad'),
      T('c.v.cHabilidades'), T('c.v.cHoras'), T('c.v.cMisiones'),
      T('c.v.cUltima'), T('c.v.cPapeles'),
    ];

    var lineas = [cabecera.map(celda).join(';')];

    lista.forEach(function (f) {
      lineas.push([
        f.full_name,
        f.email,
        f.phone,
        [f.city, f.province].filter(Boolean).join(', '),
        (f.skills || []).map(NOMBRE_HABILIDAD).join(', '),
        numero(f.hours_org, 2),
        f.missions_org,
        f.last_mission_at ? fechaEntera(f.last_mission_at) : T('c.v.nunca'),
        T(TEXTO_DOCS[f.docs] || 'c.v.docOk'),
      ].map(celda).join(';'));
    });

    /* El BOM va delante para que Excel abra el archivo como UTF-8. Sin el,
       cualquier nombre con tilde llega roto, que es justo la mitad. */
    var blob = new Blob(['\uFEFF' + lineas.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'voluntariado-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* =====================================================================
     MARCO DE LA PANTALLA
     ===================================================================== */

  function marco() {
    return (
      '<div class="tarjeta" id="solicitudes">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.v.solicitudes')) + '</h2></div>' +
      '<div id="solicitudes-cuerpo" class="tarjeta__cuerpo tarjeta__cuerpo--liso"></div>' +
      '</div>' +

      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.v.t')) + '</h2>' +
      '<span id="cuenta-filas" class="enlace-mas"></span></div>' +

      '<div class="filtros">' +
      '<span class="filtros__buscar">' +
      '<label class="sr-only" for="buscar">' + esc(T('c.v.buscar')) + '</label>' +
      '<input type="search" id="buscar" placeholder="' + esc(T('c.v.buscar')) + '" autocomplete="off" />' +
      '</span>' +
      '<label class="sr-only" for="filtro">' + esc(T('c.v.fTodas')) + '</label>' +
      '<select id="filtro">' +
      '<option value="todas">' + esc(T('c.v.fTodas')) + '</option>' +
      '<option value="revisar">' + esc(T('c.v.fRevisar')) + '</option>' +
      '<option value="activas">' + esc(T('c.v.fActivas')) + '</option>' +
      '<option value="paradas">' + esc(T('c.v.fParadas')) + '</option>' +
      '<option value="admin">' + esc(T('c.v.fAdmin')) + '</option>' +
      '</select>' +
      '</div>' +

      '<div class="lote" id="lote" hidden>' +
      '<strong id="lote-texto"></strong>' +
      '<span class="lote__hueco"></span>' +
      '<button class="btn btn--ghost btn--small" type="button" id="lote-exportar">' +
      esc(T('c.exportar')) + '</button>' +
      '<button class="btn btn--ghost btn--small" type="button" id="lote-quitar">' +
      esc(T('c.v.quitarMarca')) + '</button>' +
      '</div>' +

      '<div class="tabla-marco"><table class="tabla">' +
      '<thead><tr>' +
      '<th class="tabla__estrecha"><input type="checkbox" id="marcar-todas" ' +
      'aria-label="' + esc(T('c.v.marcarTodas')) + '" /></th>' +
      '<th>' + esc(T('c.v.cPersona')) + '</th>' +
      '<th>' + esc(T('c.v.cHabilidades')) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.v.cHoras')) + '</th>' +
      '<th>' + esc(T('c.v.cUltima')) + '</th>' +
      '<th>' + esc(T('c.v.cPapeles')) + '</th>' +
      '<th><span class="sr-only">' + esc(T('c.v.escribir')) + '</span></th>' +
      '</tr></thead>' +
      '<tbody id="tabla-cuerpo"></tbody>' +
      '</table></div>' +
      '</div>'
    );
  }

  function engancharMarco() {
    var buscar = $('#buscar');
    if (buscar) {
      buscar.addEventListener('input', function () {
        busqueda = buscar.value.trim().toLowerCase();
        pintarTabla();
        sincronizarTodas();
      });
    }

    var sel = $('#filtro');
    if (sel) {
      sel.addEventListener('change', function () {
        filtro = sel.value;
        pintarTabla();
        sincronizarTodas();
      });
    }

    var todas = $('#marcar-todas');
    if (todas) {
      todas.addEventListener('change', function () {
        visibles().forEach(function (f) {
          if (todas.checked) marcadas[f.profile_id] = true;
          else delete marcadas[f.profile_id];
        });
        pintarTabla();
        sincronizarTodas();
      });
    }

    var quitar = $('#lote-quitar');
    if (quitar) {
      quitar.addEventListener('click', function () {
        marcadas = {};
        pintarTabla();
        sincronizarTodas();
      });
    }

    [$('#lote-exportar'), $('#btn-exportar')].forEach(function (b) {
      if (b) b.addEventListener('click', exportar);
    });
  }

  /* =====================================================================
     CARGA
     ===================================================================== */

  function cargarRoster() {
    return PFP.db
      .rpc('org_roster', { p_org: estado.organizacion.id })
      .then(function (r) {
        filas = r || [];
        // Lo marcado que ya no esta en la lista deja de estarlo: si no, el
        // contador diria «3 seleccionadas» con dos filas en pantalla.
        Object.keys(marcadas).forEach(function (id) {
          if (!filas.some(function (f) { return f.profile_id === id; })) delete marcadas[id];
        });
        pintarTabla();
        sincronizarTodas();
      });
  }

  function arrancar(e) {
    estado = e;

    if (!e.organizacion) {
      $('#panel').innerHTML =
        '<div class="tarjeta"><div class="tarjeta__vacio">' +
        '<strong>' + esc(T('c.mi.sinEntidad')) + '</strong>' +
        '<a class="btn btn--primary" href="organizacion.html" style="margin-top:var(--s-md)">' +
        esc(T('c.mi.darAlta')) + '</a></div></div>';
      return;
    }

    $('#panel').innerHTML = marco();
    if (UI.retraducir) UI.retraducir();
    engancharMarco();

    // El panel enlaza aqui con `?filtro=revisar`. Se acepta solo un valor de
    // la lista: lo que venga de la URL no elige codigo, elige opcion.
    var pedido = new URLSearchParams(window.location.search).get('filtro');
    var sel = $('#filtro');
    if (pedido && sel && sel.querySelector('option[value="' + CSS.escape(pedido) + '"]')) {
      sel.value = pedido;
      filtro = pedido;
    }

    return Promise.all([
      cargarRoster(),
      PFP.db.rpc('pending_join_requests').then(function (r) {
        solicitudes = (r || []).filter(function (s) {
          return s.organization_id === estado.organizacion.id;
        });
        pintarSolicitudes();
      }),
    ]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!PFP.configurado) return;

    PFP.consola
      .montar()
      .then(arrancar)
      .catch(function (err) {
        if (err && err.codigo === 'sin_sesion') return;
        UI.avisar('aviso', UI.explicar(err), 'error');
      });
  });
})();
