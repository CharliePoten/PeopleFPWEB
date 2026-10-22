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

  /* ---------------------------------------------------------------------
     El gráfico de la cabecera
     ---------------------------------------------------------------------
     Horas al año según qué parte de la plantilla participe: el 5, 10, 20 y
     30 %, y el caso de quien lo mira, resaltado. Responde a la pregunta que
     hace cualquiera que rellena esto: «¿y si participara más gente?».
     Una sola serie, así que sin leyenda: el título la nombra. Los colores
     están en detail.css (validados sobre el azul de la cabecera). */

  var NS = 'http://www.w3.org/2000/svg';
  var svg = $('calc-svg');
  var globo = $('calc-globo');

  function el(nombre, attrs, texto) {
    var n = document.createElementNS(NS, nombre);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (texto != null) n.textContent = texto;
    return n;
  }

  /** Un tope «redondo» para el eje: 1, 2 o 5 por una potencia de 10. */
  function topeRedondo(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var pasos = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < pasos.length; i++) if (pasos[i] * p >= v) return pasos[i] * p;
    return 10 * p;
  }

  /** Barra con las esquinas de arriba redondeadas (4 px) y la base recta. */
  function barra(x, y, w, h) {
    var r = Math.min(4, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }

  function dibujar(plantilla, participacion, horas, valorHora) {
    if (!svg) return;
    var tuPct = Math.round(participacion * 10) / 10;
    var pcts = [5, 10, 20, 30];
    if (pcts.indexOf(tuPct) === -1) pcts.push(tuPct);
    pcts.sort(function (a, b) { return a - b; });

    var datos = pcts.map(function (pct) {
      var h = Math.round(plantilla * pct / 100) * horas;
      return { pct: pct, horas: h, valor: h * valorHora, tu: pct === tuPct };
    });

    var W = 460, H = 270, izq = 50, der = 8, arr = 30, aba = 30;
    var ancho = W - izq - der, alto = H - arr - aba;
    var tope = topeRedondo(Math.max.apply(null, datos.map(function (d) { return d.horas; })));
    var y = function (v) { return arr + alto - (v / tope) * alto; };

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Rejilla y eje: tres líneas, discretas.
    [0, tope / 2, tope].forEach(function (v) {
      svg.appendChild(el('line', { x1: izq, x2: W - der, y1: y(v), y2: y(v), class: 'grafico__rejilla' }));
      svg.appendChild(el('text', { x: izq - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'grafico__eje' }, numero(v)));
    });

    var hueco = ancho / datos.length;
    var bw = Math.min(54, hueco * 0.56);
    datos.forEach(function (d) {
      var cx = izq + hueco * (datos.indexOf(d) + 0.5);
      var top = y(d.horas);
      var b = el('path', { d: barra(cx - bw / 2, top, bw, Math.max(0, arr + alto - top)), class: 'grafico__barra' + (d.tu ? ' grafico__barra--tu' : '') });
      svg.appendChild(b);
      svg.appendChild(el('text', { x: cx, y: H - aba + 18, 'text-anchor': 'middle', class: 'grafico__eje' }, numero(d.pct, 1) + ' %'));
      if (d.tu) {
        // Solo la barra propia lleva su cifra y su nombre: el resto, al pasar por encima.
        svg.appendChild(el('text', { x: cx, y: top - 8, 'text-anchor': 'middle', class: 'grafico__valor' }, numero(d.horas) + ' h'));
        svg.appendChild(el('text', { x: cx, y: top - 24, 'text-anchor': 'middle', class: 'grafico__tu' }, texto('pl.k.gTu')));
      }
      // Zona para el ratón, más grande que la barra.
      var zona = el('rect', { x: cx - hueco / 2, y: arr, width: hueco, height: alto, class: 'grafico__zona' });
      zona.addEventListener('mouseenter', function () {
        b.classList.add('is-encima');
        globo.textContent = (texto('pl.k.gTip') || '{pct} % · {horas} h · {valor}')
          .replace('{pct}', numero(d.pct, 1)).replace('{horas}', numero(d.horas)).replace('{valor}', euros(d.valor));
        var caja = svg.getBoundingClientRect(), escala = caja.width / W;
        globo.style.left = (cx * escala) + 'px';
        globo.style.top = ((top - 10) * escala) + 'px';
        globo.hidden = false;
      });
      zona.addEventListener('mouseleave', function () { b.classList.remove('is-encima'); globo.hidden = true; });
      svg.appendChild(zona);
    });

    var sub = $('calc-grafico-sub');
    if (sub) sub.textContent = (texto('pl.k.gS') || '').replace('{p}', numero(plantilla)).replace('{h}', numero(horas, 1));

    // La misma información, en tabla, para quien no ve el gráfico.
    var tabla = $('calc-tabla');
    if (tabla) {
      tabla.innerHTML = '';
      var cab = tabla.insertRow();
      [texto('pl.k.gColP'), texto('pl.k.gColH')].forEach(function (t) { var th = document.createElement('th'); th.textContent = t; cab.appendChild(th); });
      datos.forEach(function (d) {
        var fila = tabla.insertRow();
        fila.insertCell().textContent = numero(d.pct, 1) + ' %' + (d.tu ? ' (' + texto('pl.k.gTu') + ')' : '');
        fila.insertCell().textContent = numero(d.horas);
      });
    }
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

    dibujar(plantilla, participacion, horas, valorHora);
  }

  form.addEventListener('input', calcular);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  // Al cambiar de idioma, los números se vuelven a escribir con su formato.
  document.querySelectorAll('.lang [data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { window.setTimeout(calcular, 0); });
  });
  calcular();
})();
