/* ==========================================================================
   Informes y memoria
   --------------------------------------------------------------------------
   La memoria de actividad de una entidad: cuánta gente, cuántas horas y en
   qué, entre dos fechas. Es lo que se adjunta a la justificación de una
   subvención.

   Dos decisiones que la hacen defendible:

     · En los totales solo entran las horas VALIDADAS. Lo que nadie ha
       repasado no puede sostener una justificación, y colarlo en la suma
       sería firmar una cifra que no se ha comprobado.

     · Lo pendiente no se esconde: se avisa arriba, con el número y un enlace
       a la cola. Ocultarlo dejaría a alguien justificando 900 horas sin
       saber que hay 60 más suyas esperando a un clic.

   El agrupado se hace aquí sobre las filas que devuelve `hours_report`. Es
   la misma función que usa la app para lo mismo: dos consultas distintas
   para la misma memoria acabarían dando dos cifras distintas.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  if (!PFP || !PFP.consola) return;

  var UI = window.PFP_UI || {};
  var T = UI.T;
  var esc = PFP.consola.escapar;

  function $(sel) {
    return document.querySelector(sel);
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
  function fecha(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(lang(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** `YYYY-MM-DD` en hora local; `toISOString()` se iría un día por el huso. */
  function iso(d) {
    return (
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  var estado = null;
  var filas = [];
  var vista = 'persona';

  /* =====================================================================
     AGRUPADO
     ===================================================================== */

  /**
   * Quién hizo las horas: la clave para sumarlas y para contar personas.
   *
   * Por persona y no por nombre. Agrupar por nombre sumaba en una sola fila
   * a dos voluntarias que se llamen igual —María García—: horas atribuidas a
   * quien no las hizo, en un documento que va a una administración. El nombre
   * solo se usa si la base todavía no manda el id (antes de la 0050).
   */
  function persona(f) {
    return f.volunteer_id ? 'id:' + f.volunteer_id : 'nombre:' + (f.volunteer_name || '');
  }

  /**
   * Qué misión es: lo mismo que `persona()`, para las misiones.
   *
   * Por título se sumaban como una sola dos misiones que se llamen igual
   * —«Reparto de comida» en Paiporta y en Catarroja—, con las horas y la
   * gente de las dos, y la cifra de misiones de la memoria salía corta. El
   * título solo se usa si la base todavía no manda el id (antes de la 0052).
   */
  function mision(f) {
    return f.mission_id ? 'id:' + f.mission_id : 'titulo:' + (f.mission_title || '');
  }

  /**
   * Agrupa las filas validadas por lo que se le pida.
   *
   * `clave` dice qué filas van juntas —quién o cuál es, no cómo se llama— y
   * `campo`, el nombre que se pinta.
   *
   * Las pendientes y las rechazadas se quedan fuera de los totales pero se
   * cuentan aparte, para el aviso de arriba.
   */
  function agrupar(clave, campo) {
    var mapa = {};

    filas.forEach(function (f) {
      if (f.hours_state !== 'validated') return;
      var k = clave(f);
      if (!mapa[k]) mapa[k] = { nombre: f[campo] || '—', horas: 0, partes: 0, gente: {}, operaciones: {} };
      mapa[k].horas += Number(f.verified_hours || 0);
      mapa[k].partes += 1;
      mapa[k].gente[persona(f)] = true;
      mapa[k].operaciones[f.operation_name || ''] = true;
    });

    return Object.keys(mapa)
      .map(function (k) {
        var g = mapa[k];
        g.personas = Object.keys(g.gente).length;
        // Solo si es una: una base sin la 0052 aún junta misiones de varias
        // operaciones bajo un título, y poner una sola sería mentir.
        var ops = Object.keys(g.operaciones);
        g.operacion = ops.length === 1 ? ops[0] : '';
        return g;
      })
      .sort(function (a, b) { return b.horas - a.horas; });
  }

  function pendientes() {
    return filas.filter(function (f) { return f.hours_state === 'pending'; }).length;
  }

  function totales() {
    var validadas = filas.filter(function (f) { return f.hours_state === 'validated'; });
    var gente = {};
    var misiones = {};
    var horas = 0;
    validadas.forEach(function (f) {
      gente[persona(f)] = true;
      misiones[mision(f)] = true;
      horas += Number(f.verified_hours || 0);
    });
    return {
      horas: horas,
      personas: Object.keys(gente).length,
      misiones: Object.keys(misiones).length,
    };
  }

  /* =====================================================================
     PINTADO
     ===================================================================== */

  function cifra(clave, valor) {
    return (
      '<div class="cifra">' +
      '<span class="cifra__clave">' + esc(T(clave)) + '</span>' +
      '<span class="cifra__valor">' + valor + '</span>' +
      '</div>'
    );
  }

  function tablaAgrupada(clave, campo, cabecera) {
    var grupos = agrupar(clave, campo);

    if (!grupos.length) {
      return '<div class="tarjeta__vacio">' + esc(T('c.i.sinDatos')) + '</div>';
    }

    return (
      '<div class="tabla-marco"><table class="tabla">' +
      '<thead><tr>' +
      '<th>' + esc(cabecera) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.h.kPersonas')) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.i.cPartes')) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.h.cHoras')) + '</th>' +
      '</tr></thead><tbody>' +
      grupos.map(function (g) {
        return (
          '<tr><td><strong>' + esc(g.nombre) + '</strong>' +
          // Dos misiones que se llamen igual ya salen en filas separadas; sin
          // la operación debajo parecerían la misma repetida.
          (campo === 'mission_title' && g.operacion ? '<small>' + esc(g.operacion) + '</small>' : '') +
          '</td>' +
          '<td class="tabla__num">' + esc(numero(g.personas, 0)) + '</td>' +
          '<td class="tabla__num">' + esc(numero(g.partes, 0)) + '</td>' +
          '<td class="tabla__num"><strong>' + esc(numero(g.horas)) + '</strong></td></tr>'
        );
      }).join('') +
      '</tbody></table></div>'
    );
  }

  function tablaDetalle() {
    var validadas = filas.filter(function (f) { return f.hours_state === 'validated'; });

    if (!validadas.length) {
      return '<div class="tarjeta__vacio">' + esc(T('c.i.sinDatos')) + '</div>';
    }

    return (
      '<div class="tabla-marco"><table class="tabla">' +
      '<thead><tr>' +
      '<th>' + esc(T('c.h.cPersona')) + '</th>' +
      '<th>' + esc(T('c.i.cOperacion')) + '</th>' +
      '<th>' + esc(T('c.h.cMision')) + '</th>' +
      '<th>' + esc(T('c.v.cUltima')) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.h.cHoras')) + '</th>' +
      '</tr></thead><tbody>' +
      validadas.map(function (f) {
        return (
          '<tr><td><strong>' + esc(f.volunteer_name) + '</strong></td>' +
          '<td>' + esc(f.operation_name || '') + '</td>' +
          '<td>' + esc(f.mission_title) + '</td>' +
          '<td>' + esc(fecha(f.completed_at)) + '</td>' +
          '<td class="tabla__num">' + esc(numero(f.verified_hours)) + '</td></tr>'
        );
      }).join('') +
      '</tbody></table></div>'
    );
  }

  function pintarResultado() {
    var caja = $('#resultado');
    if (!caja) return;

    var t = totales();
    var pend = pendientes();

    var aviso = pend
      ? '<div class="aviso aviso--espera" data-visible="true">' +
        esc(plural('c.i.avisoPendientes', pend)) +
        ' <a href="horas.html" style="font-weight:700">' + esc(T('c.i.irAValidar')) + '</a>' +
        '</div>'
      : '';

    var cuerpo =
      vista === 'persona'
        ? tablaAgrupada(persona, 'volunteer_name', T('c.h.cPersona'))
        : vista === 'mision'
        ? tablaAgrupada(mision, 'mission_title', T('c.h.cMision'))
        : tablaDetalle();

    caja.innerHTML =
      aviso +
      '<div class="cifras">' +
      cifra('c.h.kValidadas', numero(t.horas) + ' <small>h</small>') +
      cifra('c.h.kPersonas', numero(t.personas, 0)) +
      cifra('c.h.kMisiones', numero(t.misiones, 0)) +
      '</div>' +
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab">' +
      '<div class="pastillas" role="tablist">' +
      ['persona', 'mision', 'detalle'].map(function (v) {
        var clave = v === 'persona' ? 'c.i.porPersona' : v === 'mision' ? 'c.i.porMision' : 'c.i.detalle';
        return (
          '<button class="pastilla" type="button" role="tab" data-vista="' + v + '" ' +
          'aria-pressed="' + (vista === v ? 'true' : 'false') + '">' + esc(T(clave)) + '</button>'
        );
      }).join('') +
      '</div></div>' +
      cuerpo +
      '</div>';

    Array.prototype.forEach.call(caja.querySelectorAll('[data-vista]'), function (b) {
      b.addEventListener('click', function () {
        vista = b.dataset.vista;
        pintarResultado();
      });
    });
  }

  /* =====================================================================
     CSV
     ===================================================================== */

  function celda(v) {
    var s = v == null ? '' : String(v);
    // Una hoja de cálculo ejecuta lo que empieza por `= + - @`. Un nombre lo
    // escribe una persona, no nosotros.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportar() {
    var validadas = filas.filter(function (f) { return f.hours_state === 'validated'; });
    if (!validadas.length) return;

    var lineas = [
      [T('c.h.cPersona'), T('c.i.cOperacion'), T('c.i.cLugar'), T('c.h.cMision'),
       T('c.v.cUltima'), T('c.h.cHoras')].map(celda).join(';'),
    ];

    validadas.forEach(function (f) {
      lineas.push([
        f.volunteer_name, f.operation_name, f.location_label, f.mission_title,
        fecha(f.completed_at), numero(f.verified_hours, 2),
      ].map(celda).join(';'));
    });

    var blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'memoria-' + $('#desde').value + '_' + $('#hasta').value + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* =====================================================================
     MARCO
     ===================================================================== */

  function marco() {
    var hoy = new Date();
    var desde = new Date(hoy.getFullYear(), 0, 1);

    return (
      '<div class="tarjeta">' +
      '<div class="filtros">' +
      '<label style="display:grid;gap:4px"><span class="cifra__clave">' + esc(T('c.i.desde')) + '</span>' +
      '<input type="date" id="desde" value="' + iso(desde) + '" /></label>' +
      '<label style="display:grid;gap:4px"><span class="cifra__clave">' + esc(T('c.i.hasta')) + '</span>' +
      '<input type="date" id="hasta" value="' + iso(hoy) + '" /></label>' +
      '<button class="btn btn--primary btn--small" type="button" id="btn-generar">' +
      esc(T('c.i.generar')) + '</button>' +
      '</div></div>' +
      '<div id="resultado"><p class="cargando">' + esc(T('c.cargando')) + '</p></div>'
    );
  }

  function cargar() {
    var desde = $('#desde').value;
    var hasta = $('#hasta').value;
    if (!desde || !hasta) return;

    // Si vienen del revés se cambian en silencio: es un error de tecleo, no
    // algo que merezca una regañina y una tabla vacía.
    if (desde > hasta) {
      var v = desde;
      desde = hasta;
      hasta = v;
      $('#desde').value = desde;
      $('#hasta').value = hasta;
    }

    $('#resultado').innerHTML = '<p class="cargando">' + esc(T('c.cargando')) + '</p>';

    return PFP.db
      .rpc('hours_report', { p_from: desde, p_to: hasta, p_org: estado.organizacion.id })
      .then(function (r) {
        filas = r || [];
        pintarResultado();
      })
      .catch(function (err) {
        filas = [];
        $('#resultado').innerHTML = '';
        UI.avisar('aviso', UI.explicar(err), 'error');
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

    $('#btn-generar').addEventListener('click', cargar);
    var imprimir = $('#btn-imprimir');
    if (imprimir) imprimir.addEventListener('click', function () { window.print(); });
    var exp = $('#btn-exportar');
    if (exp) exp.addEventListener('click', exportar);

    return cargar();
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
