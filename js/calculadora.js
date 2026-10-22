/* ==========================================================================
   Calculadora de impacto
   --------------------------------------------------------------------------
   Tres multiplicaciones, a la vista en la propia página («Cómo se calcula»):

     personas = plantilla × participación
     horas    = personas × horas por persona
     valor    = horas × coste de una hora de trabajo

   El coste por defecto es el coste laboral por hora efectiva del INE (4.º
   trimestre de 2025). La participación y las horas son supuestos, y la
   página lo dice: se cambian en el formulario.

   El plan sale de `js/planes.js` (generado desde la app), el mismo catálogo
   que pintan las páginas de precios: si cambia una tarifa, aquí no hay que
   tocar nada.
   ========================================================================== */

(function () {
  'use strict';

  var form = document.getElementById('calc');
  if (!form) return;

  function $(id) { return document.getElementById(id); }

  function lang() { return document.documentElement.lang === 'de' ? 'de-DE' : 'es-ES'; }

  function numero(n, decimales) {
    return Number(n).toLocaleString(lang(), { maximumFractionDigits: decimales || 0 });
  }

  function euros(n) {
    return Number(n).toLocaleString(lang(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function leer(id, minimo, maximo) {
    var v = parseFloat(String($(id).value).replace(',', '.'));
    if (isNaN(v)) return 0;
    return Math.min(maximo, Math.max(minimo, v));
  }

  /** La tarifa mensual de una empresa con `plantilla` personas, en euros. */
  function plan(plantilla) {
    var bandas = (window.PFP_TAMANOS && window.PFP_TAMANOS.company && window.PFP_TAMANOS.company.bandas) || [];
    for (var i = 0; i < bandas.length; i++) {
      if (bandas[i].upTo === null || plantilla <= bandas[i].upTo) return bandas[i].cents / 100;
    }
    return null;
  }

  function texto(clave) {
    var d = (window.I18N && window.I18N[document.documentElement.lang]) || {};
    return d[clave] || '';
  }

  function calcular() {
    var plantilla = Math.round(leer('calc-plantilla', 0, 1000000));
    var participacion = leer('calc-participacion', 0, 100);
    var horas = leer('calc-horas', 0, 2000);
    var valorHora = leer('calc-valor', 0, 1000);

    var personas = Math.round(plantilla * participacion / 100);
    var horasAno = personas * horas;

    $('calc-r-personas').textContent = numero(personas);
    $('calc-r-horas').textContent = numero(horasAno);
    $('calc-r-valor').textContent = euros(horasAno * valorHora);

    var mensual = plantilla > 0 ? plan(plantilla) : null;
    $('calc-r-plan').textContent = mensual === null ? '—'
      : (texto('pl.k.mes') || '{n} €').replace('{n}', numero(mensual));
  }

  form.addEventListener('input', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  // Al cambiar de idioma, los números se vuelven a escribir con su formato.
  document.querySelectorAll('.lang [data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { window.setTimeout(calcular, 0); });
  });
  calcular();
})();
