/* ==========================================================================
   El panel de la consola
   --------------------------------------------------------------------------
   Dos pantallas en un archivo porque son la misma pregunta —«¿que tengo que
   hacer?»— contestada a dos personas distintas:

     · A quien coordina una entidad se le abre por lo que ESPERA RESPUESTA.
       Las cifras van despues. Nadie entra aqui a mirar cuantas horas lleva
       su entidad: entra a resolver lo que se ha quedado a medias, y si eso
       hay que buscarlo debajo de cuatro numeros, no se resuelve.

     · A quien es voluntaria se le abre por lo unico que tiene hora y sitio:
       su proxima mision.

   Ningun dato de aqui se calcula en el navegador. `org_dashboard` viene
   resuelto del servidor en una sola consulta —seis peticiones sueltas para
   pintar cuatro numeros dejan la pantalla parpadeando— y quien puede verlo
   lo decide esa misma funcion, no este guion.
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

  /** Sustituye {n}, {a}, {b}, {d} en un texto del diccionario. */
  function con(clave, valores) {
    var t = T(clave);
    for (var k in valores) t = t.split('{' + k + '}').join(valores[k]);
    return t;
  }

  /** Singular o plural, que «1 solicitudes» se lee fatal. */
  function plural(base, n) {
    return n === 1 ? T(base + '1') : con(base, { n: n });
  }

  /* Las horas se enseñan con un decimal como mucho: «12,5 h» dice lo mismo
     que «12,50 h» y se lee antes. */
  function horas(n) {
    var v = Number(n || 0);
    var lang = document.documentElement.lang || 'es';
    return v.toLocaleString(lang === 'de' ? 'de-DE' : 'es-ES', {
      maximumFractionDigits: 1,
    });
  }

  function fecha(iso, conHora) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var lang = document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES';
    var opciones = { day: 'numeric', month: 'short' };
    if (conHora) {
      opciones.hour = '2-digit';
      opciones.minute = '2-digit';
    }
    return d.toLocaleDateString(lang, opciones);
  }

  function pinta(html) {
    var caja = $('#panel');
    if (caja) caja.innerHTML = html;
    if (UI.retraducir) UI.retraducir();
  }

  /* --- Lo que no llega se dice --- */

  var falloDeCarga = false;

  /**
   * Envuelve una consulta que la pantalla puede sobrevivir sin ella.
   *
   * Devuelve una lista vacia para que el pintado siga, pero deja constancia:
   * al final se avisa. La diferencia entre «no tienes horas» y «no he podido
   * preguntar por tus horas» importa mucho cuando de eso sale un
   * certificado.
   */
  function opcional(promesa) {
    return promesa.catch(function (err) {
      if (!err || err.codigo !== 'sin_sesion') falloDeCarga = true;
      return [];
    });
  }

  function avisarSiFaltaAlgo() {
    if (falloDeCarga && UI.avisar) UI.avisar('aviso', T('c.e.cargaParcial'), 'error');
  }

  /* =====================================================================
     ENTIDAD
     ===================================================================== */

  /**
   * Una fila de la cola.
   *
   * `urgente` solo cambia el color del cuadro de la izquierda. Se reserva
   * para lo que tiene fecha —una mision a medio cubrir que empieza pasado
   * mañana—: si todo fuera urgente, no lo seria nada.
   */
  function filaCola(icono, titulo, detalle, destino, urgente) {
    return (
      '<li class="cola__fila">' +
      '<span class="cola__marca' + (urgente ? ' cola__marca--urgente' : '') + '" aria-hidden="true">' + icono + '</span>' +
      '<span class="cola__texto"><strong>' + esc(titulo) + '</strong>' +
      '<span>' + esc(detalle) + '</span></span>' +
      '<span class="cola__acciones">' +
      '<a class="btn btn--ghost btn--small" href="' + destino + '">' + esc(T('c.p.resolver')) + '</a>' +
      '</span></li>'
    );
  }

  function pintarCola(d) {
    var filas = [];

    if (d.join_requests > 0) {
      filas.push(filaCola('👤', plural('c.p.solicitudes', d.join_requests),
        T('c.p.solicitudesSub'), 'voluntariado.html#solicitudes', false));
    }
    if (d.hours_pending > 0) {
      filas.push(filaCola('🕒', plural('c.p.horasPend', d.hours_pending),
        T('c.p.horasPendSub'), 'horas.html', false));
    }
    if (d.missions_understaffed > 0) {
      filas.push(filaCola('⚠️', plural('c.p.cortas', d.missions_understaffed),
        T('c.p.cortasSub'), '#proximas', true));
    }
    if (d.people_docs_bad > 0) {
      filas.push(filaCola('📄', plural('c.p.papeles', d.people_docs_bad),
        T('c.p.papelesSub'), 'voluntariado.html?filtro=revisar', false));
    }

    if (!filas.length) {
      return (
        '<div class="tarjeta"><div class="tarjeta__vacio">' +
        '<strong>' + esc(T('c.p.alDia')) + '</strong>' +
        esc(T('c.p.alDiaSub')) +
        '</div></div>'
      );
    }

    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.p.espera')) + '</h2></div>' +
      '<ul class="cola">' + filas.join('') + '</ul>' +
      '</div>'
    );
  }

  function cifra(clave, valor, pie) {
    return (
      '<div class="cifra">' +
      '<span class="cifra__clave">' + esc(T(clave)) + '</span>' +
      '<span class="cifra__valor">' + valor + '</span>' +
      '<span class="cifra__pie">' + esc(pie) + '</span>' +
      '</div>'
    );
  }

  function pintarCifras(d) {
    var alDia = d.people - d.people_docs_bad;

    return (
      '<div class="cifras">' +
      cifra('c.p.kPersonas', d.people,
        d.join_requests ? con('c.p.deAltas', { n: d.join_requests }) : T('c.p.deAltasOk')) +
      cifra('c.p.kHoras', horas(d.hours_30d) + ' <small>h</small>',
        d.hours_pending ? con('c.p.deHoras', { n: d.hours_pending }) : T('c.p.deHorasOk')) +
      cifra('c.p.kMisiones', d.missions_open,
        d.missions_understaffed ? con('c.p.deMisiones', { n: d.missions_understaffed }) : T('c.p.deMisionesOk')) +
      cifra('c.p.kPapeles', alDia + ' <small>/ ' + d.people + '</small>',
        d.people_docs_bad ? con('c.p.dePersonas', { n: d.people_docs_bad }) : T('c.p.dePersonasOk')) +
      '</div>'
    );
  }

  /** El estado de la entidad: verificacion, plan y —si toca— la referencia. */
  function pintarEstado(e) {
    var org = e.organizacion;
    var plan = e.plan;

    var marcaVer = org.verificada
      ? '<span class="marca marca--ok">' + esc(T('c.mi.verificada')) + '</span>'
      : '<span class="marca marca--espera">' + esc(T('c.mi.enRevision')) + '</span>';

    var marcaPlan = plan
      ? '<span class="marca marca--' + ((UI.COLOR_PLAN || {})[plan.status] || 'espera') + '">' +
        esc(T('c.plan.' + plan.status)) + '</span>'
      : '<span class="marca marca--espera">' + esc(T('c.mi.sinPlan')) + '</span>';

    var extra = '';

    /* La referencia del ingreso se enseña aqui y no solo al contratar: es lo
       unico que permite casar un pago con quien lo hizo, y quien cerro la
       pestaña aquel dia se quedo sin ella. */
    if (plan && plan.status === 'pending_payment' && plan.reference) {
      extra =
        '<div class="dato dato--destacado" style="margin-top:var(--s-base)">' +
        '<span><span class="dato__clave">' + esc(T('c.mi.concepto')) + '</span>' +
        '<span class="dato__valor">' + esc(plan.reference) + '</span></span>' +
        '<button class="dato__copiar" type="button" data-copiar="' + esc(plan.reference) + '">' +
        esc(T('c.mi.copiar')) + '</button></div>';
    }

    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.p.entidad')) + '</h2>' +
      '<a class="enlace-mas" href="organizacion.html">' + esc(T('c.mi.editar')) + '</a></div>' +
      '<div class="tarjeta__cuerpo">' +
      '<div class="estado">' +
      '<div class="estado__fila"><span class="estado__clave">' + esc(T('c.mi.verificacion')) + '</span>' +
      '<span class="estado__valor">' + marcaVer + '</span></div>' +
      '<div class="estado__fila"><span class="estado__clave">' + esc(T('c.mi.plan')) + '</span>' +
      '<span class="estado__valor">' + marcaPlan + '</span></div>' +
      '</div>' + extra +
      '</div></div>'
    );
  }

  function pintarProximas(misiones) {
    if (!misiones.length) {
      return (
        '<div class="tarjeta" id="proximas">' +
        '<div class="tarjeta__cab"><h2>' + esc(T('c.p.proximas')) + '</h2></div>' +
        '<div class="tarjeta__vacio">' + esc(T('c.p.sinProximas')) + '</div></div>'
      );
    }

    var filas = misiones.map(function (m) {
      var total = m.total_slots || 0;
      var puestas = m.filled_slots || 0;
      var pct = total ? Math.min(100, Math.round((puestas / total) * 100)) : 0;
      // Corta cuando no llega a la mitad: es el mismo criterio que usa el
      // servidor para contarlas, y dos umbrales distintos para lo mismo
      // acabarian contradiciendose en la pantalla.
      var corta = total > 0 && puestas * 2 < total;

      return (
        '<li>' +
        '<div><strong>' + esc(m.title) + '</strong>' +
        '<small>' + esc(fecha(m.starts_at, true)) + ' · ' + esc(m.city || '') + '</small></div>' +
        '<span class="ocupacion">' +
        '<span class="ocupacion__barra"><span class="ocupacion__relleno" ' +
        'style="width:' + pct + '%" data-corta="' + (corta ? 'true' : 'false') + '"></span></span>' +
        '<span class="ocupacion__cifra">' + esc(con('c.p.plazas', { a: puestas, b: total })) + '</span>' +
        '</span></li>'
      );
    });

    return (
      '<div class="tarjeta" id="proximas">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.p.proximas')) + '</h2></div>' +
      '<ul class="lista-estado">' + filas.join('') + '</ul>' +
      '</div>'
    );
  }

  function pintarEntidadSinAlta(e) {
    pinta(
      '<div class="tarjeta"><div class="tarjeta__cuerpo">' +
      '<div class="estado"><div class="estado__fila">' +
      '<span class="estado__clave">' + esc(T('c.mi.tipoCuenta')) + '</span>' +
      '<span class="estado__valor">' + esc(T('c.mi.entidad')) +
      '<small>' + esc(e.perfil.email) + '</small></span></div></div>' +
      '<p class="field__hint" style="margin-top:var(--s-base)">' + esc(T('c.mi.sinEntidad')) + '</p>' +
      '<a class="btn btn--primary" href="organizacion.html" style="margin-top:var(--s-md)">' +
      esc(T('c.mi.darAlta')) + '</a>' +
      '</div></div>',
    );
  }

  function panelEntidad(e) {
    var org = e.organizacion;
    if (!org) return pintarEntidadSinAlta(e);

    /* Las tres se piden a la vez: son independientes y encadenarlas
       triplicaria la espera sin ganar nada. */
    return Promise.all([
      opcional(PFP.db.rpc('org_dashboard', { p_org: org.id })),
      opcional(PFP.db.rpc('org_upcoming_missions', { p_org: org.id, p_limit: 5 })),
      opcional(PFP.db.rpc('my_emergency')),
    ]).then(function (r) {
      var d = (r[0] && r[0][0]) || null;
      var misiones = r[1] || [];
      var emer = (r[2] && r[2][0]) || null;

      var html = '';

      if (emer) {
        html +=
          '<div class="emergencia">' +
          '<span class="emergencia__punto" aria-hidden="true"></span>' +
          '<strong>' + esc(T('c.p.emergencia')) + '</strong>' +
          '<span class="emergencia__texto">' + esc(emer.headline || emer.province || '') + '</span>' +
          '</div>';
      }

      /* Sin `d` es que el servidor no ha dejado ver el panel: quien no
         administra la entidad ve su estado y sus mensajes, no las cifras de
         todo el mundo. No es un error, asi que no se pinta como tal. */
      if (d) {
        html += pintarCola(d) + pintarCifras(d);
      }

      html += pintarEstado(e);

      if (d) html += pintarProximas(misiones);

      pinta(html);
      avisarSiFaltaAlgo();

      var boton = document.querySelector('[data-copiar]');
      if (boton) {
        boton.addEventListener('click', function () {
          navigator.clipboard.writeText(boton.dataset.copiar).then(function () {
            boton.textContent = T('c.mi.copiado');
            setTimeout(function () {
              boton.textContent = T('c.mi.copiar');
            }, 1800);
          });
        });
      }
    });
  }

  /* =====================================================================
     VOLUNTARIADO
     ===================================================================== */

  function pintarProxima(m) {
    if (!m) {
      return (
        '<div class="tarjeta"><div class="tarjeta__vacio">' +
        '<strong>' + esc(T('c.a.sinProxima')) + '</strong>' +
        esc(T('c.a.sinProximaSub')) +
        '</div></div>'
      );
    }

    var donde = [m.meeting_point, m.street, m.city].filter(Boolean).join(' · ');

    return (
      '<div class="proxima">' +
      '<span class="proxima__clave">' + esc(T('c.a.proxima')) + '</span>' +
      '<h2>' + esc(m.title) + '</h2>' +
      '<div class="proxima__datos">' +
      '<span>' + esc(fecha(m.starts_at, true)) + '</span>' +
      (donde ? '<span>' + esc(donde) + '</span>' : '') +
      (m.org_name ? '<span>' + esc(m.org_name) + '</span>' : '') +
      '</div>' +
      /* Sin botones de «voy de camino» a proposito: confirmar llegada se
         hace donde esta el GPS y las notificaciones, que es la app. Un boton
         aqui que solo escribiera el estado invitaria a fiarse de la web para
         algo que en una emergencia se resuelve con el movil en la mano. */
      '<div class="proxima__acciones">' +
      '<a class="btn btn--ghost btn--small" href="actividad.html">' + esc(T('c.nav.actividad')) + '</a>' +
      '</div></div>'
    );
  }

  function panelVoluntario() {
    var titulo = $('#pantalla-sub');
    if (titulo) {
      titulo.textContent = T('c.p.subVol');
      titulo.removeAttribute('data-i18n');
    }

    return Promise.all([
      opcional(PFP.db.rpc('my_upcoming')),
      opcional(PFP.db.rpc('my_activity')),
    ]).then(function (r) {
      var proximas = r[0] || [];
      var a = (r[1] && r[1][0]) || null;

      var html = pintarProxima(proximas[0] || null);

      if (a) {
        html +=
          '<div class="cifras">' +
          cifra('c.a.kHoras', horas(a.hours_validated) + ' <small>h</small>',
            a.hours_pending > 0 ? con('c.p.deHoras', { n: horas(a.hours_pending) }) : T('c.p.deHorasOk')) +
          cifra('c.a.kMisiones', a.missions_done || 0, T('c.a.eValidated')) +
          cifra('c.a.kEntidades', a.orgs || 0, '') +
          '</div>';
      }

      pinta(html);
      avisarSiFaltaAlgo();
    });
  }

  /* =====================================================================
     ARRANQUE
     ===================================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    if (!PFP.configurado) return;

    PFP.consola
      .montar()
      .then(function (e) {
        var esEntidad = e.perfil.role === 'organization' || !!e.organizacion;
        return esEntidad ? panelEntidad(e) : panelVoluntario(e);
      })
      .catch(function (err) {
        if (err && err.codigo === 'sin_sesion') return;
        if (UI.avisar) UI.avisar('aviso', UI.explicar(err), 'error');
        pinta('');
      });
  });
})();
