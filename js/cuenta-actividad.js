/* ==========================================================================
   Mi actividad
   --------------------------------------------------------------------------
   Lo que ve de sí misma una persona voluntaria: su próxima misión, sus
   horas, sus papeles y su historial.

   Es de LECTURA. Cambiar la disponibilidad, subir una acreditación o
   confirmar que vas de camino se hace en la app, que es donde están el GPS,
   la cámara y los avisos. Poner aquí botones que escriben invitaría a
   resolver desde el navegador cosas que en una emergencia se resuelven con
   el móvil en la mano, y a que alguien se quede esperando a que le llegue un
   aviso que nunca se pidió.

   Las horas salen separadas en validadas y pendientes a propósito. Quien
   mira su propia actividad tiene derecho a saber que hay dos jornadas suyas
   esperando a que alguien las repase, y no solo el total que ya cuenta.
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

  function lang() {
    return document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES';
  }
  function numero(n, dec) {
    return Number(n || 0).toLocaleString(lang(), { maximumFractionDigits: dec == null ? 1 : dec });
  }
  function fecha(iso, conHora) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (conHora) {
      o.hour = '2-digit';
      o.minute = '2-digit';
    }
    return d.toLocaleDateString(lang(), o);
  }
  /** Una fecha suelta de la base (`YYYY-MM-DD`), sin pasar por husos. */
  function fechaSola(texto) {
    if (!texto) return '';
    var t = String(texto).split('-');
    if (t.length !== 3) return texto;
    return new Date(Number(t[0]), Number(t[1]) - 1, Number(t[2]))
      .toLocaleDateString(lang(), { day: 'numeric', month: 'long', year: 'numeric' });
  }

  var NOMBRE_HABILIDAD = (function () {
    var mapa = {};
    (window.PFP_HABILIDADES || []).forEach(function (h) { mapa[h.id] = h; });
    return function (id) {
      var h = mapa[id];
      if (!h) return id;
      return (document.documentElement.lang === 'de' ? h.de : h.es) || h.es || id;
    };
  })();

  /* =====================================================================
     PIEZAS
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

  function proxima(m) {
    if (!m) {
      return (
        '<div class="tarjeta"><div class="tarjeta__vacio">' +
        '<strong>' + esc(T('c.a.sinProxima')) + '</strong>' +
        esc(T('c.a.sinProximaSub')) + '</div></div>'
      );
    }

    var lineas = [];
    lineas.push('<span>' + esc(fecha(m.starts_at, true)) + '</span>');
    if (m.meeting_point) {
      lineas.push('<span>' + esc(T('c.a.puntoEncuentro')) + ': ' + esc(m.meeting_point) + '</span>');
    }
    var donde = [m.street, m.city].filter(Boolean).join(', ');
    if (donde) lineas.push('<span>' + esc(donde) + '</span>');
    if (m.org_name) lineas.push('<span>' + esc(m.org_name) + '</span>');
    if (m.contact_name) {
      lineas.push(
        '<span>' + esc(T('c.a.contacto')) + ': ' + esc(m.contact_name) +
        (m.contact_phone
          ? ' · <a href="tel:' + esc(m.contact_phone) + '" style="color:inherit">' +
            esc(m.contact_phone) + '</a>'
          : '') +
        '</span>',
      );
    }

    return (
      '<div class="proxima">' +
      '<span class="proxima__clave">' + esc(T('c.a.proxima')) + '</span>' +
      '<h2>' + esc(m.title) + '</h2>' +
      '<div class="proxima__datos">' + lineas.join('') + '</div>' +
      '<p style="margin:0;font-size:0.88rem;color:var(--navy-200)">' +
      esc(T('c.a.enLaApp')) + '</p>' +
      '</div>'
    );
  }

  /* --- Papeles --- */

  var COLOR_ACRED = { verified: 'ok', pending: 'espera', rejected: 'mal', none: 'espera' };
  var TEXTO_ACRED = {
    verified: 'c.a.sVerified',
    pending: 'c.a.sPending',
    rejected: 'c.a.sRejected',
    none: 'c.a.sNone',
  };

  /**
   * El mismo criterio que `docs_state` en el servidor, y con el mismo aviso
   * de treinta dias.
   *
   * Se repite aqui porque esta pantalla mira fechas sueltas —el seguro, cada
   * acreditacion— y no el resumen. Lo que NO puede pasar es que use un
   * umbral distinto: a la misma persona el mismo dia le diria «caduca
   * pronto» en el listado de su entidad y «al dia» en el suyo propio.
   */
  var AVISO_DIAS = 30;

  function estadoDeFecha(fecha) {
    if (!fecha) return 'falta';
    var vence = new Date(fecha);
    if (isNaN(vence)) return 'falta';
    var hoy = new Date();
    if (vence < hoy) return 'caducado';
    if (vence < new Date(hoy.getTime() + AVISO_DIAS * 24 * 3600 * 1000)) return 'caduca';
    return 'ok';
  }

  var COLOR_DOCS = { ok: 'ok', caduca: 'espera', caducado: 'mal', falta: 'mal' };
  var TEXTO_DOCS = {
    ok: 'c.v.docOk',
    caduca: 'c.v.docCaduca',
    caducado: 'c.v.docCaducado',
    falta: 'c.v.docFalta',
  };

  function papeles(a, habilidades) {
    var filas = [];

    /* El seguro primero: sin él no se puede asignar a nadie a una actividad,
       así que es el papel que más pronto deja a alguien fuera. */
    var seguro = a && a.insurance_until;
    var estado = estadoDeFecha(seguro);
    filas.push(
      '<li><span><strong>' + esc(T('c.a.seguro')) + '</strong>' +
      '<small>' +
      (seguro
        ? esc(con(estado === 'caducado' ? 'c.a.vencio' : 'c.a.seguroHasta', { d: fechaSola(seguro) }))
        : esc(T('c.a.seguroFalta'))) +
      '</small></span>' +
      '<span class="marca marca--' + COLOR_DOCS[estado] + '">' +
      esc(T(TEXTO_DOCS[estado])) + '</span></li>',
    );

    (habilidades || []).forEach(function (h) {
      /* Una habilidad que no necesita acreditación no lleva marca de estado:
         poner «sin acreditar» en algo que no hay que acreditar hace pensar
         que falta un papel que nadie va a pedir. */
      var marca = h.requires_credential
        ? '<span class="marca marca--' + (COLOR_ACRED[h.status] || 'espera') + '">' +
          esc(T(TEXTO_ACRED[h.status] || 'c.a.sNone')) + '</span>'
        : '<span class="etiqueta">' + esc(T('c.a.sNoHace')) + '</span>';

      var vence = '';
      if (h.expires_at) {
        var e = estadoDeFecha(h.expires_at);
        // La fecha en rojo cuando ya pasó o está a punto: una acreditación
        // caducada deja fuera de una misión igual que no tenerla.
        vence =
          '<small' + (e === 'ok' ? '' : ' style="color:var(--red-600);font-weight:600"') + '>' +
          esc(con(e === 'caducado' ? 'c.a.vencio' : 'c.a.venceEl', { d: fechaSola(h.expires_at) })) +
          '</small>';
      }

      filas.push(
        '<li><span><strong>' + esc(NOMBRE_HABILIDAD(h.skill_id)) + '</strong>' + vence + '</span>' +
        marca + '</li>',
      );
    });

    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.a.papeles')) + '</h2></div>' +
      '<ul class="lista-estado">' + filas.join('') + '</ul>' +
      '</div>'
    );
  }

  /* --- Disponibilidad --- */

  var DIAS = [1, 2, 3, 4, 5, 6, 0];

  /** Las tres franjas del día, en horas. Coinciden con las de la app. */
  var FRANJAS = [
    { clave: 'c.a.manana', de: 6, a: 14 },
    { clave: 'c.a.tarde', de: 14, a: 20 },
    { clave: 'c.a.noche', de: 20, a: 24 },
  ];

  function horaDe(texto) {
    return Number(String(texto || '0').slice(0, 2));
  }

  function disponibilidad(ventanas) {
    if (!ventanas || !ventanas.length) {
      return (
        '<div class="tarjeta">' +
        '<div class="tarjeta__cab"><h2>' + esc(T('c.a.disponibilidad')) + '</h2></div>' +
        '<div class="tarjeta__vacio">' + esc(T('c.a.sinDisponibilidad')) + '</div></div>'
      );
    }

    var nombresDia = DIAS.map(function (d) {
      // Un domingo cualquiera de referencia, y se avanza: así los nombres
      // salen en el idioma puesto sin tener que escribirlos dos veces.
      var base = new Date(2024, 0, 7 + d);
      return base.toLocaleDateString(lang(), { weekday: 'short' });
    });

    var html = '<div class="disponibilidad">';
    html += '<span></span>';
    nombresDia.forEach(function (n) {
      html += '<span class="disponibilidad__dia">' + esc(n) + '</span>';
    });

    FRANJAS.forEach(function (f) {
      html += '<span class="disponibilidad__franja">' + esc(T(f.clave)) + '</span>';
      DIAS.forEach(function (d) {
        var puede = ventanas.some(function (v) {
          if (Number(v.weekday) !== d) return false;
          // Se solapan si empieza antes de que acabe la franja y acaba
          // después de que empiece.
          return horaDe(v.start_time) < f.a && horaDe(v.end_time) > f.de;
        });
        html +=
          '<span class="disponibilidad__celda" aria-pressed="' + (puede ? 'true' : 'false') + '"></span>';
      });
    });
    html += '</div>';

    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.a.disponibilidad')) + '</h2>' +
      '<p>' + esc(T('c.a.disponibilidadSub')) + '</p></div>' +
      '<div class="tarjeta__cuerpo">' + html + '</div></div>'
    );
  }

  /* --- Historial --- */

  var COLOR_ESTADO = { validated: 'ok', pending: 'espera', rejected: 'mal' };
  var TEXTO_ESTADO = {
    validated: 'c.a.eValidated',
    pending: 'c.a.ePending',
    rejected: 'c.a.eRejected',
  };

  function historial(filas) {
    if (!filas || !filas.length) {
      return (
        '<div class="tarjeta">' +
        '<div class="tarjeta__cab"><h2>' + esc(T('c.a.historial')) + '</h2></div>' +
        '<div class="tarjeta__vacio">' + esc(T('c.a.sinHistorial')) + '</div></div>'
      );
    }

    var cuerpo = filas.map(function (f) {
      return (
        '<tr>' +
        '<td><strong>' + esc(f.title) + '</strong>' +
        '<small>' + esc(f.org_name || '') + (f.city ? ' · ' + esc(f.city) : '') + '</small></td>' +
        '<td>' + esc(fecha(f.completed_at)) + '</td>' +
        '<td class="tabla__num">' + esc(numero(f.hours)) + '</td>' +
        '<td><span class="marca marca--' + (COLOR_ESTADO[f.state] || 'espera') + '">' +
        esc(T(TEXTO_ESTADO[f.state] || 'c.a.ePending')) + '</span>' +
        /* El motivo del ajuste o del rechazo se enseña: quien ve que le han
           quitado dos horas tiene que poder leer por qué sin llamar a nadie. */
        (f.note ? '<small>' + esc(f.note) + '</small>' : '') +
        '</td></tr>'
      );
    });

    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.a.historial')) + '</h2>' +
      '<button class="btn btn--ghost btn--small" type="button" id="btn-imprimir">' +
      esc(T('c.i.imprimir')) + '</button></div>' +
      '<div class="tabla-marco"><table class="tabla">' +
      '<thead><tr>' +
      '<th>' + esc(T('c.h.cMision')) + '</th>' +
      '<th>' + esc(T('c.v.cUltima')) + '</th>' +
      '<th class="tabla__num">' + esc(T('c.h.cHoras')) + '</th>' +
      '<th>' + esc(T('c.v.cPapeles')) + '</th>' +
      '</tr></thead><tbody>' + cuerpo.join('') + '</tbody>' +
      '</table></div></div>'
    );
  }

  /* =====================================================================
     ARRANQUE
     ===================================================================== */

  function arrancar(e) {
    var titulo = $('#panel');

    return Promise.all([
      PFP.db.rpc('my_upcoming').catch(function () { return []; }),
      PFP.db.rpc('my_activity').catch(function () { return []; }),
      PFP.db.rpc('my_hours').catch(function () { return []; }),
      PFP.db.rpc('my_skills').catch(function () { return []; }),
      PFP.db
        .select('availability_windows', 'select=weekday,start_time,end_time&order=weekday')
        .catch(function () { return []; }),
    ]).then(function (r) {
      var siguiente = (r[0] || [])[0] || null;
      var a = (r[1] || [])[0] || null;
      var horas = r[2] || [];
      var habilidades = r[3] || [];
      var ventanas = r[4] || [];

      var html = proxima(siguiente);

      if (a) {
        html +=
          '<div class="cifras">' +
          cifra('c.a.kHoras', numero(a.hours_validated) + ' <small>h</small>', '') +
          cifra('c.a.kPendientes', numero(a.hours_pending) + ' <small>h</small>', '') +
          cifra('c.a.kMisiones', numero(a.missions_done, 0), '') +
          cifra('c.a.kEntidades', numero(a.orgs, 0), '') +
          '</div>';
      }

      html += papeles(a, habilidades);
      html += disponibilidad(ventanas);
      html += historial(horas);

      titulo.innerHTML = html;
      if (UI.retraducir) UI.retraducir();

      var imprimir = $('#btn-imprimir');
      if (imprimir) {
        imprimir.addEventListener('click', function () {
          window.print();
        });
      }
    });
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
