/* ==========================================================================
   Planes y pago
   --------------------------------------------------------------------------
   Contratar pasa por `start_subscription()`, la misma funcion que usa la
   app. Es importante que sea asi y no un INSERT desde aqui: esa funcion es
   la que pone el precio a partir del identificador del plan, la que
   comprueba que quien contrata es responsable de la entidad, la que impide
   contratar un plan que no corresponde a su tipo, y la que evita duplicar
   una suscripcion que ya existe. Nada de eso puede vivir en el navegador.
   ========================================================================== */

(function () {
  'use strict';

  var PFP = window.PFP;
  var UI = window.PFP_UI;
  if (!PFP || !UI) return;

  var $ = UI.$;
  var $$ = UI.$$;

  var CLAVE_PLAN = 'pfp.planElegido';

  /** Los catalogos traen `es` y `de` dentro; se elige aqui. */
  function idioma() {
    return document.documentElement.lang === 'de' ? 'de' : 'es';
  }

  /** 29900 -> «299 €». Sin decimales cuando son cero, que es siempre aqui. */
  function euros(centimos) {
    return new Intl.NumberFormat('es-ES', {
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

  function planPorId(id) {
    var todos = window.PFP_PLANES || [];
    for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
    return null;
  }

  /* =====================================================================
     ELEGIR PLAN
     ===================================================================== */

  function paginaPlanes() {
    if (!UI.exigirSesion()) return;

    var elegido = null;
    var caja = $('#lista-planes');
    var boton = $('#btn-continuar');

    UI.cargarEstado()
      .then(function (e) {
        if (!e.organizacion) {
          caja.innerHTML =
            '<p class="field__hint">' + UI.T('c.pl.primero') + '</p>' +
            '<a class="btn btn--primary" href="organizacion.html">' + UI.T('c.pl.darla') + '</a>';
          boton.style.display = 'none';
          return;
        }

        /* Ya hay plan en vigor: no se contrata otro encima. El servidor lo
           rechaza igualmente —`start_subscription` da error si hay uno
           activo—, pero ofrecerlo y luego negarlo es hacer perder el
           tiempo. */
        if (e.plan && e.plan.status === 'active') {
          caja.innerHTML =
            '<p class="field__hint">' + UI.T('c.pl.yaHay') + ' ' +
            escapar((window.PFP_COBRO || {}).correo || '') +
            '.</p>';
          boton.style.display = 'none';
          return;
        }

        // El catalogo se filtra por el tipo de entidad: a un ayuntamiento no
        // se le enseña el plan gratuito de ONG ni al reves. El servidor lo
        // vuelve a comprobar, que es donde cuenta.
        var suyos = (window.PFP_PLANES || []).filter(function (p) {
          return p.tipos.indexOf(e.organizacion.tipo) !== -1;
        });

        if (!suyos.length) {
          caja.innerHTML =
            '<p class="field__hint">' + UI.T('c.pl.ninguno') + '</p>';
          boton.style.display = 'none';
          return;
        }

        caja.innerHTML = '';
        suyos.forEach(function (p) {
          var precio = p.aMedida
            ? UI.T('c.pl.aConvenir')
            : p.precio === 0
              ? UI.T('c.pl.gratis')
              : euros(p.precio) + ' ' + UI.T('c.pl.alAno');

          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'plan';
          b.setAttribute('aria-pressed', 'false');
          b.innerHTML =
            '<span class="plan__cabeza"><span class="plan__nombre">' +
            escapar(p.nombre[idioma()]) +
            '</span><span class="plan__precio">' +
            escapar(precio) +
            '</span></span><p class="plan__detalle">' +
            escapar(p.detalle[idioma()]) +
            '</p>';
          b.addEventListener('click', function () {
            elegido = p.id;
            $$('#lista-planes .plan').forEach(function (o) {
              o.setAttribute('aria-pressed', String(o === b));
            });
            boton.disabled = false;
          });
          caja.appendChild(b);
        });

        boton.disabled = true;
        boton.addEventListener('click', function () {
          if (!elegido) return;
          try {
            sessionStorage.setItem(CLAVE_PLAN, elegido);
          } catch (err) {}
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

  /** Formas de pago por plan. Un importe a convenir no se paga aqui. */
  function formasPara(plan) {
    var cobro = window.PFP_COBRO || {};
    if (plan.aMedida) {
      return [['invoice', UI.T('c.pg.presupuesto'), UI.T('c.pg.presupuestoSub')]];
    }
    if (plan.precio === 0) {
      return [['free', UI.T('c.pg.gratis'), UI.T('c.pg.gratisSub')]];
    }

    var formas = [['transfer', UI.T('c.pg.transfer'), UI.T('c.pg.transferSub')]];
    // Bizum solo si hay un numero al que cobrar: ensenar la opcion sin el
    // seria mandar el dinero a ningun sitio.
    if (cobro.bizum) formas.push(['bizum', UI.T('c.pg.bizum'), UI.T('c.pg.bizumSub')]);

    var enlace = (cobro.stripe || {})[plan.id];
    if (enlace) {
      formas.push([
        'apple_pay',
        UI.T('c.pg.tarjeta'),
        UI.T('c.pg.tarjetaSub'),
      ]);
    }
    return formas;
  }

  function paginaPago() {
    if (!UI.exigirSesion()) return;

    var idPlan = '';
    try {
      idPlan = sessionStorage.getItem(CLAVE_PLAN) || '';
    } catch (e) {}

    var plan = planPorId(idPlan);
    if (!plan) {
      UI.avisar('aviso', UI.T('c.pg.sinPlan'));
      $('#paso-formas').innerHTML = '<a class="btn btn--primary" href="planes.html">' + UI.T('c.pg.verPlanes') + '</a>';
      return;
    }

    $('#resumen-plan').textContent = plan.nombre[idioma()];
    $('#resumen-precio').textContent = plan.aMedida
      ? UI.T('c.pl.aConvenir')
      : plan.precio === 0
        ? UI.T('c.pl.gratis')
        : euros(plan.precio) + ' ' + UI.T('c.pl.alAno');

    var forma = null;
    var caja = $('#formas');

    formasPara(plan).forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcion';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML =
        '<span class="opcion__texto"><strong>' + f[1] + '</strong><span>' + f[2] + '</span></span>';
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
    $('#btn-contratar').addEventListener('click', function () {
      if (!forma) return;
      UI.limpiarAvisos();

      var boton = $('#btn-contratar');
      UI.ocupado(boton, true, UI.T('c.pg.contratando'));

      UI.cargarEstado()
        .then(function (e) {
          if (!e.organizacion) throw PFP.error('unknown', UI.T('c.pg.sinEntidad'));
          return PFP.db.rpc('start_subscription', {
            p_org: e.organizacion.id,
            p_plan: plan.id,
            p_method: forma,
          });
        })
        .then(function (filas) {
          var r = filas && filas[0];
          if (!r) throw PFP.error('unknown');
          UI.ocupado(boton, false);

          // El plan gratuito se activa solo: no hay nada que ingresar.
          if (r.status === 'active') {
            UI.ir('index.html');
            return;
          }
          pintarInstrucciones(plan, forma, r);
        })
        .catch(function (err) {
          UI.ocupado(boton, false);
          // El servidor explica por que —plan que no toca, plan ya activo,
          // no eres responsable—, asi que se ensena eso y no una suposicion.
          UI.avisar('aviso', err.message && err.codigo === 'unknown' ? err.message : UI.explicar(err));
        });
    });
  }

  /** Datos del ingreso, una vez contratado. */
  function pintarInstrucciones(plan, forma, r) {
    var cobro = window.PFP_COBRO || {};
    var partes = [];

    partes.push(
      '<div class="aviso aviso--espera" data-visible="true">' + UI.T('c.pg.reservado') + '</div>',
    );

    /* El concepto va primero y se puede copiar de un toque: es lo unico que
       permite casar un ingreso con quien lo hizo cuando el pago llega por
       fuera de la plataforma. */
    partes.push(dato(UI.T('c.mi.concepto'), r.reference, true));

    if (r.amount_cents > 0) partes.push(dato(UI.T('c.pg.importe'), euros(r.amount_cents), false));

    if (forma === 'transfer') {
      partes.push(dato(UI.T('c.pg.iban'), cobro.iban, true));
      partes.push(dato(UI.T('c.pg.titular'), cobro.titular, false));
    }
    if (forma === 'bizum') partes.push(dato(UI.T('c.pg.telBizum'), cobro.bizum, true));

    if (forma === 'apple_pay') {
      var enlace = (cobro.stripe || {})[plan.id];
      if (enlace) {
        // Con la referencia pegada: sin ella el cobro llega al panel de
        // Stripe sin nada que lo ate a una entidad.
        var url = enlace + (enlace.indexOf('?') === -1 ? '?' : '&') +
          'client_reference_id=' + encodeURIComponent(r.reference);
        if (/\/test_/.test(enlace)) {
          partes.push(
            '<div class="aviso aviso--espera" data-visible="true">' + UI.T('c.pg.pruebas') +
              '</div>',
          );
        }
        partes.push(
          '<a class="btn btn--primary" target="_blank" rel="noopener" href="' +
            escapar(url) + '">' + UI.T('c.pg.pasarela') + '</a>',
        );
      }
    }

    if (forma === 'invoice') {
      partes.push(
        '<p class="field__hint">' + UI.T('c.pg.escribid') + '</p>' +
          '<a class="btn btn--ghost" href="mailto:' + escapar(cobro.correo) +
          '?subject=' + encodeURIComponent('Plan ' + plan.id + ' — ' + r.reference) +
          '">' + escapar(cobro.correo) + '</a>',
      );
    }

    partes.push(
      '<p class="field__hint">' + UI.T('c.pg.copiad') + '</p>',
    );
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
        ? '<button class="dato__copiar" type="button" data-copiar="' + escapar(valor) + '">' + UI.T('c.mi.copiar') + '</button>'
        : '') +
      '</div>'
    );
  }

  function engancharCopiar() {
    $$('[data-copiar]').forEach(function (b) {
      b.addEventListener('click', function () {
        // El IBAN se copia sin espacios: es lo que espera el formulario del
        // banco, y pegarlo con ellos da error en la mitad de las webs.
        var v = b.dataset.copiar.replace(/\s/g, '');
        navigator.clipboard.writeText(v).then(function () {
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
