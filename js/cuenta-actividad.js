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
  function $$(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
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

  /* --- Lo que no llega se dice --- */

  var falloDeCarga = false;
  var falloDe = {};

  /**
   * Envuelve una consulta que la pantalla puede sobrevivir sin ella.
   *
   * Devuelve una lista vacia para que el pintado siga, pero deja constancia:
   * al final se avisa. La diferencia entre «no tienes horas» y «no he podido
   * preguntar por tus horas» importa mucho cuando de eso sale un
   * certificado.
   */
  function opcional(promesa, nombre) {
    return promesa.catch(function (err) {
      if (!err || err.codigo !== 'sin_sesion') {
        falloDeCarga = true;
        falloDe[nombre] = true;
      }
      return [];
    });
  }

  /** El hueco de una seccion que no se ha podido traer. */
  function seccionCaida(titulo) {
    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T(titulo)) + '</h2></div>' +
      '<div class="tarjeta__vacio">' + esc(T('c.e.noCargado')) + '</div></div>'
    );
  }

  function avisarSiFaltaAlgo() {
    if (falloDeCarga && UI.avisar) UI.avisar('aviso', T('c.e.cargaParcial'), 'error');
  }

  /* ---------------------------------------------------------------------
     Estado de la pantalla
     ---------------------------------------------------------------------
     Se guarda lo cargado para poder repintar sin volver a pedirlo todo tras
     guardar un cambio. `editando` dice qué tarjeta está en modo edición;
     solo una a la vez, porque son dos formularios y tenerlos abiertos juntos
     invita a perder uno de los dos sin enterarse. */

  var yo = null;
  var datos = { resumen: null, proxima: null, horas: [], habilidades: [], ventanas: [] };
  var editando = null;
  var marcadasDisp = {};
  var marcadasHab = {};

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

  /**
   * Las habilidades, para marcar.
   *
   * Mismo aspecto y mismo orden que en el alta: quien ya pasó por allí
   * reconoce la pantalla. La acreditación se marca en la pastilla y no se
   * esconde — hay que saber antes de marcarla que luego habrá que subir un
   * papel desde la app.
   */
  function selectorHabilidades() {
    var catalogo = window.PFP_HABILIDADES || [];
    var porCategoria = {};
    catalogo.forEach(function (h) {
      (porCategoria[h.cat] = porCategoria[h.cat] || []).push(h);
    });

    var idioma = document.documentElement.lang === 'de' ? 'de' : 'es';
    var nombresCat = (window.PFP_CATEGORIAS || {})[idioma] || {};
    var sufijoCred = (window.I18N && window.I18N[idioma] && window.I18N[idioma]['c.vol.acreditacion']) || '';

    var html = '';
    Object.keys(porCategoria).forEach(function (c) {
      html +=
        '<p class="estado__clave" style="margin:14px 0 8px">' + esc(nombresCat[c] || c) + '</p>' +
        '<div class="pastillas">' +
        porCategoria[c].map(function (h) {
          return (
            '<button type="button" class="pastilla" data-hab="' + esc(h.id) + '" ' +
            'aria-pressed="' + (marcadasHab[h.id] ? 'true' : 'false') + '">' +
            esc(h[idioma] || h.es) + (h.cred && sufijoCred ? ' · ' + esc(sufijoCred) : '') +
            '</button>'
          );
        }).join('') +
        '</div>';
    });

    return html;
  }

  function guardarHabilidades(boton) {
    UI.limpiarAvisos();
    UI.ocupado(boton, true);

    var ids = Object.keys(marcadasHab).filter(function (k) { return marcadasHab[k]; });
    var mio = 'profile_id=eq.' + encodeURIComponent(yo);

    /* Reemplazo completo, igual que en el alta y en la app. Se pierde el
       estado de acreditación de una habilidad que se desmarque, y es lo
       correcto: si ya no la tienes puesta, su papel tampoco acredita nada. */
    PFP.db
      .delete('volunteer_skills', mio)
      .then(function () {
        if (!ids.length) return null;
        return PFP.db.insert(
          'volunteer_skills',
          ids.map(function (id) {
            return { profile_id: yo, skill_id: id, credential_status: 'none' };
          }),
        );
      })
      .then(function () {
        return PFP.db.rpc('my_skills');
      })
      .then(function (h) {
        datos.habilidades = h || [];
        editando = null;
        repintar();
        UI.avisar('aviso', T('c.a.guardado'), 'ok');
      })
      .catch(function (err) {
        UI.ocupado(boton, false);
        UI.avisar('aviso', UI.explicar(err), 'error');
      });
  }

  function papeles(a, habilidades) {
    var edita = editando === 'habilidades';
    var hayHab = (habilidades || []).length > 0;

    var accion = edita
      ? '<span class="cola__acciones">' +
        '<button class="btn btn--primary btn--small" type="button" id="hab-guardar">' +
        esc(T('c.a.guardar')) + '</button>' +
        '<button class="btn btn--ghost btn--small" type="button" id="hab-cancelar">' +
        esc(T('c.a.cancelar')) + '</button></span>'
      : '<button class="btn btn--' + (hayHab ? 'ghost' : 'primary') + ' btn--small" type="button" ' +
        'id="hab-editar">' + esc(T(hayHab ? 'c.a.cambiar' : 'c.a.rellenar')) + '</button>';

    if (edita) {
      return (
        '<div class="tarjeta" id="tarjeta-papeles">' +
        '<div class="tarjeta__cab"><div><h2>' + esc(T('c.a.habilidades')) + '</h2>' +
        '<p>' + esc(T('c.a.habSub')) + '</p></div>' + accion + '</div>' +
        '<div class="tarjeta__cuerpo">' + selectorHabilidades() + '</div></div>'
      );
    }

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

    if (!hayHab) {
      filas.push(
        '<li><span><strong>' + esc(T('c.a.habilidades')) + '</strong>' +
        '<small>' + esc(T('c.a.sinHabilidades')) + '</small></span>' +
        '<span class="marca marca--espera">' + esc(T('c.a.sinRellenar')) + '</span></li>',
      );
    }

    return (
      '<div class="tarjeta" id="tarjeta-papeles">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.a.papeles')) + '</h2>' + accion + '</div>' +
      '<ul class="lista-estado">' + filas.join('') + '</ul>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------------------
     Lo que falta por rellenar
     ---------------------------------------------------------------------
     Arriba del todo y solo cuando hay algo. Cada línea lleva su botón al
     sitio donde se arregla: decir «no has indicado cuándo puedes» sin dar
     dónde hacerlo es dar trabajo en vez de resolverlo. */

  function pendientes() {
    var falta = [];

    if (!datos.ventanas.length) {
      falta.push({ icono: '🗓️', clave: 'c.a.faltaDisp', sub: 'c.a.faltaDispSub', va: 'disponibilidad' });
    }
    if (!datos.habilidades.length) {
      falta.push({ icono: '🧰', clave: 'c.a.faltaHab', sub: 'c.a.faltaHabSub', va: 'habilidades' });
    }
    if (datos.perfilIncompleto) {
      falta.push({ icono: '👤', clave: 'c.a.faltaPerfil', sub: 'c.a.faltaPerfilSub', href: 'voluntario.html' });
    }
    /* El seguro va sin botón a propósito: hoy no hay ningún sitio en el
       producto donde declararlo — lo aporta la entidad. Un botón que no
       lleva a nada es peor que decir la verdad. */
    if (datos.resumen && !datos.resumen.insurance_until) {
      falta.push({ icono: '🛡️', clave: 'c.a.faltaSeguro', sub: 'c.a.faltaSeguroSub' });
    }

    if (!falta.length) return '';

    return (
      '<div class="tarjeta">' +
      '<div class="tarjeta__cab"><h2>' + esc(T('c.a.falta')) + '</h2></div>' +
      '<ul class="cola">' +
      falta.map(function (f) {
        var boton = f.va
          ? '<button class="btn btn--primary btn--small" type="button" data-ira="' + f.va + '">' +
            esc(T('c.a.rellenar')) + '</button>'
          : f.href
          ? '<a class="btn btn--primary btn--small" href="' + f.href + '">' +
            esc(T('c.a.rellenar')) + '</a>'
          : '';

        return (
          '<li class="cola__fila">' +
          '<span class="cola__marca" aria-hidden="true">' + f.icono + '</span>' +
          '<span class="cola__texto"><strong>' + esc(T(f.clave)) + '</strong>' +
          '<span>' + esc(T(f.sub)) + '</span></span>' +
          (boton ? '<span class="cola__acciones">' + boton + '</span>' : '') +
          '</li>'
        );
      }).join('') +
      '</ul></div>'
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

  /** Los días de la semana en el idioma puesto, empezando en lunes. */
  function nombresDeDia() {
    return DIAS.map(function (d) {
      // Un domingo de referencia y se avanza: así salen traducidos sin
      // escribirlos dos veces.
      return new Date(2024, 0, 7 + d).toLocaleDateString(lang(), { weekday: 'short' });
    });
  }

  /** ¿Cubre alguna ventana esta franja de este día? */
  function cubierta(ventanas, dia, franja) {
    return (ventanas || []).some(function (v) {
      if (Number(v.weekday) !== dia) return false;
      // Se solapan si empieza antes de que acabe la franja y acaba después
      // de que empiece.
      return horaDe(v.start_time) < franja.a && horaDe(v.end_time) > franja.de;
    });
  }

  function rejilla(interactiva) {
    var html = '<div class="disponibilidad">' + '<span></span>';
    nombresDeDia().forEach(function (n) {
      html += '<span class="disponibilidad__dia">' + esc(n) + '</span>';
    });

    FRANJAS.forEach(function (f, i) {
      html += '<span class="disponibilidad__franja">' + esc(T(f.clave)) + '</span>';
      DIAS.forEach(function (d) {
        var clave = d + '-' + i;
        var puesta = interactiva
          ? !!marcadasDisp[clave]
          : cubierta(datos.ventanas, d, f);

        html += interactiva
          ? '<button type="button" class="disponibilidad__celda" data-franja="' + clave + '" ' +
            'aria-pressed="' + (puesta ? 'true' : 'false') + '" ' +
            'aria-label="' + esc(nombresDeDia()[DIAS.indexOf(d)] + ', ' + T(f.clave)) + '"></button>'
          : '<span class="disponibilidad__celda" aria-pressed="' + (puesta ? 'true' : 'false') + '"></span>';
      });
    });

    return html + '</div>';
  }

  function disponibilidad() {
    var hay = datos.ventanas && datos.ventanas.length;
    var edita = editando === 'disponibilidad';

    var accion = edita
      ? '<span class="cola__acciones">' +
        '<button class="btn btn--primary btn--small" type="button" id="disp-guardar">' +
        esc(T('c.a.guardar')) + '</button>' +
        '<button class="btn btn--ghost btn--small" type="button" id="disp-cancelar">' +
        esc(T('c.a.cancelar')) + '</button></span>'
      : '<button class="btn btn--' + (hay ? 'ghost' : 'primary') + ' btn--small" type="button" ' +
        'id="disp-editar">' + esc(T(hay ? 'c.a.cambiar' : 'c.a.rellenar')) + '</button>';

    var cuerpo;
    if (edita) {
      cuerpo =
        '<p class="field__hint" style="margin:0 0 var(--s-md)">' + esc(T('c.a.dispAviso')) + '</p>' +
        rejilla(true);
    } else if (hay) {
      cuerpo = rejilla(false);
    } else {
      cuerpo = '<p class="field__hint" style="margin:0">' + esc(T('c.a.sinDisponibilidad')) + '</p>';
    }

    return (
      '<div class="tarjeta" id="tarjeta-disponibilidad">' +
      '<div class="tarjeta__cab"><div><h2>' + esc(T('c.a.disponibilidad')) + '</h2>' +
      '<p>' + esc(T('c.a.disponibilidadSub')) + '</p></div>' + accion + '</div>' +
      '<div class="tarjeta__cuerpo">' + cuerpo + '</div></div>'
    );
  }

  /**
   * De franjas marcadas a ventanas.
   *
   * Las franjas seguidas del mismo día se juntan en una sola ventana: quien
   * marca mañana y tarde puede de seis a ocho, no en dos tramos con un corte
   * ficticio a las dos.
   */
  function ventanasDesdeMarcas() {
    var filas = [];

    DIAS.forEach(function (d) {
      var abierta = null;

      FRANJAS.forEach(function (f, i) {
        if (marcadasDisp[d + '-' + i]) {
          if (!abierta) abierta = { de: f.de, a: f.a };
          else abierta.a = f.a;
        } else if (abierta) {
          filas.push({ weekday: d, de: abierta.de, a: abierta.a });
          abierta = null;
        }
      });

      if (abierta) filas.push({ weekday: d, de: abierta.de, a: abierta.a });
    });

    return filas.map(function (f) {
      return {
        profile_id: yo,
        weekday: f.weekday,
        start_time: String(f.de).padStart(2, '0') + ':00:00',
        // Las 24:00 no son una hora válida; el final del día son las 23:59.
        end_time: f.a >= 24 ? '23:59:00' : String(f.a).padStart(2, '0') + ':00:00',
      };
    });
  }

  function guardarDisponibilidad(boton) {
    UI.limpiarAvisos();
    UI.ocupado(boton, true);

    var nuevas = ventanasDesdeMarcas();
    var mio = 'profile_id=eq.' + encodeURIComponent(yo);

    /* Reemplazo completo, igual que en la app: son pocas filas y así lo
       guardado coincide siempre con lo que se está viendo. */
    PFP.db
      .delete('availability_windows', mio)
      .then(function () {
        return nuevas.length ? PFP.db.insert('availability_windows', nuevas) : null;
      })
      .then(function () {
        return PFP.db.select(
          'availability_windows',
          'select=weekday,start_time,end_time&order=weekday',
        );
      })
      .then(function (v) {
        datos.ventanas = v || [];
        editando = null;
        repintar();
        UI.avisar('aviso', T('c.a.guardado'), 'ok');
      })
      .catch(function (err) {
        UI.ocupado(boton, false);
        UI.avisar('aviso', UI.explicar(err), 'error');
      });
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

  /**
   * Pinta la pantalla entera desde `datos`.
   *
   * Se repinta todo y no solo la tarjeta que cambia: al guardar la
   * disponibilidad desaparece su línea de «te falta», y esa está arriba del
   * todo. Son cuatro tarjetas; repintarlas cuesta menos que llevar la cuenta
   * de qué depende de qué.
   */
  function repintar() {
    var caja = $('#panel');

    var html = falloDe.proxima ? seccionCaida('c.a.proxima') : proxima(datos.proxima);

    html += pendientes();

    if (datos.resumen) {
      var a = datos.resumen;
      html +=
        '<div class="cifras">' +
        cifra('c.a.kHoras', numero(a.hours_validated) + ' <small>h</small>', '') +
        cifra('c.a.kPendientes', numero(a.hours_pending) + ' <small>h</small>', '') +
        cifra('c.a.kMisiones', numero(a.missions_done, 0), '') +
        cifra('c.a.kEntidades', numero(a.orgs, 0), '') +
        '</div>';
    }

    /* Los papeles solo se pintan si el resumen llegó. `my_activity` es una
       consulta agregada: siempre devuelve una fila, así que una lista vacía
       solo puede ser un fallo, y con ella pintaríamos «Sin seguro» a quien
       lo tiene al día. */
    if (datos.resumen) html += papeles(datos.resumen, datos.habilidades);

    html += falloDe.disponibilidad ? seccionCaida('c.a.disponibilidad') : disponibilidad();
    html += falloDe.historial ? seccionCaida('c.a.historial') : historial(datos.horas);

    caja.innerHTML = html;
    if (UI.retraducir) UI.retraducir();
    enganchar();
  }

  /* ---------------------------------------------------------------------
     Enganches
     ---------------------------------------------------------------------
     Se vuelven a poner en cada repintado porque el HTML se rehace entero.
     Es lo más simple que no deja escuchadores viejos apuntando a nodos que
     ya no existen. */

  function enganchar() {
    var imprimir = $('#btn-imprimir');
    if (imprimir) imprimir.addEventListener('click', function () { window.print(); });

    /* --- Ir a rellenar algo desde la tarjeta de pendientes --- */
    $$('[data-ira]').forEach(function (b) {
      b.addEventListener('click', function () {
        abrirEditor(b.dataset.ira);
      });
    });

    /* --- Disponibilidad --- */
    var dispEditar = $('#disp-editar');
    if (dispEditar) dispEditar.addEventListener('click', function () { abrirEditor('disponibilidad'); });

    var dispCancelar = $('#disp-cancelar');
    if (dispCancelar) dispCancelar.addEventListener('click', function () { editando = null; repintar(); });

    var dispGuardar = $('#disp-guardar');
    if (dispGuardar) dispGuardar.addEventListener('click', function () { guardarDisponibilidad(this); });

    $$('[data-franja]').forEach(function (c) {
      c.addEventListener('click', function () {
        var puesta = c.getAttribute('aria-pressed') === 'true';
        marcadasDisp[c.dataset.franja] = !puesta;
        c.setAttribute('aria-pressed', puesta ? 'false' : 'true');
      });
    });

    /* --- Habilidades --- */
    var habEditar = $('#hab-editar');
    if (habEditar) habEditar.addEventListener('click', function () { abrirEditor('habilidades'); });

    var habCancelar = $('#hab-cancelar');
    if (habCancelar) habCancelar.addEventListener('click', function () { editando = null; repintar(); });

    var habGuardar = $('#hab-guardar');
    if (habGuardar) habGuardar.addEventListener('click', function () { guardarHabilidades(this); });

    $$('[data-hab]').forEach(function (b) {
      b.addEventListener('click', function () {
        var puesta = b.getAttribute('aria-pressed') === 'true';
        marcadasHab[b.dataset.hab] = !puesta;
        b.setAttribute('aria-pressed', puesta ? 'false' : 'true');
      });
    });
  }

  /**
   * Abre un editor con lo que hay ahora ya marcado.
   *
   * La selección se rellena AQUÍ y no al pintar: si se recalculara en cada
   * repintado, marcar una casilla y que el navegador repintara por cualquier
   * motivo borraría lo que se acaba de tocar.
   */
  function abrirEditor(cual) {
    if (cual === 'disponibilidad') {
      marcadasDisp = {};
      DIAS.forEach(function (d) {
        FRANJAS.forEach(function (f, i) {
          if (cubierta(datos.ventanas, d, f)) marcadasDisp[d + '-' + i] = true;
        });
      });
    } else if (cual === 'habilidades') {
      marcadasHab = {};
      datos.habilidades.forEach(function (h) { marcadasHab[h.skill_id] = true; });
    }

    editando = cual;
    repintar();

    var tarjeta = $('#tarjeta-' + (cual === 'disponibilidad' ? 'disponibilidad' : 'papeles'));
    if (tarjeta) tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* =====================================================================
     CARGA
     ===================================================================== */

  function arrancar(e) {
    yo = e.perfil.id;
    datos.perfilIncompleto = !e.perfil.onboarding_complete;

    return Promise.all([
      opcional(PFP.db.rpc('my_upcoming'), 'proxima'),
      opcional(PFP.db.rpc('my_activity'), 'resumen'),
      opcional(PFP.db.rpc('my_hours'), 'historial'),
      opcional(PFP.db.rpc('my_skills'), 'habilidades'),
      opcional(
        PFP.db.select('availability_windows', 'select=weekday,start_time,end_time&order=weekday'),
        'disponibilidad',
      ),
    ]).then(function (r) {
      datos.proxima = (r[0] || [])[0] || null;
      datos.resumen = (r[1] || [])[0] || null;
      datos.horas = r[2] || [];
      datos.habilidades = r[3] || [];
      datos.ventanas = r[4] || [];

      repintar();
      avisarSiFaltaAlgo();
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
