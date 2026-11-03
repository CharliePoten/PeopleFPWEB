"""
El dossier para ayuntamientos: una página A4 en PDF, para reenviarla dentro
del ayuntamiento. Sale de `_herramientas/dossier/ayuntamientos.html` con los
precios de `js/planes.js`, los mismos que pintan las páginas y el JSON-LD.

    python _herramientas/dossier.py                # escribe el PDF
    python _herramientas/dossier.py --png x.png    # y una vista previa

Escribe `descargas/peopleforpeople-ayuntamientos.pdf`, que enlaza
`comunidades/`. Hay que volver a ejecutarlo si cambian los precios o los
textos de la plantilla. Necesita Playwright con Chromium
(`pip install playwright` y `playwright install chromium`).
"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seo  # noqa: E402

PLANTILLA = os.path.join(seo.RAIZ, '_herramientas', 'dossier', 'ayuntamientos.html')
SALIDA = os.path.join(seo.RAIZ, 'descargas', 'peopleforpeople-ayuntamientos.pdf')
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
         'octubre', 'noviembre', 'diciembre']


def euros(centimos):
    e = centimos / 100
    return ('%s €' % seo.miles(int(e))) if e == int(e) else ('%.2f €' % e).replace('.', ',')


def tarifas(bandas):
    """Las tres tarjetas de precio, con los tramos escritos como en `seo.py`."""
    tarjetas = []
    anterior = 0
    for b in bandas:
        if b['upTo'] is None:
            tramo = 'Más de %s habitantes' % seo.miles(anterior)
        elif anterior == 0:
            tramo = 'Hasta %s habitantes' % seo.miles(b['upTo'])
        else:
            tramo = 'De %s a %s habitantes' % (seo.miles(anterior + 1), seo.miles(b['upTo']))
        tarjetas.append('<div class="tarifa"><p class="tarifa__nombre">%s</p><p class="tarifa__tramo">%s</p>'
                        '<p class="tarifa__precio">%s <small>al mes</small></p></div>'
                        % (seo.NOMBRE_TRAMO[b['size']], tramo, euros(b['cents'])))
        anterior = b['upTo'] or anterior
    return ''.join(tarjetas)


def html_relleno():
    bandas = seo.tarifas()['municipality']['bandas']
    hoy = datetime.date.today()
    texto = seo.leer(os.path.relpath(PLANTILLA, seo.RAIZ))
    for marca, valor in (('{{tarifas}}', tarifas(bandas)),
                         ('{{anual}}', euros(max(b['cents'] for b in bandas) * 12)),
                         ('{{fecha}}', '%s de %d' % (MESES[hoy.month - 1], hoy.year))):
        assert marca in texto, marca
        texto = texto.replace(marca, valor)
    return texto


def main():
    from playwright.sync_api import sync_playwright

    png = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None
    # Junto a la plantilla, para que valgan sus rutas relativas (fuentes, logo).
    temporal = os.path.join(os.path.dirname(PLANTILLA), '.relleno.html')
    with open(temporal, 'w', encoding='utf-8') as f:
        f.write(html_relleno())
    try:
        os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
        with sync_playwright() as p:
            navegador = p.chromium.launch()
            pagina = navegador.new_page(viewport={'width': 794, 'height': 1123})
            pagina.goto('file:///' + temporal.replace('\\', '/'))
            pagina.evaluate('document.fonts.ready')
            # Si algo no cabe, que se note aquí y no en el PDF.
            desborde = pagina.evaluate('document.body.scrollHeight - document.body.clientHeight')
            if desborde > 0:
                sys.exit('El contenido no cabe en una página: sobran %d px.' % desborde)
            pagina.pdf(path=SALIDA, format='A4', print_background=True, prefer_css_page_size=True,
                       margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
            if png:
                pagina.screenshot(path=png, full_page=True)
            navegador.close()
    finally:
        os.remove(temporal)
    print('Escrito', os.path.relpath(SALIDA, seo.RAIZ))


if __name__ == '__main__':
    main()
