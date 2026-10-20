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
    'invalid_credentials', 'email_taken', 'weak_password', 'misma_clave', 'email_not_confirmed',
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

  /**
   * Pone el campo del código en casillas, una por cifra.
   *
   * El campo de verdad no se sustituye: se mete en una caja con las
   * casillas debajo y él encima, del mismo tamaño y transparente (ver
   * `cuenta.css`). Las casillas solo pintan lo que hay escrito. Así siguen
   * funcionando la sugerencia del código que hace el navegador, pegarlo de
   * una vez, el botón de enviar el formulario y el lector de pantalla, que
   * lee un solo campo con su nombre.
   *
   * Va DESPUÉS del filtro que deja solo dígitos: los dos escuchan `input` y
   * se ejecutan en el orden en que se engancharon.
   *
   * Devuelve `error(si)`, que pinta las casillas en rojo hasta que se vuelve
   * a escribir.
   */
  function codigoEnCasillas(campo, cifras) {
    cifras = cifras || 6;

    var caja = document.createElement('div');
    caja.className = 'codigo';
    var fila = document.createElement('div');
    fila.className = 'codigo__fila';
    fila.setAttribute('aria-hidden', 'true');

    var casillas = [];
    for (var i = 0; i < cifras; i++) {
      var c = document.createElement('span');
      c.className = 'codigo__casilla';
      fila.appendChild(c);
      casillas.push(c);
    }

    campo.parentNode.insertBefore(caja, campo);
    caja.appendChild(fila);
    caja.appendChild(campo);
    campo.classList.add('codigo__campo');

    function pintar() {
      var v = campo.value;
      var enfocado = document.activeElement === campo;
      // Con el código completo queda marcada la última: es la que borra la
      // tecla de borrar.
      var activa = Math.min(v.length, cifras - 1);
      casillas.forEach(function (casilla, n) {
        var cifra = v.charAt(n);
        casilla.textContent = cifra;
        casilla.classList.toggle('codigo__casilla--llena', !!cifra);
        casilla.classList.toggle('codigo__casilla--activa', enfocado && n === activa);
        casilla.classList.toggle(
          'codigo__casilla--cursor',
          enfocado && n === activa && v.length < cifras,
        );
      });
    }

    /* El cursor, siempre al final. En un campo invisible no se ve dónde
       está, y una cifra metida a mitad desplazaría las demás de casilla sin
       que se entendiera por qué. */
    function alFinal() {
      var fin = campo.value.length;
      try {
        campo.setSelectionRange(fin, fin);
      } catch (e) {}
    }

    campo.addEventListener('input', function () {
      caja.classList.remove('codigo--error');
      pintar();
    });
    campo.addEventListener('focus', function () {
      pintar();
      setTimeout(alFinal, 0);
    });
    campo.addEventListener('blur', pintar);
    campo.addEventListener('click', alFinal);
    campo.addEventListener('keydown', function (ev) {
      if (/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End)$/.test(ev.key)) ev.preventDefault();
    });

    pintar();

    return {
      error: function (si) {
        caja.classList.toggle('codigo--error', !!si);
      },
      /** Vacía las casillas, como si se borrara a mano: por el mismo evento,
          para que se entere todo lo que escucha al campo. */
      vaciar: function () {
        campo.value = '';
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      },
    };
  }

  /**
   * El código de seis cifras que hay en un texto copiado, o null.
   *
   * La misma regla que la app: el código solo —«482913»—, partido —«482 913»,
   * «482-913»— o dentro de una frase corta —«Tu código es 482913»—, siempre
   * que haya UN solo grupo de seis cifras. Lo largo no se mira: un párrafo o
   * una dirección no son un código copiado, y sacar de ahí una cifra suelta
   * sería adivinar.
   */
  function extraerCodigo(texto) {
    var limpio = String(texto || '').trim();
    if (!limpio || limpio.length > 200) return null;

    var sinSeparadores = limpio.replace(/[\s-]/g, '');
    if (/^\d+$/.test(sinSeparadores)) return sinSeparadores.length === 6 ? sinSeparadores : null;

    var candidatos = (limpio.match(/\d+/g) || []).filter(function (g) {
      return g.length === 6;
    });
    return candidatos.length === 1 ? candidatos[0] : null;
  }

  /**
   * «Pegar el código», para quien ha leído el correo en este mismo aparato.
   *
   * Leer el portapapeles exige permiso, así que se lee AL PULSAR: Chrome lo
   * pregunta la primera vez y Safari enseña su burbuja de «Pegar». Y al volver
   * a la pestaña —que es lo que pasa al ir al correo, copiar el código y
   * volver— se mira solo si el navegador YA dio permiso: sin él, leerlo
   * sacaría la pregunta sin que nadie hubiera pulsado nada. Entonces el botón
   * enseña el código: «Pegar el código 482913».
   *
   * Sin la API del portapapeles el botón no sale: pegar con el teclado o con
   * una pulsación larga sigue funcionando en las casillas.
   */
  function botonPegar(boton, campo, alFallar) {
    var portapapeles = navigator.clipboard;
    if (!boton || !portapapeles || typeof portapapeles.readText !== 'function') return;

    var etiqueta = $('#' + boton.id + '-texto');
    var sugerido = null;

    function pintar() {
      boton.hidden = campo.value.length === 6;
      if (!etiqueta) return;
      if (sugerido && sugerido !== campo.value) {
        etiqueta.removeAttribute('data-i18n');
        etiqueta.textContent = T('c.pegar.conCodigo').replace('{codigo}', sugerido);
      } else {
        etiqueta.setAttribute('data-i18n', 'c.pegar.btn');
        etiqueta.textContent = T('c.pegar.btn');
      }
    }

    function poner(codigo) {
      campo.value = codigo;
      // Por el mismo camino que si se tecleara: filtro, casillas y, donde
      // toque, la comprobación automática.
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.focus();
    }

    boton.addEventListener('click', function () {
      if (sugerido) return poner(sugerido);
      portapapeles
        .readText()
        .then(function (texto) {
          var codigo = extraerCodigo(texto);
          if (codigo) poner(codigo);
          else alFallar(T('c.pegar.nada'));
        })
        .catch(function () {
          alFallar(T('c.pegar.denegado'));
        });
    });

    function mirarSinPreguntar() {
      if (!navigator.permissions || !navigator.permissions.query) return;
      // Firefox y Safari no conocen este permiso y rechazan: no pasa nada.
      navigator.permissions
        .query({ name: 'clipboard-read' })
        .then(function (permiso) {
          if (permiso.state !== 'granted') return;
          return portapapeles.readText().then(function (texto) {
            sugerido = extraerCodigo(texto);
            pintar();
          });
        })
        .catch(function () {});
    }

    window.addEventListener('focus', mirarSinPreguntar);
    campo.addEventListener('input', pintar);
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.lang [data-lang]') : null;
      if (b) setTimeout(pintar, 0);
    });

    pintar();
    mirarSinPreguntar();
  }

  /**
   * El botón de «Enviar otro código» con su espera.
   *
   * Ofrecer «reenviar» al segundo de mandar uno solo consigue que Supabase lo
   * rechace por exceso de envíos. Devuelve `empezar(segundos)`; con 0 el
   * botón queda libre.
   */
  function esperaDeReenvio(boton) {
    // Espacios que no se parten: en un móvil estrecho «(52 s)» se quedaba
    // con la «s)» sola en otra línea.
    var FIJO = String.fromCharCode(160);
    var restante = 0;
    var temporizador = null;

    function pintar() {
      if (!boton) return;
      boton.disabled = restante > 0;
      boton.textContent =
        restante > 0
          ? T('c.ver.reenviar') + FIJO + '(' + restante + FIJO + 's)'
          : T('c.ver.reenviar');
    }

    function tic() {
      restante--;
      pintar();
      temporizador = restante > 0 ? setTimeout(tic, 1000) : null;
    }

    return {
      empezar: function (segundos) {
        clearTimeout(temporizador);
        restante = Math.max(0, Math.round(segundos));
        pintar();
        temporizador = restante > 0 ? setTimeout(tic, 1000) : null;
      },
    };
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

  /* Cuándo se mandó el último código de confirmación, y a qué correo.

     Con la hora de verdad y no con una cuenta atrás que empieza al abrir la
     página: antes, al recargar `verificar.html` volvían a ser sesenta
     segundos, y quien llegaba desde «Entrar» con el correo sin confirmar
     —sin que se le hubiera mandado nada— tenía que esperar un minuto para
     pedir un código mientras la página le aseguraba que ya lo tenía. */
  var CLAVE_ENVIO = 'pfp.codigoEnviado';

  function anotarEnvio(email) {
    try {
      sessionStorage.setItem(CLAVE_ENVIO, JSON.stringify({ email: email, en: Date.now() }));
    } catch (e) {}
  }

  /** Milisegundos desde el último código mandado a este correo, o null. */
  function desdeElEnvio(email) {
    try {
      var e = JSON.parse(sessionStorage.getItem(CLAVE_ENVIO) || 'null');
      if (!e || e.email !== email || typeof e.en !== 'number') return null;
      var ms = Date.now() - e.en;
      return ms >= 0 ? ms : null;
    } catch (err) {
      return null;
    }
  }

  /* El correo de bienvenida se pide en la página SIGUIENTE, no en la que
     confirma. Pedirlo justo antes de cambiar de página es perderlo: el
     navegador corta lo que está en vuelo al salir. Así que se deja anotado y
     la primera página de la cuenta que se abre lo pide con calma. Si no hay
     red, la nota se queda y lo intenta la siguiente. Pedirlo de más no
     duplica nada: el servidor manda uno por cuenta. */
  var CLAVE_BIENVENIDA = 'pfp.bienvenidaPendiente';

  function anotarBienvenida() {
    try {
      sessionStorage.setItem(CLAVE_BIENVENIDA, '1');
    } catch (e) {}
  }

  function pedirBienvenidaPendiente() {
    try {
      if (sessionStorage.getItem(CLAVE_BIENVENIDA) !== '1') return;
    } catch (e) {
      return;
    }
    if (!PFP.auth.haySesion()) return;
    PFP.auth.bienvenida().then(function (hecho) {
      if (!hecho) return;
      try {
        sessionStorage.removeItem(CLAVE_BIENVENIDA);
      } catch (e) {}
    });
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
          // Red de seguridad, no el camino normal: quien confirmó el correo
          // y perdió la conexión justo después se quedó sin bienvenida. El
          // servidor solo la manda si la cuenta es de esta semana y no la
          // tiene ya.
          anotarBienvenida();
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
    var opciones = $$('.opcion[data-rol]');

    function elegir(b) {
      rol = b.dataset.rol;
      opciones.forEach(function (o) {
        o.setAttribute('aria-pressed', String(o === b));
      });
    }

    opciones.forEach(function (b) {
      b.addEventListener('click', function () { elegir(b); });
    });

    /* Se llega aquí desde «Inscribirme como ONG» y compañía, que traen ya el
       tipo de cuenta en la dirección. Se comprueba contra los botones que hay
       de verdad y no se usa tal cual: lo que venga en una URL lo escribe
       cualquiera, y de aquí sale el rol con el que se crea la cuenta. */
    var pedido = new URLSearchParams(window.location.search).get('rol');
    var deLaUrl = opciones.filter(function (o) { return o.dataset.rol === pedido; })[0];
    if (deLaUrl) elegir(deLaUrl);

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
          if (r.estado === 'falta_verificar') {
            anotarEnvio(email);
            ir('verificar.html');
          } else {
            anotarBienvenida();
            ir('index.html');
          }
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

    /* Lo que dice la cabecera depende de si de verdad acabamos de mandar
       algo. Se cambia la clave y no solo el texto: si no, al pulsar el
       botón de idioma `site.js` volvería a poner la frase de «enviado». */
    function pintarIntro(reciente) {
      var intro = $('#intro');
      var fin = $('#intro-fin');
      var cuerpo = $('#intro-pendiente');
      if (intro) intro.setAttribute('data-i18n', reciente ? 'c.ver.enviado' : 'c.ver.pendiente');
      if (fin) fin.setAttribute('data-i18n', reciente ? 'c.ver.enviadoFin' : 'c.ver.pendienteFin');
      [intro, fin].forEach(function (el) {
        if (el) el.textContent = T(el.getAttribute('data-i18n'));
      });
      if (cuerpo) cuerpo.hidden = reciente;
    }

    // Un código vale una hora: pasada, no tiene sentido decir que lo tienes.
    var transcurrido = desdeElEnvio(email);
    pintarIntro(transcurrido !== null && transcurrido < 60 * 60 * 1000);

    var campo = $('#codigo');
    campo.addEventListener('input', function () {
      campo.value = campo.value.replace(/\D/g, '').slice(0, 6);
    });
    var casillas = codigoEnCasillas(campo);
    botonPegar($('#btn-pegar'), campo, function (texto) {
      avisar('aviso', texto);
    });

    /* Cuenta atrás antes de poder pedir otro, contada desde el último envío
       de verdad; si no se ha mandado nada, no hay nada que esperar. */
    var btnReenviar = $('#btn-reenviar');
    var espera = esperaDeReenvio(btnReenviar);
    espera.empezar(transcurrido === null ? 0 : 60 - Math.floor(transcurrido / 1000));

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      var codigo = campo.value.trim();
      if (codigo.length !== 6) {
        casillas.error(true);
        return avisar('aviso', T('c.ver.seisDigitos'));
      }

      var boton = $('#btn-verificar');
      ocupado(boton, true, T('c.ver.comprobando'));
      PFP.auth
        .verificarCodigo(email, codigo)
        .then(function () {
          anotarBienvenida();
          ir('index.html');
        })
        .catch(function (e) {
          ocupado(boton, false);
          casillas.error(e.codigo === 'invalid_code');
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
            anotarEnvio(email);
            pintarIntro(true);
            avisar('aviso', T('c.ver.reenviado'), 'ok');
            espera.empezar(60);
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
    var formCodigo = $('#form-codigo');
    var cambiar = $('#form-cambiar');
    var caducado = $('#rec-caducado');
    if (!pedir || !formCodigo || !cambiar) return;

    var email = '';
    /* La sesión que abre el código, solo en esta página (ver
       `PFP.auth.verificarRecuperacion`). Recargar o cerrar la pierde, y es lo
       que se quiere: nadie se queda dentro sin haber cambiado la contraseña. */
    var sesion = null;

    /* ---- Los tres pasos ---- */

    var TEXTOS = {
      1: { titulo: 'c.rec.t', sub: 'c.rec.sub', fin: null },
      2: { titulo: 'c.rec.codigoT', sub: 'c.rec.codigoA', fin: 'c.rec.codigoB' },
      3: { titulo: 'c.rec.nuevaT', sub: 'c.rec.nuevaA', fin: 'c.rec.nuevaB' },
      caducado: { titulo: 'c.rec.nuevaT', sub: null, fin: null },
    };

    /* Se cambia la clave y no solo el texto: si no, al pulsar el botón de
       idioma `site.js` volvería a poner la frase del paso 1. */
    function ponerTexto(el, clave) {
      if (!el) return;
      if (clave) {
        el.setAttribute('data-i18n', clave);
        el.textContent = T(clave);
      } else {
        el.removeAttribute('data-i18n');
        el.textContent = '';
      }
    }

    function irAPaso(paso, sinFoco) {
      var n = paso === 'caducado' ? 3 : paso;
      pedir.hidden = paso !== 1;
      formCodigo.hidden = paso !== 2;
      cambiar.hidden = paso !== 3;
      if (caducado) caducado.hidden = paso !== 'caducado';

      $$('.pasos__barra').forEach(function (barra, i) {
        barra.setAttribute('data-hecho', String(i < n));
      });
      ponerTexto($('#rec-paso'), 'c.rec.paso' + n);

      var textos = TEXTOS[paso];
      ponerTexto($('#rec-titulo'), textos.titulo);
      ponerTexto($('#rec-sub'), textos.sub);
      ponerTexto($('#rec-sub-fin'), textos.fin);
      $('#rec-correo').textContent = textos.fin ? email : '';

      if (sinFoco) return;
      // Al campo del paso: se llega a escribir, no a buscar dónde.
      var primero = { 1: $('#email'), 2: campo, 3: $('#password'), caducado: $('#btn-empezar') }[paso];
      if (primero) {
        setTimeout(function () {
          primero.focus();
        }, 0);
      }
    }

    /* ---- Paso 1: el correo ---- */

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
          casillas.vaciar();
          casillas.error(false);
          $('#correo-cuenta').value = email;
          espera.empezar(60);
          irAPaso(2);
        })
        .catch(function (e) {
          ocupado(boton, false);
          avisar('aviso', explicar(e));
        });
    });

    /* ---- Paso 2: el código ---- */

    var campo = $('#codigo');
    campo.addEventListener('input', function () {
      campo.value = campo.value.replace(/\D/g, '').slice(0, 6);
    });
    var casillas = codigoEnCasillas(campo);
    // Al completar las seis cifras se comprueba solo, sin buscar el botón.
    campo.addEventListener('input', function () {
      if (campo.value.length === 6) comprobar();
    });
    botonPegar($('#btn-pegar'), campo, function (texto) {
      avisar('aviso', texto);
    });

    var comprobando = false;

    function comprobar() {
      if (comprobando) return;
      limpiarAvisos();

      var codigo = campo.value;
      if (codigo.length !== 6) {
        casillas.error(true);
        return avisar('aviso', T('c.ver.seisDigitos'));
      }

      comprobando = true;
      var boton = $('#btn-codigo');
      ocupado(boton, true, T('c.ver.comprobando'));
      PFP.auth
        .verificarRecuperacion(email, codigo)
        .then(function (s) {
          comprobando = false;
          ocupado(boton, false);
          sesion = s;
          irAPaso(3);
        })
        .catch(function (e) {
          comprobando = false;
          ocupado(boton, false);
          // Con el código malo se vacían las casillas para volver a
          // escribirlo: con seis cifras, borrar una a una cuesta más que
          // teclearlas otra vez.
          if (e.codigo === 'invalid_code') {
            casillas.vaciar();
            casillas.error(true);
            campo.focus();
          }
          avisar('aviso', explicar(e));
        });
    }

    formCodigo.addEventListener('submit', function (ev) {
      ev.preventDefault();
      comprobar();
    });

    var btnReenviar = $('#btn-reenviar-rec');
    var espera = esperaDeReenvio(btnReenviar);
    btnReenviar.addEventListener('click', function () {
      limpiarAvisos();
      ocupado(btnReenviar, true, T('c.ver.enviando'));
      PFP.auth
        .pedirRecuperacion(email)
        .then(function () {
          ocupado(btnReenviar, false);
          casillas.vaciar();
          avisar('aviso', T('c.ver.reenviado'), 'ok');
          espera.empezar(60);
        })
        .catch(function (e) {
          ocupado(btnReenviar, false);
          avisar('aviso', explicar(e));
        });
    });

    $('#btn-otro-correo').addEventListener('click', function () {
      limpiarAvisos();
      irAPaso(1);
    });

    /* ---- Paso 3: la contraseña nueva ---- */

    cambiar.addEventListener('submit', function (ev) {
      ev.preventDefault();
      limpiarAvisos();

      var nueva = $('#password').value;
      var repetir = $('#password2').value;
      if (nueva.length < 8) return avisar('aviso', T('c.e.weak_password'));
      if (nueva !== repetir) return avisar('aviso', T('c.e.noCoinciden'));
      if (!sesion) return irAPaso('caducado');

      var boton = $('#btn-cambiar');
      ocupado(boton, true, T('c.rec.guardando'));
      PFP.auth
        .ponerContrasena(sesion, nueva)
        .then(function () {
          sesion = null;
          ir('index.html');
        })
        .catch(function (e) {
          ocupado(boton, false);
          // 401: la sesión que abrió el código ya no vale. No es una
          // contraseña mala: hay que pedir otro código.
          if (e.codigo === 'sin_sesion') {
            sesion = null;
            return irAPaso('caducado');
          }
          avisar('aviso', explicar(e));
        });
    });

    $('#btn-empezar').addEventListener('click', function () {
      limpiarAvisos();
      sesion = null;
      irAPaso(1);
    });

    irAPaso(1, true);
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

    pedirBienvenidaPendiente();

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
