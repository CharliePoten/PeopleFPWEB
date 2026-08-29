/* ==========================================================================
   Altas: voluntario y entidad
   --------------------------------------------------------------------------
   Los dos formularios largos del área de cuenta. Escriben exactamente los
   mismos campos que la app —mismas tablas, mismas funciones, mismo orden—
   porque son el mismo proceso visto desde otra pantalla, no uno paralelo.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  var UI = window.PFP_UI;
  if (!PFP || !UI) return;

  var $ = UI.$;
  var $$ = UI.$$;

  /* Versión del acuerdo de incorporación. Tiene que ir a la par con
     `AGREEMENT_VERSION` de `src/lib/data/profiles.ts`: es lo que deja
     constancia de QUÉ texto acepto cada persona, y si las dos plataformas
     guardan versiones distintas el registro deja de valer como prueba. */
  var VERSION_ACUERDO = '2026-08-1';

  var DISTANCIAS = [10000, 25000, 50000, 100000];

  var MODOS = [
    ['emergency_only', 'c.vol.modoEmergencia', 'c.vol.modoEmergenciaSub'],
    ['scheduled_only', 'c.vol.modoPlan', 'c.vol.modoPlanSub'],
    ['both', 'c.vol.modoAmbos', 'c.vol.modoAmbosSub'],
  ];

  /* =====================================================================
     ALTA DE VOLUNTARIO
     ===================================================================== */

  /* ---------------------------------------------------------------------
     La ficha
     ---------------------------------------------------------------------
     Todo lo que hay dado de alta, sin poder tocarlo. Editar es un paso
     aparte y a propositio: en esta pantalla se viene sobre todo a MIRAR
     —comprobar que el telefono es el bueno antes de una emergencia— y un
     formulario abierto invita a cambiar algo sin querer. */

  function esc(t) {
    return UI.escapar ? UI.escapar(t) : String(t == null ? '' : t);
  }

  function dato(clave, valor, apunte) {
    return (
      '<li><span><strong>' + esc(UI.T(clave)) + '</strong>' +
      (apunte ? '<small>' + esc(apunte) + '</small>' : '') + '</span>' +
      '<span class="estado__valor">' +
      (valor ? esc(valor) : '<span class="marca marca--espera">' + esc(UI.T('c.perfil.sinDato')) + '</span>') +
      '</span></li>'
    );
  }

  function tarjeta(titulo, filas) {
    return (
      '<div class="tarjeta"><div class="tarjeta__cab"><h2>' + esc(UI.T(titulo)) + '</h2></div>' +
      '<ul class="lista-estado">' + filas.join('') + '</ul></div>'
    );
  }

  function fechaSola(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  var TEXTO_MODO = {
    emergency_only: 'c.vol.modoEmergencia',
    scheduled_only: 'c.vol.modoPlan',
    both: 'c.vol.modoAmbos',
  };

  var TEXTO_DOC = { cv: 'c.perfil.docCv', credential: 'c.perfil.docAcred', other: 'c.perfil.docOtro' };

  function nombreHabilidad(id) {
    var idioma = document.documentElement.lang === 'de' ? 'de' : 'es';
    var h = (window.PFP_HABILIDADES || []).filter(function (x) { return x.id === id; })[0];
    return h ? h[idioma] || h.es : id;
  }

  function pintarFicha(d) {
    var perfil = d.perfil;
    var idioma = document.documentElement.lang === 'de' ? 'de' : 'es';

    var html = '';

    /* --- Quien eres --- */
    html += tarjeta('c.perfil.identidad', [
      dato('c.perfil.nombre', perfil.full_name),
      dato('c.email', perfil.email),
      dato('c.vol.tel', perfil.phone, UI.T('c.vol.telAyuda')),
      dato('c.perfil.donde', [perfil.city, perfil.province].filter(Boolean).join(', ')),
    ]);

    /* --- Como puedes ayudar --- */
    html += tarjeta('c.perfil.ayuda', [
      dato('c.perfil.avisos', perfil.response_mode ? UI.T(TEXTO_MODO[perfil.response_mode]) : ''),
      dato('c.perfil.distancia', perfil.max_travel_distance_m
        ? Math.round(perfil.max_travel_distance_m / 1000) + ' km' : ''),
      dato('c.perfil.vehiculo', UI.T(perfil.has_vehicle ? 'c.perfil.si' : 'c.perfil.no')),
      dato('c.perfil.ubicacion', UI.T(perfil.home_location ? 'c.perfil.ubiGuardada' : 'c.perfil.ubiNo')),
    ]);

    /* --- Habilidades --- */
    var hab = d.habilidades || [];
    html +=
      '<div class="tarjeta"><div class="tarjeta__cab"><h2>' + esc(UI.T('c.a.habilidades')) + '</h2></div>' +
      (hab.length
        ? '<div class="tarjeta__cuerpo"><div class="etiquetas">' +
          hab.map(function (h) {
            return (
              '<span class="etiqueta' + (h.status === 'verified' ? ' etiqueta--acreditada' : '') + '">' +
              esc(nombreHabilidad(h.skill_id)) +
              (h.requires_credential && h.status !== 'verified'
                ? ' · ' + esc(UI.T('c.a.sNone')) : '') +
              '</span>'
            );
          }).join('') + '</div></div>'
        : '<div class="tarjeta__vacio">' + esc(UI.T('c.a.sinHabilidades')) + '</div>') +
      '</div>';

    /* --- Documentos ---
       Se listan, no se abren: la web todavia no habla con el almacen de
       archivos, y un enlace que no descarga nada es peor que decirlo. */
    var docs = d.documentos || [];
    html +=
      '<div class="tarjeta"><div class="tarjeta__cab"><h2>' + esc(UI.T('c.perfil.docs')) + '</h2>' +
      '<p>' + esc(UI.T('c.perfil.docsSub')) + '</p></div>' +
      (docs.length
        ? '<ul class="lista-estado">' +
          docs.map(function (x) {
            var apunte = [
              UI.T(TEXTO_DOC[x.kind] || 'c.perfil.docOtro'),
              x.skill_id ? nombreHabilidad(x.skill_id) : '',
              fechaSola(x.created_at),
            ].filter(Boolean).join(' · ');
            return (
              '<li><span><strong>' + esc(x.title) + '</strong><small>' + esc(apunte) + '</small></span>' +
              (x.shared_with_orgs
                ? '<span class="marca marca--ok">' + esc(UI.T('c.perfil.compartido')) + '</span>'
                : '<span class="etiqueta">' + esc(UI.T('c.perfil.soloTuyo')) + '</span>') +
              '</li>'
            );
          }).join('') + '</ul>'
        : '<div class="tarjeta__vacio">' + esc(UI.T('c.perfil.sinDocs')) + '</div>') +
      '</div>';

    /* --- Lo que aceptaste, con su fecha --- */
    html += tarjeta('c.perfil.consent', [
      dato('c.perfil.acuerdo',
        perfil.agreement_accepted_at ? fechaSola(perfil.agreement_accepted_at) : '',
        perfil.agreement_version ? UI.T('c.perfil.version') + ' ' + perfil.agreement_version : ''),
      dato('c.perfil.privacidad',
        perfil.privacy_accepted_at ? fechaSola(perfil.privacy_accepted_at) : ''),
    ]);

    $('#ficha').innerHTML = html;
    if (UI.retraducir) UI.retraducir();
  }

  function paginaVoluntario() {
    if (!UI.exigirSesion()) return;

    var datos = { perfil: null, habilidades: [], documentos: [] };

    PFP.consola
      .montar()
      .then(function () {
        return Promise.all([
          PFP.db.select(
            'profiles',
            'select=id,full_name,email,phone,city,province,photo_url,response_mode,' +
              'max_travel_distance_m,has_vehicle,home_location,agreement_version,' +
              'agreement_accepted_at,privacy_accepted_at,location_consent_at,onboarding_complete&limit=1',
          ),
          PFP.db.rpc('my_skills').catch(function () { return []; }),
          PFP.db
            .select('profile_documents', 'select=id,kind,title,skill_id,shared_with_orgs,created_at&order=created_at.desc')
            .catch(function () { return []; }),
        ]);
      })
      .then(function (r) {
        datos.perfil = (r[0] || [])[0];
        if (!datos.perfil) throw PFP.error('sin_sesion');
        datos.habilidades = r[1] || [];
        datos.documentos = r[2] || [];

        montarEditorVoluntario(datos);
      })
      .catch(function (err) {
        if (err && err.codigo === 'sin_sesion') return UI.ir('entrar.html');
        UI.avisar('aviso', UI.explicar(err), 'error');
      });
  }

  function montarEditorVoluntario(datos) {
    var perfil = datos.perfil;

    /* El estado del formulario arranca de lo que ya hay, no de los valores
       por defecto: si no, abrir a editar y guardar sin tocar nada dejaria a
       cualquiera con diez kilometros y sin habilidades. */
    var elegidas = {};
    (datos.habilidades || []).forEach(function (h) { elegidas[h.skill_id] = true; });

    var distancia = perfil.max_travel_distance_m || 10000;
    var modo = perfil.response_mode || 'both';
    var punto = null;
    var ubicacionTocada = false;

    /* --- Modo de respuesta --- */
    var cajaModos = $('#modos');
    MODOS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcion';
      b.setAttribute('aria-pressed', String(m[0] === modo));
      b.innerHTML =
        '<span class="opcion__texto"><strong data-i18n="' + m[1] + '">' + UI.T(m[1]) +
        '</strong><span data-i18n="' + m[2] + '">' + UI.T(m[2]) + '</span></span>';
      b.addEventListener('click', function () {
        modo = m[0];
        $$('#modos .opcion').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
      });
      cajaModos.appendChild(b);
    });

    /* --- Distancia --- */
    var cajaDist = $('#distancias');
    DISTANCIAS.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pastilla';
      b.textContent = d / 1000 + ' km';
      b.setAttribute('aria-pressed', String(d === distancia));
      b.addEventListener('click', function () {
        distancia = d;
        $$('#distancias .pastilla').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
      });
      cajaDist.appendChild(b);
    });

    /* --- Habilidades, agrupadas por categoría --- */
    var cat = (window.PFP_CATEGORIAS || {}).es || {};
    var porCategoria = {};
    (window.PFP_HABILIDADES || []).forEach(function (h) {
      (porCategoria[h.cat] = porCategoria[h.cat] || []).push(h);
    });

    var cajaHab = $('#habilidades');
    Object.keys(porCategoria).forEach(function (c) {
      var titulo = document.createElement('p');
      titulo.className = 'estado__clave';
      titulo.style.margin = '14px 0 8px';
      titulo.setAttribute('data-es', (window.PFP_CATEGORIAS.es || {})[c] || c);
      titulo.setAttribute('data-de', (window.PFP_CATEGORIAS.de || {})[c] || c);
      titulo.textContent = titulo.getAttribute('data-' + (document.documentElement.lang || 'es'));
      cajaHab.appendChild(titulo);

      var grupo = document.createElement('div');
      grupo.className = 'pastillas';
      porCategoria[c].forEach(function (h) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pastilla';
        // La acreditación se marca, no se esconde: quien no la tenga debe
        // saber antes de apuntarse que luego habrá que subir un papel.
        // Las dos versiones viajan en el elemento: al cambiar de idioma,
        // `PFP_UI.retraducir()` las intercambia sin recargar la pagina.
        b.setAttribute('data-es', h.es + (h.cred ? ' \u00b7 ' + window.I18N.es['c.vol.acreditacion'] : ''));
        b.setAttribute('data-de', h.de + (h.cred ? ' \u00b7 ' + window.I18N.de['c.vol.acreditacion'] : ''));
        b.textContent = b.getAttribute('data-' + (document.documentElement.lang || 'es'));
        b.setAttribute('aria-pressed', String(!!elegidas[h.id]));
        b.addEventListener('click', function () {
          if (elegidas[h.id]) delete elegidas[h.id];
          else elegidas[h.id] = true;
          b.setAttribute('aria-pressed', String(!!elegidas[h.id]));
        });
        grupo.appendChild(b);
      });
      cajaHab.appendChild(grupo);
    });

    /* --- Ubicación del navegador ---
       Solo si se marca la casilla, y solo entonces se pide el permiso. Pedir
       la ubicación nada más abrir la página es la forma más rápida de que
       alguien diga que no para siempre. */
    var casillaUbi = $('#ubicacion');
    var estadoUbi = $('#estado-ubicacion');

    casillaUbi.addEventListener('change', function () {
      ubicacionTocada = true;
      if (!casillaUbi.checked) {
        punto = null;
        estadoUbi.textContent = '';
        return;
      }
      if (!navigator.geolocation) {
        estadoUbi.textContent = UI.T('c.u.sinSoporte');
        return;
      }
      estadoUbi.textContent = UI.T('c.u.pidiendo');
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          estadoUbi.textContent = UI.T('c.u.guardada');
        },
        function () {
          // Que lo deniegue no invalida el alta: la casilla se desmarca y
          // el resto del formulario sigue siendo válido.
          casillaUbi.checked = false;
          punto = null;
          estadoUbi.textContent = UI.T('c.u.denegadaVol');
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });

    /* --- Lo que ya hay, dentro del formulario --- */
    $('#telefono').value = perfil.phone || '';
    $('#ciudad').value = perfil.city || '';
    $('#provincia').value = perfil.province || '';
    $('#vehiculo').checked = !!perfil.has_vehicle;
    /* El acuerdo ya aceptado se enseña marcado: obligar a volver a marcarlo
       para cambiar un teléfono haría pensar que se está aceptando otra vez
       algo que ya se aceptó. */
    $('#acuerdo').checked = !!perfil.agreement_accepted_at;
    casillaUbi.checked = !!perfil.home_location;
    if (perfil.home_location) estadoUbi.textContent = UI.T('c.perfil.ubiGuardada');

    /* --- Ficha o formulario ---
       Con el perfil sin terminar se abre directo el formulario: esta pantalla
       es también el alta, y a quien acaba de registrarse no se le enseña una
       ficha vacía con un botón. */
    var completo = !!perfil.onboarding_complete;

    function modoEdicion(si) {
      $('#editor').hidden = !si;
      $('#ficha').hidden = si;
      $('#perfil-acciones').innerHTML = si
        ? (completo
            ? '<button class="btn btn--ghost btn--small" type="button" id="btn-cancelar">' +
              esc(UI.T('c.a.cancelar')) + '</button>'
            : '')
        : '<button class="btn btn--primary btn--small" type="button" id="btn-editar">' +
          esc(UI.T('c.perfil.editar')) + '</button>';

      var editar = $('#btn-editar');
      if (editar) editar.addEventListener('click', function () { modoEdicion(true); });

      var cancelar = $('#btn-cancelar');
      if (cancelar) {
        cancelar.addEventListener('click', function () {
          UI.limpiarAvisos();
          modoEdicion(false);
        });
      }
    }

    pintarFicha(datos);
    modoEdicion(!completo);

    /* --- Envío --- */
    $('#form-voluntario').addEventListener('submit', function (ev) {
      ev.preventDefault();
      UI.limpiarAvisos();

      var telefono = $('#telefono').value.trim();
      var ciudad = $('#ciudad').value.trim();
      var provincia = $('#provincia').value.trim();
      var web = ($('#web') && $('#web').value.trim()) || '';
      var vehiculo = $('#vehiculo').checked;
      var acuerdo = $('#acuerdo').checked;

      if (!/^[+0-9 ()-]{9,20}$/.test(telefono)) {
        return UI.avisar('aviso', UI.T('c.vol.errTel'));
      }
      if (ciudad.length < 2) return UI.avisar('aviso', UI.T('c.vol.errCiudad'));
      if (provincia.length < 2) return UI.avisar('aviso', UI.T('c.vol.errProvincia'));
      if (!acuerdo) {
        return UI.avisar('aviso', UI.T('c.vol.errAcuerdo'));
      }

      var boton = $('#btn-guardar');
      UI.ocupado(boton, true, UI.T('c.rec.guardando'));

      var ahora = new Date().toISOString();
      var ids = Object.keys(elegidas);

      PFP.db
        .select('profiles', 'select=id&limit=1')
        .then(function (filas) {
          var yo = filas && filas[0];
          if (!yo) throw PFP.error('sin_sesion');

          var cambios = {
            phone: telefono,
            city: ciudad,
            province: provincia,
            has_vehicle: vehiculo,
            response_mode: modo,
            max_travel_distance_m: distancia,
            onboarding_complete: true,
            updated_at: ahora,
          };

          /* La ubicación solo se toca si se ha tocado la casilla. `punto`
             únicamente tiene valor cuando se acaba de dar permiso, así que
             mandarlo siempre borraría la ubicación guardada al cambiar
             cualquier otra cosa. */
          if (ubicacionTocada) {
            // PostGIS acepta WKT por texto. Igual que en la app.
            cambios.home_location = punto
              ? 'SRID=4326;POINT(' + punto.lng + ' ' + punto.lat + ')'
              : null;
            cambios.location_consent_at = punto ? ahora : null;
          }

          /* La fecha del acuerdo es el registro de CUÁNDO se aceptó, y sirve
             de prueba a efectos de la Ley 45/2015. Solo se estampa si no
             había ninguna, o si el texto ha cambiado de versión desde
             entonces. Reescribirla al corregir una ciudad la falsearía. */
          if (perfil.agreement_accepted_at !== null &&
              perfil.agreement_version === VERSION_ACUERDO) {
            // Ya aceptado, y de este mismo texto: no se toca.
          } else {
            cambios.agreement_version = VERSION_ACUERDO;
            cambios.agreement_accepted_at = ahora;
          }

          if (!perfil.privacy_accepted_at) cambios.privacy_accepted_at = ahora;

          var filtroMio = 'profile_id=eq.' + encodeURIComponent(yo.id);

          return PFP.db
            .update('profiles', 'id=eq.' + encodeURIComponent(yo.id), cambios)
            .then(function () {
              // Reemplazo completo, igual que en la app: se borra y se
              // vuelve a insertar, porque el alta tambien sirve para
              // editar y puede haberse desmarcado alguna habilidad.
              return PFP.db.delete('volunteer_skills', filtroMio);
            })
            .then(function () {
              if (!ids.length) return null;
              return PFP.db.insert(
                'volunteer_skills',
                ids.map(function (id) {
                  return { profile_id: yo.id, skill_id: id, credential_status: 'none' };
                }),
              );
            });
        })
        .then(function () {
          if (!completo) return UI.ir('index.html');

          /* Editando: se recarga lo guardado y se vuelve a la ficha. Repintar
             con lo que había en pantalla enseñaría lo que creemos haber
             guardado, no lo que hay. */
          return Promise.all([
            PFP.db.select(
              'profiles',
              'select=id,full_name,email,phone,city,province,photo_url,response_mode,' +
                'max_travel_distance_m,has_vehicle,home_location,agreement_version,' +
                'agreement_accepted_at,privacy_accepted_at,location_consent_at,onboarding_complete&limit=1',
            ),
            PFP.db.rpc('my_skills').catch(function () { return []; }),
          ]).then(function (r) {
            datos.perfil = (r[0] || [])[0] || datos.perfil;
            datos.habilidades = r[1] || [];
            perfil = datos.perfil;
            UI.ocupado(boton, false);
            pintarFicha(datos);
            modoEdicion(false);
            UI.avisar('aviso', UI.T('c.a.guardado'), 'ok');
          });
        })
        .catch(function (e) {
          UI.ocupado(boton, false);
          UI.avisar('aviso', UI.explicar(e));
        });
    });
  }


  /* =====================================================================
     ALTA DE ENTIDAD
     =====================================================================
     Tres escrituras, en el mismo orden que la app: la organizacion, el
     alta de quien la crea como responsable, y el perfil marcado como
     completo. Los servicios de emergencia no se ofrecen aqui tampoco:
     bomberos, policia local y proteccion civil dependen de su
     ayuntamiento, y Cruz Roja es una ONG. */

  var TIPOS = [
    ['ngo', 'c.org.ngo', 'c.org.ngoSub'],
    ['municipality', 'c.org.muni', 'c.org.muniSub'],
    ['company', 'c.org.emp', 'c.org.empSub'],
  ];

  function paginaOrganizacion() {
    if (!UI.exigirSesion()) return;

    var tipo = 'ngo';
    var punto = null;

    var cajaTipos = $('#tipos');
    TIPOS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcion';
      b.setAttribute('aria-pressed', String(t[0] === tipo));
      b.innerHTML =
        '<span class="opcion__texto"><strong data-i18n="' + t[1] + '">' + UI.T(t[1]) +
        '</strong><span data-i18n="' + t[2] + '">' + UI.T(t[2]) + '</span></span>';
      b.addEventListener('click', function () {
        tipo = t[0];
        $$('#tipos .opcion').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        pintarTamano();
      });
      cajaTipos.appendChild(b);
    });

    var casillaUbi = $('#ubicacion');
    var estadoUbi = $('#estado-ubicacion');
    casillaUbi.addEventListener('change', function () {
      ubicacionTocada = true;
      if (!casillaUbi.checked) {
        punto = null;
        estadoUbi.textContent = '';
        return;
      }
      if (!navigator.geolocation) {
        estadoUbi.textContent = UI.T('c.u.sinSoporte');
        return;
      }
      estadoUbi.textContent = UI.T('c.u.pidiendo');
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          estadoUbi.textContent = UI.T('c.u.guardada');
        },
        function () {
          casillaUbi.checked = false;
          punto = null;
          estadoUbi.textContent = UI.T('c.u.denegadaOrg');
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });

    /* --- Tamano de la entidad ---
       Se pregunta el NUMERO, no el tramo: voluntarios, habitantes o
       empleados. El tramo lo deriva el servidor. Si lo eligiera el
       navegador, cualquiera se pondria «pequena» y pagaria 19 € teniendo
       mil voluntarios.

       La tarifa se calcula mientras se escribe: verla ANTES de enviar evita
       la sorpresa de descubrirla despues de una verificacion de dos dias. */
    var campoTamano = $('#tamano');
    var etiquetaTamano = $('#etiqueta-tamano');
    var avisoTarifa = $('#tarifa-estimada');

    function pintarTamano() {
      etiquetaTamano.textContent = UI.T(
        { ngo: 'c.pl.askVolunteers', municipality: 'c.pl.askPopulation' }[tipo] ||
          'c.pl.askEmployees',
      );

      var n = Number(campoTamano.value.replace(/\D/g, '')) || 0;
      if (!n) {
        avisoTarifa.textContent = '';
        avisoTarifa.setAttribute('data-visible', 'false');
        return;
      }

      var tramo = window.PFP_TRAMO(tipo, n);
      var cents = window.PFP_PRECIO(tipo, tramo);
      var euros = new Intl.NumberFormat(
        document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES',
        { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 },
      ).format(cents / 100);

      avisoTarifa.textContent = UI.T('c.pl.estimated')
        .replace('{{size}}', UI.T('c.pl.size_' + tramo).toLowerCase())
        .replace('{{price}}', euros);
      avisoTarifa.setAttribute('data-visible', 'true');
    }

    campoTamano.addEventListener('input', function () {
      campoTamano.value = campoTamano.value.replace(/\D/g, '');
      pintarTamano();
    });
    pintarTamano();

    /* El CIF se normaliza al salir del campo. Ver como se convierte solo en
       mayusculas y sin guiones confirma que se ha entendido, y quita la
       duda de si habia que escribirlo de otra forma. */
    /* --- Provincias ---
       Lista cerrada. Escrita a mano entraban «Alicante», «alicante» y
       «Alacant» como tres provincias distintas, y luego no se puede ni
       filtrar ni fiarse del dato al verificar. */
    var selProvincia = $('#provincia');
    if (selProvincia && !selProvincia.options.length) {
      var vacia = document.createElement('option');
      vacia.value = '';
      vacia.textContent = UI.T('c.org.provinciaElige');
      selProvincia.appendChild(vacia);
      (window.PFP_PROVINCIAS || []).forEach(function (nombre) {
        var o = document.createElement('option');
        o.value = nombre;
        o.textContent = nombre;
        selProvincia.appendChild(o);
      });
    }

    var campoCif = $('#cif');
    campoCif.addEventListener('blur', function () {
      if (campoCif.value.trim()) campoCif.value = window.PFP_NIF.normalizar(campoCif.value);
    });

    $('#form-organizacion').addEventListener('submit', function (ev) {
      ev.preventDefault();
      UI.limpiarAvisos();

      var razon = $('#razon').value.trim();
      var nombre = $('#nombre').value.trim();
      var cif = window.PFP_NIF.normalizar(campoCif.value);
      var calle = $('#calle').value.trim();
      var ciudad = $('#ciudad').value.trim();
      var provincia = $('#provincia').value.trim();
      var cp = $('#cp').value.trim();
      var telefono = $('#telefono').value.trim();
      var acepta = $('#acepta').checked;

      if (razon.length < 3) return UI.avisar('aviso', UI.T('c.org.errRazon'));
      if (nombre.length < 2) return UI.avisar('aviso', UI.T('c.org.errNombre'));
      var tamano = Number(campoTamano.value.replace(/\D/g, '')) || 0;

      if (!window.PFP_NIF.valido(cif)) {
        return UI.avisar('aviso', UI.T('c.org.errCif'));
      }
      if (calle.length < 3) return UI.avisar('aviso', UI.T('c.org.errCalle'));
      if (ciudad.length < 2) return UI.avisar('aviso', UI.T('c.org.errCiudad'));
      if (!provincia) return UI.avisar('aviso', UI.T('c.org.errProvincia'));
      if (!/^[0-9]{5}$/.test(cp)) return UI.avisar('aviso', UI.T('c.org.errCp'));
      if (!/^[+0-9 ()-]{9,20}$/.test(telefono)) {
        return UI.avisar('aviso', UI.T('c.vol.errTel'));
      }
      if (tamano < 1) return UI.avisar('aviso', UI.T('c.pl.askError'));
      if (!acepta) return UI.avisar('aviso', UI.T('c.org.errTerminos'));

      var boton = $('#btn-crear');
      UI.ocupado(boton, true, UI.T('c.org.enviando'));

      PFP.db
        .select('profiles', 'select=id,email&limit=1')
        .then(function (filas) {
          var yo = filas && filas[0];
          if (!yo) throw PFP.error('sin_sesion');

          return PFP.db
            .insert(
              'organizations',
              {
                kind: tipo,
                legal_name: razon,
                display_name: nombre,
                tax_id: cif,
                street: calle,
                city: ciudad,
                province: provincia,
                postal_code: cp,
                country: 'ES',
                location: punto ? 'SRID=4326;POINT(' + punto.lng + ' ' + punto.lat + ')' : null,
                contact_email: yo.email,
                contact_phone: telefono,
                website: web || null,
                created_by: yo.id,
              },
              true
            )
            .then(function (creada) {
              var org = creada && creada[0];
              if (!org) throw PFP.error('unknown', UI.T('c.org.noCreada'));

              // Quien la da de alta queda como responsable. Sin esto la
              // entidad existe y nadie puede administrarla.
              return PFP.db
                .insert('organization_members', {
                  organization_id: org.id,
                  profile_id: yo.id,
                  is_admin: true,
                })
                .then(function () {
                  // Despues del alta como responsable: la funcion comprueba
                  // `is_org_admin`, y hasta que existe la fila de miembro
                  // nadie lo es todavia.
                  return PFP.db.rpc('declare_org_size', {
                    p_org: org.id,
                    p_metric: tamano,
                  });
                })
                .then(function () {
                  return PFP.db.update('profiles', 'id=eq.' + encodeURIComponent(yo.id), {
                    onboarding_complete: true,
                    updated_at: new Date().toISOString(),
                  });
                })
                .then(function () {
                  return nombre;
                });
            });
        })
        .then(function (nombreCreado) {
          try {
            sessionStorage.setItem('pfp.entidadCreada', nombreCreado);
          } catch (e) {}
          UI.ir('enviada.html');
        })
        .catch(function (e) {
          UI.ocupado(boton, false);
          UI.avisar('aviso', UI.explicar(e));
        });
    });
  }

  /* Confirmacion tras enviar.
     Sin ella el formulario terminaba y la pantalla cambiaba sin decir nada:
     despues de rellenar el CIF, la direccion y el telefono, que no pase
     nada visible se lee como que ha fallado, y la reaccion natural es
     volver a enviarlo. Igual que en la app. */
  function paginaEnviada() {
    var nombre = '';
    try {
      nombre = sessionStorage.getItem('pfp.entidadCreada') || '';
    } catch (e) {}
    var destino = $('#nombre-entidad');
    if (destino) destino.textContent = nombre || 'tu entidad';
  }

  /* =====================================================================
     ARRANQUE
     ===================================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    var pagina = document.body.dataset.pagina;
    if (pagina === 'voluntario') paginaVoluntario();
    if (pagina === 'organizacion') paginaOrganizacion();
    if (pagina === 'enviada') paginaEnviada();
  });
})();
