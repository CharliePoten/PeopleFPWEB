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

  function paginaVoluntario() {
    if (!UI.exigirSesion()) return;

    var elegidas = {};
    var distancia = 10000;
    var modo = 'both';
    var punto = null;

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
        b.setAttribute('aria-pressed', 'false');
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

    /* --- Envío --- */
    $('#form-voluntario').addEventListener('submit', function (ev) {
      ev.preventDefault();
      UI.limpiarAvisos();

      var telefono = $('#telefono').value.trim();
      var ciudad = $('#ciudad').value.trim();
      var provincia = $('#provincia').value.trim();
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
            // PostGIS acepta WKT por texto. Igual que en la app.
            home_location: punto ? 'SRID=4326;POINT(' + punto.lng + ' ' + punto.lat + ')' : null,
            agreement_version: VERSION_ACUERDO,
            agreement_accepted_at: ahora,
            privacy_accepted_at: ahora,
            location_consent_at: punto ? ahora : null,
            onboarding_complete: true,
            updated_at: ahora,
          };

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
          UI.ir('index.html');
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
      });
      cajaTipos.appendChild(b);
    });

    var casillaUbi = $('#ubicacion');
    var estadoUbi = $('#estado-ubicacion');
    casillaUbi.addEventListener('change', function () {
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

    /* El CIF se normaliza al salir del campo. Ver como se convierte solo en
       mayusculas y sin guiones confirma que se ha entendido, y quita la
       duda de si habia que escribirlo de otra forma. */
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
      if (!window.PFP_NIF.valido(cif)) {
        return UI.avisar('aviso', UI.T('c.org.errCif'));
      }
      if (calle.length < 3) return UI.avisar('aviso', UI.T('c.org.errCalle'));
      if (ciudad.length < 2) return UI.avisar('aviso', UI.T('c.org.errCiudad'));
      if (provincia.length < 2) return UI.avisar('aviso', UI.T('c.org.errProvincia'));
      if (!/^[0-9]{5}$/.test(cp)) return UI.avisar('aviso', UI.T('c.org.errCp'));
      if (!/^[+0-9 ()-]{9,20}$/.test(telefono)) {
        return UI.avisar('aviso', UI.T('c.vol.errTel'));
      }
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
