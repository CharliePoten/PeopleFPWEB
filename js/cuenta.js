/* ==========================================================================
   Área de cuenta
   --------------------------------------------------------------------------
   Un solo guion para todas las páginas de `/cuenta`. Cada una se identifica
   con `data-pagina` en el `<body>` y aquí se le engancha su controlador; lo
   común —avisos, bloqueos, guardia de sesión— se escribe una vez.

   Nada de esto decide nada importante. Quién puede leer qué, cuánto cuesta
   un plan y si una entidad está verificada lo resuelve el servidor con sus
   políticas y sus funciones, exactamente igual que para la app. Lo de aquí
   es la pantalla.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  if (!PFP) return;

  /* ---------------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------------- */

  function $(sel, raiz) {
    return (raiz || document).querySelector(sel);
  }
  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }

  /** Mensajes por código de error. Los mismos códigos que usa la app. */
  /* Los mensajes viven en el diccionario, como el resto. Se resuelven por
     el codigo del error, que es igual en la web y en la app. */
  var CODIGOS = [
    'invalid_credentials', 'email_taken', 'weak_password', 'email_not_confirmed',
    'invalid_code', 'rate_limited', 'network', 'sin_sesion', 'unknown',
  ];

  function explicar(e) {
    var c = e && e.codigo;
    if (c && CODIGOS.indexOf(c) !== -1) return T('c.e.' + c);
    return (e && e.message) || T('c.e.unknown');
  }

  function avisar(id, texto, tipo) {
    var caja = $('#' + id);
    if (!caja) return;
    caja.textContent = texto || '';
    caja.className = 'aviso aviso--' + (tipo || 'error');
    caja.setAttribute('data-visible', texto ? 'true' : 'false');
    if (texto) caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function limpiarAvisos() {
    $$('.aviso').forEach(function (a) {
      a.setAttribute('data-visible', 'false');
    });
  }

  /** Bloquea un botón mientras dura una operación, y le cambia el texto. */
  function ocupado(boton, si, textoOcupado) {
    if (!boton) return;
    if (si) {
      boton.dataset.textoOriginal = boton.dataset.textoOriginal || boton.textContent;
      boton.textContent = textoOcupado || T('c.espera');
      boton.disabled = true;
    } else {
      if (boton.dataset.textoOriginal) boton.textContent = boton.dataset.textoOriginal;
      boton.disabled = false;
    }
  }

  /** Ruta relativa dentro del área de cuenta, sirva donde sirva el sitio. */
  function ir(destino) {
    window.location.href = destino;
  }

  /* El correo entre pantallas viaja por `sessionStorage` y no por la URL.
     Una dirección de correo en la barra del navegador acaba en el historial
     y en cualquier registro por el que pase el enlace. */
  var CLAVE_CORREO = 'pfp.correoPendiente';

  function guardarCorreo(email) {
    try {
      sessionStorage.setItem(CLAVE_CORREO, email);
    } catch (e) {}
  }
  function correoPendiente() {
    try {
      return sessionStorage.getItem(CLAVE_CORREO) || '';
    } catch (e) {
      return '';
    }
  }

  /* ---------------------------------------------------------------------
     Idioma
     --------------------------------------------------------------------- */

  /**
   * Texto por clave, en el idioma que este puesto.
   *
   * Para lo que genera el JavaScript. Lo que ya existe en el HTML lleva
   * `data-i18n` y lo traduce `site.js` solo.
   */
  function T(clave) {
    var lang = document.documentElement.lang || 'es';
    var d = (window.I18N && window.I18N[lang]) || {};
    if (clave in d) return d[clave];
    var es = (window.I18N && window.I18N.es) || {};
    return clave in es ? es[clave] : clave;
  }

  /**
   * Vuelve a traducir lo que se creo desde JavaScript.
   *
   * `site.js` solo sabe de `data-i18n`, que se resuelve una vez. Los
   * elementos que se construyen aqui con texto de dos idiomas —las
   * habilidades, los nombres de los planes— guardan las dos versiones en
   * `data-es` y `data-de`, y esto las cambia al pulsar el boton de idioma.
   * Sin ello habria que recargar, y quien estuviera a medio rellenar el
   * formulario perderia lo escrito.
   */
  function retraducir() {
    var lang = document.documentElement.lang || 'es';
    $$('[data-es][data-de]').forEach(function (el) {
      var t = el.getAttribute('data-' + lang);
      if (t) el.textContent = t;
    });
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('.lang [data-lang]') : null;
    // Despues de que `site.js` haya hecho lo suyo con el mismo clic.
    if (b) setTimeout(retraducir, 0);
  });

  /* ---------------------------------------------------------------------
     Perfil de quien ha entrado
     --------------------------------------------------------------------- */

  /**
   * Perfil, organización y plan de quien ha entrado.
   *
   * Las mismas consultas que hace la app, no unas nuevas: `profiles`
   * filtrado por RLS a tu propia fila, `organization_members` con el join
   * a `organizations`, y la función `my_subscription`. Inventar aquí un
   * atajo distinto sería tener dos definiciones de «cuál es mi entidad»
   * que se irían separando con el tiempo.
   */
  function cargarEstado() {
    return PFP.db
      .select('profiles', 'select=id,email,full_name,role,onboarding_complete&limit=1')
      .then(function (filas) {
        var perfil = filas && filas[0];
        if (!perfil) throw PFP.error('sin_sesion');

        return PFP.db
          .select(
            'organization_members',
            'select=organization_id,organizations!inner(display_name,kind,verified_at)' +
              '&profile_id=eq.' +
              encodeURIComponent(perfil.id) +
              '&limit=1',
          )
          .catch(function () {
            return [];
          })
          .then(function (miembros) {
            var m = miembros && miembros[0];
            if (!m) return { perfil: perfil, organizacion: null, plan: null };

            var org = {
              id: m.organization_id,
              nombre: m.organizations.display_name,
              tipo: m.organizations.kind,
              verificada: m.organizations.verified_at !== null,
            };

            return PFP.db
              .rpc('my_subscription', { p_org: org.id })
              .catch(function () {
                return [];
              })
              .then(function (subs) {
                return { perfil: perfil, organizacion: org, plan: (subs && subs[0]) || null };
              });
          });
      });
  }

  /**
   * Exige sesión para ver la página.
   *
   * Redirige a entrar y deja anotado a dónde volver: quien pulsa «mi
   * cuenta» desde el correo y no tiene sesión, tras entrar aterriza donde
   * quería y no en una página genérica.
   */
  function exigirSesion() {
    if (PFP.auth.haySesion()) return true;
    try {
      sessionStorage.setItem('pfp.volverA', window.location.pathname);
    } catch (e) {}
    ir('entrar.html');
    return false;
  }

  function destinoTrasEntrar() {
    var d = '';
    try {
      d = sessionStorage.getItem('pfp.volverA') || '';
      sessionStorage.removeItem('pfp.volverA');
    } catch (e) {}
    if (!d) return 'index.html';
    // Solo rutas del propio sitio: un destino que venga de fuera no se sigue.
    return d.indexOf('/cuenta/') !== -1 ? d : 'index.html';
  }

  /* =====================================================================
     ENTRAR
     ===================================================================== */

  function paginaEntrar() {
    var form = $('#form-entrar');
    if (!form) return;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      var email = $('#email').value.trim().toLowerCase();
      var clave = $('#password').value;
      var boton = $('#btn-entrar');

      if (!email || !clave) {
        avisar('aviso', T('c.e.faltaEmail'));
        return;
      }

      ocupado(boton, true, T('c.entrar.yendo'));
      PFP.auth
        .signIn(email, clave)
        .then(function () {
          ir(destinoTrasEntrar());
        })
        .catch(function (e) {
          ocupado(boton, false);
          // El correo sin confirmar no es una contraseña mala: mandar a
          // cambiarla sería mandar a arreglar algo que no está roto.
          if (e.codigo === 'email_not_confirmed') {
            guardarCorreo(email);
            ir('verificar.html');
            return;
          }
          avisar('aviso', explicar(e));
        });
    });
  }

  /* =====================================================================
     REGISTRO
     ===================================================================== */

  function paginaRegistro() {
    var form = $('#form-registro');
    if (!form) return;

    var rol = 'volunteer';

    $$('.opcion[data-rol]').forEach(function (b) {
      b.addEventListener('click', function () {
        rol = b.dataset.rol;
        $$('.opcion[data-rol]').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      var nombre = $('#nombre').value.trim();
      var email = $('#email').value.trim().toLowerCase();
      var clave = $('#password').value;
      var repetir = $('#password2').value;
      var acepta = $('#acepta').checked;
      var boton = $('#btn-registro');

      if (nombre.length < 2) return avisar('aviso', T('c.e.nombreCorto'));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return avisar('aviso', T('c.e.emailMalo'));
      if (clave.length < 8) return avisar('aviso', T('c.e.weak_password'));
      // Se pide dos veces porque no se ve al escribirla: un error de tecleo
      // aquí deja a alguien sin poder entrar a una cuenta que acaba de crear.
      if (clave !== repetir) return avisar('aviso', T('c.e.noCoinciden'));
      if (!acepta) return avisar('aviso', T('c.e.aceptar'));

      ocupado(boton, true, T('c.reg.creando'));
      PFP.auth
        .signUp(email, clave, nombre, rol)
        .then(function (r) {
          guardarCorreo(email);
          // Con la confirmación de correo activada no hay sesión todavía:
          // toca teclear el código. Sin ella se entra directo.
          ir(r.estado === 'falta_verificar' ? 'verificar.html' : 'index.html');
        })
        .catch(function (e) {
          ocupado(boton, false);
          avisar('aviso', explicar(e));
        });
    });
  }

  /* =====================================================================
     VERIFICAR EL CORREO
     ===================================================================== */

  function paginaVerificar() {
    var form = $('#form-verificar');
    if (!form) return;

    var email = correoPendiente();
    if (!email) {
      avisar('aviso', T('c.ver.sinCorreo'), 'error');
      $('#form-verificar').style.display = 'none';
      return;
    }
    var destino = $('#destino');
    if (destino) destino.textContent = email;

    var campo = $('#codigo');
    campo.addEventListener('input', function () {
      campo.value = campo.value.replace(/\D/g, '').slice(0, 6);
    });

    /* Cuenta atrás antes de poder pedir otro. El primero se acaba de
       enviar; ofrecer «reenviar» al segundo solo consigue que Supabase lo
       rechace por exceso de envíos. */
    var espera = 60;
    var btnReenviar = $('#btn-reenviar');

    function pintarEspera() {
      if (!btnReenviar) return;
      if (espera > 0) {
        btnReenviar.disabled = true;
        btnReenviar.textContent = T('c.ver.reenviar') + ' (' + espera + ' s)';
        espera--;
        setTimeout(pintarEspera, 1000);
      } else {
        btnReenviar.disabled = false;
        btnReenviar.textContent = T('c.ver.reenviar');
      }
    }
    pintarEspera();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      var codigo = campo.value.trim();
      if (codigo.length !== 6) return avisar('aviso', T('c.ver.seisDigitos'));

      var boton = $('#btn-verificar');
      ocupado(boton, true, T('c.ver.comprobando'));
      PFP.auth
        .verificarCodigo(email, codigo)
        .then(function () {
          ir('index.html');
        })
        .catch(function (e) {
          ocupado(boton, false);
          avisar('aviso', explicar(e));
        });
    });

    if (btnReenviar) {
      btnReenviar.addEventListener('click', function () {
        limpiarAvisos();
        ocupado(btnReenviar, true, T('c.ver.enviando'));
        PFP.auth
          .reenviarCodigo(email)
          .then(function () {
            ocupado(btnReenviar, false);
            avisar('aviso', T('c.ver.reenviado'), 'ok');
            espera = 60;
            pintarEspera();
          })
          .catch(function (e) {
            ocupado(btnReenviar, false);
            avisar('aviso', explicar(e));
          });
      });
    }
  }

  /* =====================================================================
     RECUPERAR LA CONTRASEÑA
     ===================================================================== */

  function paginaRecuperar() {
    var pedir = $('#form-pedir');
    var cambiar = $('#form-cambiar');
    if (!pedir || !cambiar) return;

    var email = '';

    pedir.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      email = $('#email').value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return avisar('aviso', T('c.e.emailMalo'));
      }

      var boton = $('#btn-pedir');
      ocupado(boton, true, T('c.ver.enviando'));
      PFP.auth
        .pedirRecuperacion(email)
        .then(function () {
          ocupado(boton, false);
          // Se pasa al paso dos exista la cuenta o no. Contestar «ese
          // correo no está registrado» convertiría esto en una forma
          // cómoda de averiguar quién tiene cuenta, y aquí eso es saber
          // quién ha pedido ayuda tras una emergencia.
          pedir.style.display = 'none';
          cambiar.style.display = '';
          $('#destino').textContent = email;
          avisar('aviso', T('c.rec.enviado'), 'ok');
        })
        .catch(function (e) {
          ocupado(boton, false);
          avisar('aviso', explicar(e));
        });
    });

    var campo = $('#codigo');
    campo.addEventListener('input', function () {
      campo.value = campo.value.replace(/\D/g, '').slice(0, 6);
    });

    cambiar.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      var codigo = campo.value.trim();
      var nueva = $('#password').value;
      var repetir = $('#password2').value;

      if (codigo.length !== 6) return avisar('aviso', T('c.ver.seisDigitos'));
      if (nueva.length < 8) return avisar('aviso', T('c.e.weak_password'));
      if (nueva !== repetir) return avisar('aviso', T('c.e.noCoinciden'));

      var boton = $('#btn-cambiar');
      ocupado(boton, true, T('c.rec.guardando'));
      PFP.auth
        .cambiarContrasena(email, codigo, nueva)
        .then(function () {
          ir('index.html');
        })
        .catch(function (e) {
          ocupado(boton, false);
          avisar('aviso', explicar(e));
        });
    });
  }

  /* =====================================================================
     ARRANQUE
     ===================================================================== */


  /* =====================================================================
     MI CUENTA
     =====================================================================
     Es el centro del area. Segun quien entre y por donde vaya, enseña lo
     que toca y lleva al siguiente paso: un voluntario sin perfil completo
     al alta, una entidad sin organizacion al formulario, una con
     organizacion sin plan a los planes, y una que ya pago a esperar la
     verificacion. */

  function pinta(html) {
    var caja = $('#panel');
    if (caja) caja.innerHTML = html;
  }

  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Color por estado. El texto sale del diccionario, con la misma clave
     que el estado que devuelve el servidor. */
  var COLOR_PLAN = {
    active: 'ok',
    pending_payment: 'espera',
    expired: 'espera',
    rejected: 'mal',
    cancelled: 'mal',
  };

  function paginaIndex() {
    if (!exigirSesion()) return;

    var salir = $('#btn-salir');
    if (salir) {
      salir.addEventListener('click', function () {
        PFP.auth.signOut().then(function () {
          ir('../index.html');
        });
      });
    }

    cargarEstado()
      .then(function (e) {
        var nombre = $('#saludo');
        if (nombre) nombre.textContent = (e.perfil.full_name || '').split(' ')[0] || 'Hola';

        if (e.perfil.role === 'organization' || e.organizacion) pintarEntidad(e);
        else pintarVoluntario(e);
      })
      .catch(function (err) {
        if (err.codigo === 'sin_sesion') return ir('entrar.html');
        pinta('<p class="cargando">' + escapar(explicar(err)) + '</p>');
      });
  }

  function pintarVoluntario(e) {
    var completo = e.perfil.onboarding_complete;

    var filas =
      '<div class="estado">' +
      '<div class="estado__fila"><span class="estado__clave">' + T('c.mi.tipoCuenta') + '</span>' +
      '<span class="estado__valor">' + T('c.mi.voluntario') + '<small>' + escapar(e.perfil.email) + '</small></span></div>' +
      '<div class="estado__fila"><span class="estado__clave">' + T('c.mi.perfil') + '</span>' +
      '<span class="estado__valor"><span class="marca marca--' + (completo ? 'ok' : 'espera') + '">' +
      (completo ? T('c.mi.completo') : T('c.mi.sinTerminar')) + '</span></span></div>' +
      '</div>';

    var accion = completo
      ? '<p class="field__hint">' + T('c.mi.perfilListo') + '</p>'
      : '<p class="field__hint">' + T('c.mi.faltaPerfil') + '</p>' +
        '<a class="btn btn--primary" href="voluntario.html">' + T('c.mi.completar') + '</a>';

    pinta(filas + '<div style="margin-top:var(--s-lg);display:grid;gap:12px">' + accion + '</div>');
  }

  function pintarEntidad(e) {
    var org = e.organizacion;

    if (!org) {
      pinta(
        '<div class="estado"><div class="estado__fila">' +
          '<span class="estado__clave">' + T('c.mi.tipoCuenta') + '</span>' +
          '<span class="estado__valor">' + T('c.mi.entidad') + '<small>' + escapar(e.perfil.email) + '</small></span>' +
          '</div></div>' +
          '<div style="margin-top:var(--s-lg);display:grid;gap:12px">' +
          '<p class="field__hint">' + T('c.mi.sinEntidad') + '</p>' +
          '<a class="btn btn--primary" href="organizacion.html">' + T('c.mi.darAlta') + '</a>' +
          '</div>',
      );
      return;
    }

    var plan = e.plan;
    var marcaVer = org.verificada
      ? '<span class="marca marca--ok">' + T('c.mi.verificada') + '</span>'
      : '<span class="marca marca--espera">' + T('c.mi.enRevision') + '</span>';

    var marcaPlan = plan
      ? '<span class="marca marca--' + (COLOR_PLAN[plan.status] || 'espera') + '">' +
        T('c.plan.' + plan.status) + '</span>'
      : '<span class="marca marca--espera">' + T('c.mi.sinPlan') + '</span>';

    var filas =
      '<div class="estado">' +
      '<div class="estado__fila"><span class="estado__clave">' + T('c.mi.entidad') + '</span>' +
      '<span class="estado__valor">' + escapar(org.nombre) + '<small>' + escapar(e.perfil.email) + '</small></span></div>' +
      '<div class="estado__fila"><span class="estado__clave">' + T('c.mi.verificacion') + '</span>' +
      '<span class="estado__valor">' + marcaVer + '</span></div>' +
      '<div class="estado__fila"><span class="estado__clave">' + T('c.mi.plan') + '</span>' +
      '<span class="estado__valor">' + marcaPlan + '</span></div>' +
      '</div>';

    var acciones = [];

    if (!org.verificada) {
      acciones.push(
        '<p class="field__hint">' + T('c.mi.enRevisionTexto') + '</p>',
      );
    }

    /* La referencia del ingreso se enseña aqui y no solo al contratar: es lo
       unico que permite casar un pago con quien lo hizo, y quien cierra la
       pestaña se queda sin ella. */
    if (plan && plan.status === 'pending_payment') {
      acciones.push(
        '<div class="dato dato--destacado"><span><span class="dato__clave">' + T('c.mi.concepto') + '</span>' +
          '<span class="dato__valor">' + escapar(plan.reference) + '</span></span>' +
          '<button class="dato__copiar" type="button" data-copiar="' + escapar(plan.reference) + '">' + T('c.mi.copiar') + '</button></div>',
      );
      acciones.push('<a class="btn btn--ghost" href="pago.html">' + T('c.mi.verPago') + '</a>');
    } else if (!plan || plan.status !== 'active') {
      acciones.push('<a class="btn btn--primary" href="planes.html">' + T('c.mi.elegirPlan') + '</a>');
    }

    acciones.push('<a class="btn btn--ghost" href="organizacion.html">' + T('c.mi.editar') + '</a>');

    pinta(filas + '<div style="margin-top:var(--s-lg);display:grid;gap:12px">' + acciones.join('') + '</div>');

    $$('[data-copiar]').forEach(function (b) {
      b.addEventListener('click', function () {
        navigator.clipboard.writeText(b.dataset.copiar).then(function () {
          b.textContent = T('c.mi.copiado');
          setTimeout(function () {
            b.textContent = T('c.mi.copiar');
          }, 1800);
        });
      });
    });
  }

  var PAGINAS = {
    entrar: paginaEntrar,
    registro: paginaRegistro,
    verificar: paginaVerificar,
    recuperar: paginaRecuperar,
    index: paginaIndex,
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!PFP.configurado) {
      avisar('aviso', T('c.e.sinConfig'), 'error');
      return;
    }

    var pagina = document.body.dataset.pagina;

    // Con sesión abierta, entrar y registrarse no tienen sentido.
    if ((pagina === 'entrar' || pagina === 'registro') && PFP.auth.haySesion()) {
      ir('index.html');
      return;
    }

    var controlador = PAGINAS[pagina];
    if (controlador) controlador();
  });

  /* Lo que necesitan los demás guiones del área de cuenta. */
  window.PFP_UI = {
    T: T,
    retraducir: retraducir,
    $: $,
    $$: $$,
    avisar: avisar,
    limpiarAvisos: limpiarAvisos,
    ocupado: ocupado,
    explicar: explicar,
    ir: ir,
    exigirSesion: exigirSesion,
    cargarEstado: cargarEstado,
  };
})();
