/* ==========================================================================
   Horas y acreditación
   --------------------------------------------------------------------------
   La cola de partes por validar, y el resumen del periodo.

   Esta es la pantalla con consecuencias fuera de la app: de lo que se valide
   aquí salen el certificado de voluntariado de cada persona (Ley 45/2015,
   art. 12) y la memoria con la que la entidad justifica una subvención. Por
   eso:

     · Ajustar unas horas o rechazar un parte EXIGE motivo. Lo exige el
       servidor, no esta pantalla; aquí solo se pide antes para no hacer ir
       y venir. Un número corregido sin explicación no respalda nada.

     · Validar en tanda solo admite la cifra fichada. Un ajuste es una
       decisión por persona y no puede colarse en un botón que dice
       «validar las doce».

     · Cuando algo falla, se enseña LO QUE DIJO EL SERVIDOR. «Ese parte ya lo
       resolvió alguien, recarga la lista» le dice a quien coordina qué ha
       pasado; «algo ha fallado» no le dice nada.
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
  function numero(n, dec) {
    return Number(n || 0).toLocaleString(lang(), { maximumFractionDigits: dec == null ? 1 : dec });
  }
  function dia(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(lang(), { day: 'numeric', month: 'short' });
  }
  function hora(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * El tope que aplica el servidor en `validate_hours`.
   *
   * Se repite aquí a sabiendas, y solo para AVISAR: quien decide tiene que
   * ver que ese parte no cuadra antes de pulsar validar y llevarse un error.
   * Quien manda sigue siendo el servidor; esta constante no deja pasar nada
   * que allí no pase.
   */
  var TOPE_HORAS = 16;

  /* --- Estado --- */

  var estado = null;
  var cola = [];
  var marcadas = {};
  var periodo = 'mes';

  /* =====================================================================
     PERIODOS
     =====================================================================
     Se calculan aquí y se mandan como fechas: el servidor no tiene por qué
     saber qué es «el mes pasado» para quien mira la pantalla, y quien mira
     la pantalla no está necesariamente en el mismo huso. */

  function rango(cual) {
    var hoy = new Date();
    var a = hoy.getFullYear();
    var m = hoy.getMonth();

    if (cual === 'mesAnterior') {
      return [new Date(a, m - 1, 1), new Date(a, m, 0)];
    }
    if (cual === 'trimestre') {
      return [new Date(a, m - 2, 1), new Date(a, m + 1, 0)];
    }
    if (cual === 'ano') {
      return [new Date(a, 0, 1), new Date(a, 11, 31)];
    }
    return [new Date(a, m, 1), new Date(a, m + 1, 0)];
  }

  /** `YYYY-MM-DD` en hora LOCAL. `toISOString()` pasa por UTC y el día 1 a
      las 00:00 en España se convierte en el último día del mes anterior. */
  function iso(d) {
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mes + '-' + dd;
  }

  /* =====================================================================
     PINTADO
     ===================================================================== */

  function cifra(clave, valor, pie) {
    return (
      '<div class="cifra">' +
      '<span class="cifra__clave">' + esc(T(clave)) + '</span>' +
      '<span class="cifra__valor">' + valor + '</span>' +
      '<span class="cifra__pie">' + esc(pie || '') + '</span>' +
      '</div>'
    );
  }

  function pintarResumen(r) {
    var caja = $('#resumen');
    if (!caja) return;

    if (!r) {
      caja.innerHTML = '';
      return;
    }

    caja.innerHTML =
      '<div class="cifras">' +
      cifra('c.h.kValidadas', numero(r.validated_hours) + ' <small>h</small>', '') +
      cifra('c.h.kPersonas', numero(r.people, 0), '') +
      cifra('c.h.kMisiones', numero(r.missions, 0), '') +
      cifra('c.h.kPendientes', numero(r.pending_count, 0),
        r.pending_count ? numero(r.pending_hours) + ' ' + T('c.a.horas') : '') +
      '</div>';
  }

  function esperando(f) {
    var d = f.waiting_days || 0;
    if (d <= 0) return T('c.h.esperandoHoy');
    return plural('c.h.esperando', d);
  }

  function filaParte(f) {
    var marcada = !!marcadas[f.assignment_id];

    return (
      '<tr data-parte="' + esc(f.assignment_id) + '" data-marcada="' + (marcada ? 'true' : 'false') + '">' +

      '<td class="tabla__estrecha"><input type="checkbox" data-marcar="' + esc(f.assignment_id) + '"' +
      (marcada ? ' checked' : '') + ' aria-label="' + esc(f.volunteer_name) + '" /></td>' +

      '<td><span class="persona">' + avatar(f.volunteer_photo, f.volunteer_name) +
      '<span class="persona__texto"><strong>' + esc(f.volunteer_name) + '</strong>' +
      '<small>' + esc(esperando(f)) + '</small></span></span></td>' +

      '<td><strong>' + esc(f.mission_title) + '</strong>' +
      '<small>' + esc(dia(f.mission_day)) + '</small></td>' +

      '<td>' +
      (f.clocked
        ? '<span class="marca marca--ok">' + esc(T('c.h.fichajeOk')) + '</span>'
        : '<span class="marca marca--espera">' + esc(T('c.h.fichajeFalta')) + '</span>') +
      '<small>' +
      esc(hora(f.arrived_at)) + ' – ' + esc(hora(f.completed_at)) + '</small></td>' +

      '<td class="tabla__num">' +
      (Number(f.hours_reported) > TOPE_HORAS
        ? '<strong class="horas-raras" title="' + esc(T('c.h.turnoRaro')) + '">' +
          esc(numero(f.hours_reported)) + '</strong>'
        : '<strong>' + esc(numero(f.hours_reported)) + '</strong>') +
      '</td>' +

      '<td><span class="cola__acciones">' +
      '<button class="btn btn--primary btn--small" type="button" data-validar="' + esc(f.assignment_id) + '">' +
      esc(T('c.h.validar')) + '</button>' +
      '<button class="btn btn--ghost btn--small" type="button" data-ajustar="' + esc(f.assignment_id) + '">' +
      esc(T('c.h.ajustar')) + '</button>' +
      '<button class="btn btn--ghost btn--small" type="button" data-rechazar="' + esc(f.assignment_id) + '">' +
      esc(T('c.h.rechazar')) + '</button>' +
      '</span></td>' +
      '</tr>'
    );
  }

  function pintarCola() {
    var caja = $('#cola-cuerpo');
    if (!caja) return;

    if (!cola.length) {
      caja.innerHTML =
        '<tr><td colspan="6"><div class="tarjeta__vacio">' +
        '<strong>' + esc(T('c.h.vacio')) + '</strong>' + esc(T('c.h.vacioSub')) +
        '</div></td></tr>';
    } else {
      caja.innerHTML = cola.map(filaParte).join('');
    }

    var n = $('#cola-cuenta');
    if (n) n.textContent = cola.length ? plural('c.h.partes', cola.length) : '';

    pintarLote();
    enganchar();
  }

  function pintarLote() {
    var barra = $('#lote');
    if (!barra) return;

    var n = Object.keys(marcadas).length;
    barra.hidden = n === 0;
    if (!n) return;

    $('#lote-texto').textContent = plural('c.v.marcadas', n);
    $('#lote-validar').textContent = n === 1 ? T('c.h.validarTodo1') : con('c.h.validarTodo', { n: n });
  }

  function sincronizarTodas() {
    var todas = $('#marcar-todas');
    if (!todas) return;
    var n = Object.keys(marcadas).length;
    todas.checked = cola.length > 0 && n === cola.length;
    todas.indeterminate = n > 0 && n < cola.length;
  }

  /* =====================================================================
     EL FORMULARIO DE AJUSTE / RECHAZO
     =====================================================================
     Se abre DEBAJO de la fila, no en una ventana aparte: quien decide tiene
     que seguir viendo el fichaje mientras escribe el motivo. */

  function cerrarFormulario() {
    var abierto = $('#fila-formulario');
    if (abierto) abierto.remove();
    $$('[data-parte]').forEach(function (tr) {
      tr.removeAttribute('data-editando');
    });
  }

  function abrirFormulario(id, modo) {
    cerrarFormulario();

    var f = cola.filter(function (x) { return x.assignment_id === id; })[0];
    if (!f) return;

    var fila = $('[data-parte="' + CSS.escape(id) + '"]');
    if (!fila) return;
    fila.setAttribute('data-editando', 'true');

    var ajuste = modo === 'ajustar';

    var tr = document.createElement('tr');
    tr.id = 'fila-formulario';
    tr.innerHTML =
      '<td colspan="6"><div class="parte-form">' +
      (ajuste
        ? '<label class="parte-form__horas"><span>' + esc(T('c.h.horasNuevas')) + '</span>' +
          '<input type="text" inputmode="decimal" id="parte-horas" value="' +
          esc(numero(f.hours_reported)) + '" /></label>'
        : '') +
      '<label class="parte-form__motivo"><span>' +
      esc(ajuste ? T('c.h.motivoAjuste') : T('c.h.motivoRechazo')) + '</span>' +
      '<input type="text" id="parte-motivo" autocomplete="off" /></label>' +
      '<span class="parte-form__acciones">' +
      '<button class="btn btn--primary btn--small" type="button" id="parte-guardar">' +
      esc(T('c.h.guardar')) + '</button>' +
      '<button class="btn btn--ghost btn--small" type="button" id="parte-cancelar">' +
      esc(T('c.h.cancelar')) + '</button>' +
      '</span>' +
      '<p class="parte-form__error" id="parte-error" hidden></p>' +
      '</div></td>';

    fila.parentNode.insertBefore(tr, fila.nextSibling);

    var motivo = $('#parte-motivo');
    if (motivo) motivo.focus();

    $('#parte-cancelar').addEventListener('click', cerrarFormulario);
    $('#parte-guardar').addEventListener('click', function () {
      guardarFormulario(id, ajuste, this);
    });

    /* Enter guarda: es un formulario de dos campos y obligar a bajar al
       botón con el ratón, veinte veces seguidas, es lo que hace que nadie
       valide las horas. */
    tr.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        guardarFormulario(id, ajuste, $('#parte-guardar'));
      }
      if (ev.key === 'Escape') cerrarFormulario();
    });
  }

  function errorFormulario(texto) {
    var p = $('#parte-error');
    if (!p) return;
    p.textContent = texto;
    p.hidden = !texto;
  }

  /**
   * Lee las horas escritas.
   *
   * Acepta coma decimal: en español se teclea «3,5», y rechazarlo por no
   * ser «3.5» sería culpar a quien escribe de un problema nuestro.
   */
  function leerHoras(texto) {
    var limpio = String(texto || '').trim().replace(',', '.');
    if (!limpio || !/^\d+(\.\d+)?$/.test(limpio)) return null;
    return Number(limpio);
  }

  function guardarFormulario(id, ajuste, boton) {
    errorFormulario('');

    var motivo = ($('#parte-motivo') || {}).value || '';
    if (!motivo.trim()) return errorFormulario(T('c.h.motivoObl'));

    var horas = null;
    if (ajuste) {
      horas = leerHoras(($('#parte-horas') || {}).value);
      if (horas === null) return errorFormulario(T('c.h.horasMal'));
    }

    UI.ocupado(boton, true);

    var llamada = ajuste
      ? PFP.db.rpc('validate_hours', { p_assignment: id, p_hours: horas, p_note: motivo.trim() })
      : PFP.db.rpc('reject_hours', { p_assignment: id, p_note: motivo.trim() });

    llamada
      .then(function () {
        cerrarFormulario();
        quitarDeLaCola(id);
        UI.avisar('aviso', ajuste ? T('c.h.validadaUna') : T('c.h.rechazadaUna'), 'ok');
        recargarResumen();
      })
      .catch(function (err) {
        UI.ocupado(boton, false);
        errorFormulario(UI.explicar(err));
      });
  }

  /* =====================================================================
     VALIDAR
     ===================================================================== */

  function quitarDeLaCola(id) {
    cola = cola.filter(function (f) { return f.assignment_id !== id; });
    delete marcadas[id];
    pintarCola();
    sincronizarTodas();
    actualizarContadorLateral();
  }

  function validarUno(id, boton) {
    UI.limpiarAvisos();
    UI.ocupado(boton, true);

    PFP.db
      .rpc('validate_hours', { p_assignment: id, p_hours: null, p_note: null })
      .then(function () {
        quitarDeLaCola(id);
        recargarResumen();
      })
      .catch(function (err) {
        UI.ocupado(boton, false);
        UI.avisar('aviso', UI.explicar(err), 'error');
      });
  }

  function validarTanda(boton) {
    var ids = Object.keys(marcadas);
    if (!ids.length) return UI.avisar('aviso', T('c.h.nadaMarcado'), 'error');

    UI.limpiarAvisos();
    UI.ocupado(boton, true);

    PFP.db
      .rpc('validate_hours_bulk', { p_assignments: ids })
      .then(function (hechas) {
        /* El servidor devuelve CUÁNTOS pudo. Puede ser menos: alguno lo
           habrá resuelto otra persona entre que se pintó la lista y se pulsó
           el botón, y alguno puede tener un fichaje imposible que hay que
           mirar de uno en uno. Se recarga en vez de tachar los que creíamos. */
        var n = typeof hechas === 'number' ? hechas : (hechas && hechas[0]) || 0;
        marcadas = {};
        UI.avisar('aviso', con('c.h.validadasN', { n: n }), 'ok');
        return cargarCola().then(recargarResumen);
      })
      .catch(function (err) {
        UI.avisar('aviso', UI.explicar(err), 'error');
      })
      .then(function () {
        UI.ocupado(boton, false);
      });
  }

  /** El numerito del menú deja de contar lo que ya se ha resuelto. */
  function actualizarContadorLateral() {
    var caja = document.querySelector('[data-cuenta="horas"]');
    if (!caja) return;
    if (!cola.length) {
      caja.hidden = true;
      return;
    }
    caja.textContent = cola.length > 99 ? '99+' : String(cola.length);
    caja.hidden = false;
  }

  /* =====================================================================
     ENGANCHES
     ===================================================================== */

  function enganchar() {
    $$('[data-validar]').forEach(function (b) {
      b.addEventListener('click', function () { validarUno(b.dataset.validar, b); });
    });
    $$('[data-ajustar]').forEach(function (b) {
      b.addEventListener('click', function () { abrirFormulario(b.dataset.ajustar, 'ajustar'); });
    });
    $$('[data-rechazar]').forEach(function (b) {
      b.addEventListener('click', function () { abrirFormulario(b.dataset.rechazar, 'rechazar'); });
    });
    $$('[data-marcar]').forEach(function (c) {
      c.addEventListener('change', function () {
        if (c.checked) marcadas[c.dataset.marcar] = true;
        else delete marcadas[c.dataset.marcar];
        var tr = c.closest('tr');
        if (tr) tr.dataset.marcada = c.checked ? 'true' : 'false';
        pintarLote();
        sincronizarTodas();
      });
    });
  }

  /* =====================================================================
     MARCO
     ===================================================================== */

  function marco() {
    return (
      '<div class="pantalla__acciones" style="margin-bottom:var(--s-base)">' +
      '<label class="sr-only" for="periodo">' + esc(T('c.h.periodo')) + '</label>' +
      '<select id="periodo">' +
      '<option value="mes">' + esc(T('c.h.mes')) + '</option>' +
      '<option value="mesAnterior">' + esc(T('c.h.mesAnterior')) + '</option>' +
      '<option value="trimestre">' + esc(T('c.h.trimestre')) + '</option>' +
      '<option value="ano">' + esc(T('c.h.ano')) + '</option>' +
      '</select>' +
      '</div>' +

      '<div id="resumen"></div>' +

      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.h.cola')) + '</h2>' +
      '<span id="cola-cuenta" class="enlace-mas"></span></div>' +

      '<div class="lote" id="lote" hidden>' +
      '<strong id="lote-texto"></strong>' +
      '<span class="lote__hueco"></span>' +
      '<button class="btn btn--primary btn--small" type="button" id="lote-validar"></button>' +
      '<button class="btn btn--ghost btn--small" type="button" id="lote-quitar">' +
      esc(T('c.v.quitarMarca')) + '</button>' +
      '</div>' +

      '<div class="tabla-marco"><table class="tabla">' +
      '<thead><tr>' +
      '<th class="tabla__estrecha"><input type="checkbox" id="marcar-todas" ' +
      'aria-label="' + esc(T('c.v.marcarTodas')) + '" /></th>' +
      '<th>' + esc(T('c.h.cPersona')) + '</th>' +
      '<th>' + esc(T('c.h.cMision')) + '</th>' +
      '<th>' + esc(T('c.h.cFichaje')) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.h.cHoras')) + '</th>' +
      '<th></th>' +
      '</tr></thead>' +
      '<tbody id="cola-cuerpo"></tbody>' +
      '</table></div>' +
      '</div>'
    );
  }

  function engancharMarco() {
    $('#periodo').addEventListener('change', function () {
      periodo = this.value;
      recargarResumen();
    });

    $('#marcar-todas').addEventListener('change', function () {
      var todas = this.checked;
      marcadas = {};
      if (todas) cola.forEach(function (f) { marcadas[f.assignment_id] = true; });
      pintarCola();
      sincronizarTodas();
    });

    $('#lote-quitar').addEventListener('click', function () {
      marcadas = {};
      pintarCola();
      sincronizarTodas();
    });

    $('#lote-validar').addEventListener('click', function () {
      validarTanda(this);
    });
  }

  /* =====================================================================
     CARGA
     ===================================================================== */

  function cargarCola() {
    return PFP.db
      .rpc('pending_hours', { p_org: estado.organizacion.id })
      .then(function (r) {
        cola = r || [];
        Object.keys(marcadas).forEach(function (id) {
          if (!cola.some(function (f) { return f.assignment_id === id; })) delete marcadas[id];
        });
        pintarCola();
        sincronizarTodas();
        actualizarContadorLateral();
      });
  }

  function recargarResumen() {
    var r = rango(periodo);
    return PFP.db
      .rpc('hours_summary', {
        p_org: estado.organizacion.id,
        p_from: iso(r[0]),
        p_to: iso(r[1]),
      })
      .then(function (filas) {
        pintarResumen((filas && filas[0]) || null);
      })
      .catch(function () {
        pintarResumen(null);
      });
  }

  function arrancar(e) {
    estado = e;

    if (!e.organizacion) {
      $('#panel').innerHTML =
        '<div class="tarjeta"><div class="tarjeta__vacio">' +
        '<strong>' + esc(T('c.mi.sinEntidad')) + '</strong></div></div>';
      return;
    }

    $('#panel').innerHTML = marco();
    if (UI.retraducir) UI.retraducir();
    engancharMarco();

    return Promise.all([cargarCola(), recargarResumen()]);
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
