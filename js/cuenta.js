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
    'invalid_code', 'rate_limited', 'network', 'sin_sesion', 'sin_permiso', 'motivo',
    'cif_repetido', 'duplicado', 'unknown',
  ];

  function explicar(e) {
    var c = e && e.codigo;
    // Cuando el servidor ha explicado POR QUE dice que no, se enseña su
    // texto: lo escribimos nosotros en la base de datos y dice mucho mas
    // que un «no tienes permiso» generico.
    if ((c === 'sin_permiso' || c === 'motivo') && e.detalle) return e.detalle;
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
      .select('profiles', 'select=id,email,full_name,photo_url,role,onboarding_complete&limit=1')
      .then(function (filas) {
        var perfil = filas && filas[0];
        if (!perfil) throw PFP.error('sin_sesion');

        return PFP.db
          .select(
            'organization_members',
            'select=organization_id,organizations!inner(' +
              'display_name,kind,verified_at,size_metric,size_tier,size_confirmed_at)' +
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
              tamanoNumero: m.organizations.size_metric,
              // El tramo solo cuenta cuando alguien lo ha confirmado: hasta
              // entonces es lo que dijo la entidad, y sobre eso no se cobra.
              tramo: m.organizations.size_confirmed_at ? m.organizations.size_tier : null,
              tramoDeclarado: m.organizations.size_tier,
              tramoConfirmado: m.organizations.size_confirmed_at !== null,
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


  /* ---------------------------------------------------------------------
     Guiones viejos con HTML nuevo
     --------------------------------------------------------------------- */

  /* Una sola vez por pestaña: si el refresco tampoco arregla nada, mejor una
     pantalla fea que un bucle de recargas. */
  var CLAVE_REFRESCO = 'pfp.refrescoCache';

  /**
   * ¿El diccionario que ha llegado es tan nuevo como esta página?
   *
   * Lo decide el propio HTML: cada `data-i18n` es una clave que esta página
   * necesita, y el HTML siempre es el nuevo cuando el navegador ha guardado
   * los guiones de antes. Si falta alguna, el diccionario se ha quedado
   * atrás.
   */
  function diccionarioAlDia() {
    var d = (window.I18N && window.I18N.es) || {};
    var claves = $$('[data-i18n]');
    if (!claves.length) return true;

    for (var i = 0; i < claves.length; i++) {
      if (!(claves[i].getAttribute('data-i18n') in d)) return false;
    }
    return true;
  }

  /**
   * Pide otra vez lo que la página carga, saltándose la caché, y recarga.
   *
   * `cache: 'reload'` no solo se salta lo guardado: lo SUSTITUYE, así que al
   * recargar el navegador ya encuentra la versión buena. Se hace con todo
   * —guiones y hojas de estilo— porque si el diccionario se ha quedado
   * viejo, lo demás también.
   */
  function refrescarYRecargar() {
    try {
      if (sessionStorage.getItem(CLAVE_REFRESCO)) return false;
      sessionStorage.setItem(CLAVE_REFRESCO, '1');
    } catch (e) {
      return false;
    }

    var rutas = $$('script[src]')
      .map(function (s) { return s.getAttribute('src'); })
      .concat($$('link[rel="stylesheet"]').map(function (l) { return l.getAttribute('href'); }))
      .filter(function (r) { return r && r.charAt(0) !== 'h'; });

    PFP.recargando = true;

    Promise.all(
      rutas.map(function (r) {
        return fetch(r, { cache: 'reload' }).catch(function () {});
      }),
    ).then(function () {
      window.location.reload();
    });

    return true;
  }

  /* =====================================================================
     PIEZAS COMPARTIDAS
     =====================================================================
     El panel de /cuenta se fue a la consola (`consola.js` y los guiones de
     cada pantalla). Lo que queda aqui es lo que usan varias: escapar texto
     ajeno antes de meterlo en el HTML, y el color de cada estado de plan. */

  /**
   * Escapa lo que va a ir dentro de HTML.
   *
   * Incluida la comilla simple: no todo lo que se pinta va entre comillas
   * dobles, y un nombre con apóstrofo —O’Donnell, D’Angelo— dentro de un
   * atributo escrito con comilla simple lo cerraría antes de tiempo.
   */
  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"\']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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

  var PAGINAS = {
    entrar: paginaEntrar,
    registro: paginaRegistro,
    verificar: paginaVerificar,
    recuperar: paginaRecuperar,
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!PFP.configurado) {
      avisar('aviso', T('c.e.sinConfig'), 'error');
      return;
    }

    /* Antes que nada: si los guiones que han llegado son mas viejos que
       esta pagina, se refrescan y se recarga. Pintar con un diccionario a
       medias enseña las claves en crudo. */
    if (!diccionarioAlDia()) {
      if (refrescarYRecargar()) return;
    } else {
      try { sessionStorage.removeItem(CLAVE_REFRESCO); } catch (e) {}
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
    escapar: escapar,
    COLOR_PLAN: COLOR_PLAN,
  };
})();
