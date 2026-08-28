/* ==========================================================================
   Cliente de Supabase, escrito a mano
   --------------------------------------------------------------------------
   Sin librería. El sitio no carga ni una dependencia externa a propósito
   —está razonado en `site.js`: atarse a un CDN es atarse a que un tercero
   siga vivo, y manda la IP de cada visitante a un dominio que no aparece en
   el aviso de privacidad—. El SDK oficial son unos 120 KB para usar cuatro
   endpoints REST, así que se hablan directamente.

   Cubre lo que necesita el área de cuenta:

     · Autenticación (GoTrue): alta, entrada, confirmación por código,
       recuperación de contraseña y refresco del testigo.
     · Consultas a tablas y llamadas a funciones (PostgREST).

   La sesión vive en `localStorage`. Es lo mismo que hace el SDK oficial en
   web, y aquí no hay alternativa mejor: una cookie httpOnly necesitaría un
   servidor, y esto es un sitio estático.
   ========================================================================== */

(function () {
  'use strict';

  var CFG = window.PFP_CONFIG || {};
  var URL_BASE = CFG.supabaseUrl || '';
  var ANON = CFG.supabaseAnonKey || '';

  var CLAVE_SESION = 'pfp.session';

  /* Margen antes de que caduque el testigo. Se refresca con un minuto de
     antelación para que ninguna petición salga con uno recién muerto. */
  var MARGEN_MS = 60 * 1000;

  /* ---------------------------------------------------------------------
     Sesión guardada
     --------------------------------------------------------------------- */

  function leerSesion() {
    try {
      var crudo = localStorage.getItem(CLAVE_SESION);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) {
      return null;
    }
  }

  function guardarSesion(sesion) {
    try {
      if (!sesion) localStorage.removeItem(CLAVE_SESION);
      else localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch (e) {
      /* Modo incógnito con almacenamiento bloqueado: la sesión dura lo que
         dure la pestaña. Es peor experiencia, pero no es un fallo. */
    }
  }

  /** Normaliza lo que devuelve GoTrue y le pone la hora de caducidad. */
  function conCaducidad(datos) {
    if (!datos || !datos.access_token) return null;
    var segundos = datos.expires_in || 3600;
    return {
      access_token: datos.access_token,
      refresh_token: datos.refresh_token,
      expira_en: Date.now() + segundos * 1000,
      user: datos.user || null,
    };
  }

  /* ---------------------------------------------------------------------
     Errores
     --------------------------------------------------------------------- */

  /**
   * Error con un código estable.
   *
   * Los mismos códigos que usa la app (`invalid_credentials`,
   * `email_not_confirmed`, `invalid_code`...). Así las dos hablan el mismo
   * idioma y los textos se traducen una vez por plataforma, no por mensaje
   * que devuelva el servidor.
   */
  function PfpError(codigo, mensaje) {
    var e = new Error(mensaje || codigo);
    e.codigo = codigo;
    return e;
  }

  function esLimite(texto) {
    return /rate limit|too many requests|security purposes|after \d+ seconds/i.test(texto);
  }

  /* Los SQLSTATE con los que rechazan nuestras funciones, y solo esos.

     P0001  `raise exception` sin errcode explicito
     23514  check_violation      — «eso ya lo resolvio alguien»
     P0002  no_data_found        — «eso ya no existe» */
  var MOTIVOS_NUESTROS = { P0001: 1, 23514: 1, P0002: 1 };

  function traducirError(estado, cuerpo) {
    var msg = (cuerpo && (cuerpo.error_description || cuerpo.msg || cuerpo.message)) || '';

    if (esLimite(msg)) return PfpError('rate_limited', msg);
    if (/already registered|already been registered|user already exists/i.test(msg)) {
      return PfpError('email_taken', msg);
    }
    if (/email not confirmed|not confirmed/i.test(msg)) return PfpError('email_not_confirmed', msg);
    if (/invalid login credentials|invalid grant/i.test(msg)) {
      return PfpError('invalid_credentials', msg);
    }
    /* Codigos de un solo uso caducados. Sin el `expired` a secas: un 401 de
       PostgREST dice «JWT expired» y casaba con el, asi que a quien se le
       caducaba la sesion mientras trabajaba se le decia que su CODIGO no era
       correcto y que pidiera otro. No habia ningun codigo por medio. */
    if (/token has expired|has expired|invalid token|otp_expired/i.test(msg)) {
      return PfpError('invalid_code', msg);
    }
    if (/password should be|password.*at least|weak/i.test(msg)) return PfpError('weak_password', msg);

    // Un 401 es siempre el mismo problema: el testigo ya no vale. Se
    // detecta por el codigo y no por el texto, que PostgREST y GoTrue
    // redactan distinto. Sin esto, a quien se le caducaba la sesion a
    // mitad de un formulario le salia «algo ha fallado» y no tenia forma
    // de saber que bastaba con volver a entrar.
    if (estado === 401) return PfpError('sin_sesion', msg);

    // Un 403 NO es una sesion caducada: es el servidor diciendo que no.
    // PostgREST devuelve 403 con `42501` cuando una politica rechaza la
    // operacion, y tambien cuando una funcion nuestra lanza
    // `insufficient_privilege` — «solo puedes escribir a personas con las
    // que compartes una entidad», por ejemplo. Confundirlo con una sesion
    // caducada manda a la gente a volver a entrar para arreglar algo que
    // no se arregla entrando, y de paso tira el mensaje util que ya venia
    // escrito desde la base de datos.
    if (estado === 403) {
      var e = PfpError('sin_permiso', msg);
      // El texto del servidor manda cuando lo hay: lo escribimos nosotros
      // en la migracion y dice exactamente que ha pasado.
      e.detalle = msg || '';
      return e;
    }

    // Un motivo escrito a mano en una funcion de la base.
    //
    // Nuestras funciones rechazan con una frase en castellano y el SQLSTATE
    // que les corresponde. PostgREST lo devuelve tal cual, pero fuera del
    // 403 caia en `unknown` y esa frase —que se escribio precisamente para
    // que la leyera una persona— acababa en «algo ha fallado».
    //
    // Solo los codigos que lanzamos NOSOTROS: un fallo interno de la base no
    // tiene por que enseñarle su texto a nadie.
    if (cuerpo && msg && MOTIVOS_NUESTROS[cuerpo.code]) {
      var m = PfpError('motivo', msg);
      m.detalle = msg;
      return m;
    }

    // Clave repetida. El caso que se da de verdad es el CIF: la columna
    // `organizations.tax_id` es UNIQUE, asi que intentar dar de alta dos
    // veces la misma entidad acaba aqui. Sin esto salia «algo ha fallado»,
    // que no dice ni que el problema es el CIF ni que la entidad ya existe.
    if (estado === 409 || (cuerpo && cuerpo.code === '23505')) {
      if (/tax_id/i.test((cuerpo && cuerpo.details) || msg)) {
        return PfpError('cif_repetido', msg);
      }
      return PfpError('duplicado', msg);
    }

    if (estado === 0) return PfpError('network', msg);
    return PfpError('unknown', msg || ('HTTP ' + estado));
  }

  /* ---------------------------------------------------------------------
     Peticiones
     --------------------------------------------------------------------- */

  function pedir(ruta, opciones) {
    opciones = opciones || {};

    var cabeceras = { apikey: ANON, 'Content-Type': 'application/json' };
    if (opciones.token) cabeceras.Authorization = 'Bearer ' + opciones.token;
    if (opciones.cabeceras) {
      for (var k in opciones.cabeceras) cabeceras[k] = opciones.cabeceras[k];
    }

    return fetch(URL_BASE + ruta, {
      method: opciones.metodo || 'GET',
      headers: cabeceras,
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    })
      .catch(function () {
        throw PfpError('network', 'Sin conexión con el servidor.');
      })
      .then(function (respuesta) {
        if (respuesta.status === 204) return null;

        return respuesta.text().then(function (texto) {
          var datos = null;
          try {
            datos = texto ? JSON.parse(texto) : null;
          } catch (e) {
            datos = null;
          }
          if (!respuesta.ok) throw traducirError(respuesta.status, datos);
          return datos;
        });
      });
  }

  /* ---------------------------------------------------------------------
     Testigo vigente
     --------------------------------------------------------------------- */

  var refrescoEnCurso = null;

  /**
   * Devuelve un testigo válido, refrescándolo si hace falta.
   *
   * Las peticiones en paralelo comparten el mismo refresco: sin esto, tres
   * consultas simultáneas al cargar una página lanzarían tres refrescos, y
   * Supabase invalida el testigo anterior en cada uno — las dos últimas
   * fallarían con una sesión perfectamente válida.
   */
  function token() {
    var s = leerSesion();
    if (!s) return Promise.resolve(null);
    if (Date.now() < s.expira_en - MARGEN_MS) return Promise.resolve(s.access_token);
    if (!s.refresh_token) return Promise.resolve(null);

    if (!refrescoEnCurso) {
      refrescoEnCurso = pedir('/auth/v1/token?grant_type=refresh_token', {
        metodo: 'POST',
        cuerpo: { refresh_token: s.refresh_token },
      })
        .then(function (datos) {
          var nueva = conCaducidad(datos);
          guardarSesion(nueva);
          return nueva ? nueva.access_token : null;
        })
        .catch(function () {
          // El refresco caducado no es un error que enseñar: es sesión
          // terminada. Se limpia y quien llame verá que no hay usuario.
          guardarSesion(null);
          return null;
        })
        .then(function (t) {
          refrescoEnCurso = null;
          return t;
        });
    }
    return refrescoEnCurso;
  }

  /**
   * Petición autenticada. Falla con `sin_sesion` si no hay testigo.
   *
   * Y si el servidor contesta 401, la sesión guardada se BORRA antes de
   * propagar el error. Sin eso, un testigo que el servidor ya no acepta
   * —contraseña cambiada desde otro sitio, sesión revocada, secreto
   * rotado— seguía figurando como válido aquí porque su fecha de caducidad
   * local no había llegado. Y entonces pasaba esto:
   *
   *   `index.html` ve sesión → pide datos → 401 → manda a `entrar.html`
   *   `entrar.html` ve sesión → manda a `index.html` → y vuelta a empezar
   *
   * Un bucle entre las dos páginas, llamando al servidor en cada vuelta y
   * sin forma de salir salvo borrando los datos del navegador a mano.
   */
  function pedirAuth(ruta, opciones) {
    return token().then(function (t) {
      if (!t) throw PfpError('sin_sesion', 'La sesión ha caducado.');
      opciones = opciones || {};
      opciones.token = t;
      return pedir(ruta, opciones).catch(function (e) {
        if (e && e.codigo === 'sin_sesion') guardarSesion(null);
        throw e;
      });
    });
  }

  /* ---------------------------------------------------------------------
     Autenticación
     --------------------------------------------------------------------- */

  var auth = {
    /** ¿Hay sesión guardada? No garantiza que siga siendo válida. */
    haySesion: function () {
      return !!leerSesion();
    },

    /**
     * Alta.
     *
     * Con la confirmación de correo activada NO devuelve sesión: crea la
     * cuenta y manda un código. Se distinguen los dos finales igual que en
     * la app, porque la pantalla siguiente no es la misma.
     */
    signUp: function (email, password, fullName, role) {
      return pedir('/auth/v1/signup', {
        metodo: 'POST',
        cuerpo: {
          email: email,
          password: password,
          // El disparador `handle_new_user` lee estos metadatos.
          data: { full_name: fullName, role: role },
        },
      }).then(function (datos) {
        var sesion = conCaducidad(datos);
        if (sesion) {
          guardarSesion(sesion);
          return { estado: 'listo' };
        }
        return { estado: 'falta_verificar', email: email };
      });
    },

    signIn: function (email, password) {
      return pedir('/auth/v1/token?grant_type=password', {
        metodo: 'POST',
        cuerpo: { email: email, password: password },
      }).then(function (datos) {
        guardarSesion(conCaducidad(datos));
      });
    },

    /** Confirma el correo con el código de seis dígitos y abre sesión. */
    verificarCodigo: function (email, codigo) {
      return pedir('/auth/v1/verify', {
        metodo: 'POST',
        cuerpo: { type: 'signup', email: email, token: String(codigo).trim() },
      }).then(function (datos) {
        var s = conCaducidad(datos);
        if (!s) throw PfpError('invalid_code');
        guardarSesion(s);
      });
    },

    reenviarCodigo: function (email) {
      return pedir('/auth/v1/resend', {
        metodo: 'POST',
        cuerpo: { type: 'signup', email: email },
      });
    },

    /**
     * Pide el código para cambiar la contraseña.
     *
     * No distingue si el correo existe. Contestar «esa cuenta no existe»
     * convertiría el formulario en una forma cómoda de averiguar quién está
     * registrado, y aquí eso significa saber quién ha pedido ayuda tras una
     * emergencia. Solo se deja pasar el límite de envíos, que no revela
     * nada de nadie.
     */
    pedirRecuperacion: function (email) {
      return pedir('/auth/v1/recover', {
        metodo: 'POST',
        cuerpo: { email: email },
      }).catch(function (e) {
        if (e.codigo === 'rate_limited' || e.codigo === 'network') throw e;
      });
    },

    /** Canjea el código de recuperación y deja la contraseña nueva puesta. */
    cambiarContrasena: function (email, codigo, nueva) {
      return pedir('/auth/v1/verify', {
        metodo: 'POST',
        cuerpo: { type: 'recovery', email: email, token: String(codigo).trim() },
      })
        .then(function (datos) {
          var s = conCaducidad(datos);
          if (!s) throw PfpError('invalid_code');
          guardarSesion(s);
          return s.access_token;
        })
        .then(function (t) {
          return pedir('/auth/v1/user', {
            metodo: 'PUT',
            token: t,
            cuerpo: { password: nueva },
          });
        });
    },

    /** Datos de la cuenta desde el servidor, o null si no hay sesión. */
    usuario: function () {
      return pedirAuth('/auth/v1/user').catch(function (e) {
        if (e.codigo === 'sin_sesion') return null;
        throw e;
      });
    },

    signOut: function () {
      var s = leerSesion();
      guardarSesion(null);
      if (!s) return Promise.resolve();
      // Se avisa al servidor, pero la sesión local ya está borrada: que la
      // red falle no puede dejar a alguien dentro tras pulsar «salir».
      return pedir('/auth/v1/logout', { metodo: 'POST', token: s.access_token }).catch(
        function () {},
      );
    },
  };

  /* ---------------------------------------------------------------------
     Datos
     --------------------------------------------------------------------- */

  var db = {
    /** SELECT. `consulta` es la cadena de PostgREST ya montada. */
    select: function (tabla, consulta) {
      return pedirAuth('/rest/v1/' + tabla + '?' + (consulta || 'select=*'));
    },

    insert: function (tabla, fila, devolver) {
      return pedirAuth('/rest/v1/' + tabla, {
        metodo: 'POST',
        cuerpo: fila,
        cabeceras: { Prefer: devolver ? 'return=representation' : 'return=minimal' },
      });
    },

    /**
     * DELETE con filtro.
     *
     * PostgREST exige el filtro en la URL y borra TODO lo que encaje. No
     * hay proteccion contra un filtro olvidado mas alla de las politicas
     * RLS, asi que aqui se rechaza una consulta vacia antes de salir: un
     * `delete` sin `where` contra una tabla es un accidente, nunca una
     * intencion.
     */
    delete: function (tabla, consulta) {
      if (!consulta) return Promise.reject(PfpError('unknown', 'Borrado sin filtro.'));
      return pedirAuth('/rest/v1/' + tabla + '?' + consulta, {
        metodo: 'DELETE',
        cabeceras: { Prefer: 'return=minimal' },
      });
    },

    update: function (tabla, consulta, cambios) {
      return pedirAuth('/rest/v1/' + tabla + '?' + consulta, {
        metodo: 'PATCH',
        cuerpo: cambios,
        cabeceras: { Prefer: 'return=minimal' },
      });
    },

    /**
     * Llama a una función del servidor.
     *
     * Es la puerta que importa: contratar un plan, crear una organización o
     * completar un alta pasan por aquí y no por un INSERT suelto, igual que
     * en la app. El precio, el estado y los permisos los decide el
     * servidor; si viajaran desde el navegador, cualquiera los cambiaría.
     */
    rpc: function (funcion, argumentos) {
      return pedirAuth('/rest/v1/rpc/' + funcion, {
        metodo: 'POST',
        cuerpo: argumentos || {},
      });
    },
  };

  /* ---------------------------------------------------------------------
     Funciones del servidor (Edge Functions)
     --------------------------------------------------------------------- */

  var fn = {
    /**
     * Invoca una Edge Function con la sesion de quien esta dentro.
     *
     * Va por `/functions/v1/` y no por `/rest/v1/`, que es otro servicio con
     * otra ruta. Lo usa el asistente: sin esto, escribirle desde la web
     * guardaria el mensaje y no contestaria nadie.
     */
    invoke: function (nombre, cuerpo) {
      return pedirAuth('/functions/v1/' + nombre, {
        metodo: 'POST',
        cuerpo: cuerpo || {},
      });
    },
  };

  window.PFP = {
    configurado: !!(URL_BASE && ANON),
    auth: auth,
    db: db,
    fn: fn,
    error: PfpError,
  };
})();
