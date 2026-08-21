/* ==========================================================================
   Tarifa y pago
   --------------------------------------------------------------------------
   No hay catalogo que elegir, y por eso esto no es una lista. El tamano se
   declara al dar de alta, alguien del equipo lo confirma al verificar, y la
   tarifa sale sola del tipo y del tramo. Ensenarla como opciones invitaria a
   escoger la mas barata, que es justo lo que el modelo no permite.

   Contratar pasa por `start_subscription()`, la misma funcion que usa la
   app. Esa funcion es la que calcula el importe, comprueba que quien
   contrata es responsable, exige que la entidad este verificada y con el
   tamano confirmado, y evita duplicar una suscripcion. Nada de eso puede
   vivir en el navegador.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  var UI = window.PFP_UI;
  if (!PFP || !UI) return;

  var $ = UI.$;
  var $$ = UI.$$;

  function idioma() {
    return document.documentElement.lang === 'de' ? 'de' : 'es';
  }

  /** 1900 -> «19 €». Sin decimales cuando son cero, que es siempre aqui. */
  function euros(centimos) {
    return new Intl.NumberFormat(idioma() === 'de' ? 'de-DE' : 'es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(centimos / 100);
  }

  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** «19 € al mes», con el precio ya puesto. */
  function alMes(centimos) {
    return UI.T('c.pl.perMonth').replace('{{price}}', euros(centimos));
  }

  /** Clave del detalle de un tramo. Depende del tipo: no dice lo mismo. */
  function claveDetalle(tipo, tramo) {
    return 'c.pl.band_' + (tipo === 'municipality' ? 'muni' : 'org') + '_' + tramo;
  }

  /* =====================================================================
     TU TARIFA
     ===================================================================== */

  function paginaPlanes() {
    if (!UI.exigirSesion()) return;

    var caja = $('#lista-planes');
    var boton = $('#btn-continuar');

    UI.cargarEstado()
      .then(function (e) {
        var org = e.organizacion;

        if (!org) {
          caja.innerHTML =
            '<p class="field__hint">' + UI.T('c.pl.primero') + '</p>' +
            '<a class="btn btn--primary" href="organizacion.html">' + UI.T('c.pl.darla') + '</a>';
          boton.style.display = 'none';
          return;
        }

        // Ya hay plan en vigor: no se contrata otro encima. El servidor lo
        // rechaza igualmente, pero ofrecerlo y luego negarlo hace perder el
        // tiempo.
        if (e.plan && e.plan.status === 'active') {
          caja.innerHTML =
            '<p class="field__hint">' + UI.T('c.pl.yaHay') + ' ' +
            escapar((window.PFP_COBRO || {}).correo || '') + '.</p>';
          boton.style.display = 'none';
          return;
        }

        // Sin tramo confirmado no hay precio que enseñar, y el servidor
        // rechazaria la contratacion igualmente. Se dice por que en vez de
        // dejar la pantalla en blanco.
        if (!org.tramo) {
          caja.innerHTML =
            '<div class="aviso aviso--espera" data-visible="true"><strong>' +
            UI.T('c.pl.sizePendingTitle') + '</strong><br>' +
            UI.T(org.tramoDeclarado ? 'c.pl.sizePendingBody' : 'c.pl.sizeMissingBody') +
            '</div>';
          boton.style.display = 'none';
          return;
        }

        var precio = window.PFP_PRECIO(org.tipo, org.tramo);

        caja.innerHTML =
          '<div class="plan" aria-pressed="true"><span class="plan__cabeza">' +
          '<span class="plan__nombre">' + UI.T('c.pl.size_' + org.tramo) + '</span>' +
          '<span class="plan__precio">' + escapar(alMes(precio)) + '</span></span>' +
          '<p class="plan__detalle">' + UI.T(claveDetalle(org.tipo, org.tramo)) + '</p></div>' +
          '<p class="field__hint">' + UI.T('c.pl.monthlyHint') + '</p>';

        boton.disabled = false;
        boton.addEventListener('click', function () {
          UI.ir('pago.html');
        });
      })
      .catch(function (err) {
        if (err.codigo === 'sin_sesion') return UI.ir('entrar.html');
        UI.avisar('aviso', UI.explicar(err));
      });
  }

  /* =====================================================================
     PAGAR
     ===================================================================== */

  /**
   * Dos formas, y la diferencia no es de gusto.
   *
   *   · TARJETA. Cobro recurrente de verdad: se cobra sola cada mes. Es lo
   *     unico que encaja con «mensual sin permanencia».
   *   · FACTURA. Para administraciones publicas, cuyo gasto pasa por
   *     intervencion y casi nunca puede ir con tarjeta. Sin esta via, el
   *     tramo que mas paga seria justo el unico que no podria pagar.
   */
  function formasDisponibles(planId) {
    var formas = [];
    if (((window.PFP_COBRO || {}).stripe || {})[planId]) {
      formas.push(['card', 'c.pg.tarjeta', 'c.pg.tarjetaSub']);
    }
    formas.push(['invoice', 'c.pg.factura', 'c.pg.facturaSub']);
    return formas;
  }

  function paginaPago() {
    if (!UI.exigirSesion()) return;

    var forma = null;
    var estado = null;

    UI.cargarEstado()
      .then(function (e) {
        estado = e;
        var org = e.organizacion;

        if (!org || !org.tramo) {
          UI.avisar('aviso', UI.T('c.pg.sinTarifa'));
          $('#paso-formas').innerHTML =
            '<a class="btn btn--primary" href="planes.html">' + UI.T('c.pg.verPlanes') + '</a>';
          return;
        }

        var planId = org.tipo + '_' + org.tramo;
        var precio = window.PFP_PRECIO(org.tipo, org.tramo);

        $('#resumen-plan').textContent = UI.T('c.pl.size_' + org.tramo);
        $('#resumen-precio').textContent = alMes(precio);

        var caja = $('#formas');
        caja.innerHTML = '';

        formasDisponibles(planId).forEach(function (f) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'opcion';
          b.setAttribute('aria-pressed', 'false');
          b.innerHTML =
            '<span class="opcion__texto"><strong>' + UI.T(f[1]) + '</strong>' +
            '<span>' + UI.T(f[2]) + '</span></span>';
          b.addEventListener('click', function () {
            forma = f[0];
            $$('#formas .opcion').forEach(function (o) {
              o.setAttribute('aria-pressed', String(o === b));
            });
            $('#btn-contratar').disabled = false;
          });
          caja.appendChild(b);
        });

        $('#btn-contratar').disabled = true;
      })
      .catch(function (err) {
        if (err.codigo === 'sin_sesion') return UI.ir('entrar.html');
        UI.avisar('aviso', UI.explicar(err));
      });

    $('#btn-contratar').addEventListener('click', function () {
      if (!forma || !estado || !estado.organizacion) return;
      UI.limpiarAvisos();

      var boton = $('#btn-contratar');
      UI.ocupado(boton, true, UI.T('c.pg.contratando'));

      PFP.db
        .rpc('start_subscription', { p_org: estado.organizacion.id, p_method: forma })
        .then(function (filas) {
          var r = filas && filas[0];
          if (!r) throw PFP.error('unknown');
          UI.ocupado(boton, false);
          pintarInstrucciones(estado.organizacion, forma, r);
        })
        .catch(function (err) {
          UI.ocupado(boton, false);
          // El servidor explica por que: falta confirmar el tamano, ya hay
          // plan activo, forma no disponible. Cada uno lleva a una accion
          // distinta, asi que se enseña su mensaje y no un generico.
          UI.avisar(
            'aviso',
            err.codigo === 'unknown' && err.message ? err.message : UI.explicar(err),
          );
        });
    });
  }

  /** Que toca hacer ahora, una vez contratado. */
  function pintarInstrucciones(org, forma, r) {
    var cobro = window.PFP_COBRO || {};
    var planId = org.tipo + '_' + org.tramo;
    var partes = [];

    if (forma === 'card') {
      var enlace = (cobro.stripe || {})[planId];

      partes.push(
        '<div class="aviso aviso--espera" data-visible="true">' +
          UI.T('c.pg.cardWaiting') + '</div>',
      );

      if (/\/test_/.test(enlace || '')) {
        partes.push(
          '<div class="aviso aviso--espera" data-visible="true">' +
            UI.T('c.pg.pruebas') + '</div>',
        );
      }

      if (enlace) {
        // Con la referencia pegada: sin ella el cobro llega al panel de
        // Stripe sin nada que lo ate a una entidad.
        var url = enlace + (enlace.indexOf('?') === -1 ? '?' : '&') +
          'client_reference_id=' + encodeURIComponent(r.reference);
        partes.push(
          '<a class="btn btn--primary" target="_blank" rel="noopener" href="' +
            escapar(url) + '">' + UI.T('c.pg.pasarela') + '</a>',
        );
      }
    } else {
      partes.push(
        '<div class="aviso aviso--espera" data-visible="true">' +
          UI.T('c.pg.facturaBody') + '</div>',
      );
      partes.push(dato(UI.T('c.mi.concepto'), r.reference, true));
      partes.push(
        '<a class="btn btn--ghost" href="mailto:' + escapar(cobro.correo) +
          '?subject=' + encodeURIComponent('Factura ' + r.plan_id + ' — ' + r.reference) +
          '">' + escapar(cobro.correo) + '</a>',
      );
    }

    partes.push('<a class="btn btn--ghost" href="index.html">' + UI.T('c.volver') + '</a>');

    $('#paso-formas').innerHTML = partes.join('');
    engancharCopiar();
  }

  function dato(clave, valor, copiable) {
    return (
      '<div class="dato' + (copiable ? ' dato--destacado' : '') + '"><span>' +
      '<span class="dato__clave">' + escapar(clave) + '</span>' +
      '<span class="dato__valor">' + escapar(valor) + '</span></span>' +
      (copiable
        ? '<button class="dato__copiar" type="button" data-copiar="' + escapar(valor) + '">' +
          UI.T('c.mi.copiar') + '</button>'
        : '') +
      '</div>'
    );
  }

  function engancharCopiar() {
    $$('[data-copiar]').forEach(function (b) {
      b.addEventListener('click', function () {
        navigator.clipboard.writeText(b.dataset.copiar).then(function () {
          b.textContent = UI.T('c.mi.copiado');
          setTimeout(function () {
            b.textContent = UI.T('c.mi.copiar');
          }, 1800);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var pagina = document.body.dataset.pagina;
    if (pagina === 'planes') paginaPlanes();
    if (pagina === 'pago') paginaPago();
  });
})();
