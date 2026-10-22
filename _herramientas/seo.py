"""
SEO de las paginas publicas: una tabla y un script.

Escribe en cada pagina de PAGINAS el <title>, la descripcion y, entre las
marcas `<!-- seo:inicio -->` y `<!-- seo:fin -->`, el canonical, Open Graph,
la tarjeta de Twitter y los datos estructurados (JSON-LD). Despues rehace
`sitemap.xml`. Lo que hay entre las marcas NO se edita a mano: se cambia
aqui y se vuelve a ejecutar.

    python _herramientas/seo.py           # escribe
    python _herramientas/seo.py --check   # solo dice si algo esta desfasado

Se puede ejecutar cuantas veces haga falta: deja el mismo resultado.

Por que asi y no a mano en cada HTML: el titulo, la descripcion, el og:title
y el JSON-LD de una pagina dicen lo mismo con cuatro formatos distintos, y a
mano acaban diciendo cosas distintas. Y los precios del JSON-LD salen de
`js/planes.js`, el mismo catalogo que pintan las paginas y que se genera
desde la app: si cambia un precio, aqui no hay que tocar nada, basta con
volver a ejecutar.

Para anadir una pagina publica: una entrada mas en PAGINAS y ejecutar. Las
de /cuenta/ no van: son pantallas de sesion, llevan `noindex` y no deben
salir ni en el sitemap ni en los buscadores.

Normas para los textos (lo que Google ensena, no lo que se escribe):
  · titulo: lo que se busca primero y la marca al final; con la marca, 60
    caracteres como mucho, o Google lo corta;
  · descripcion: entre 120 y 160 caracteres, y que diga algo que la pagina
    cumple. Nada de promesas que no esten en la pagina.
"""
import html
import json
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMINIO = 'https://peopleforpeople.es'
MARCA = 'PeopleForPeople'
IMAGEN = DOMINIO + '/imagenes/compartir.jpg'
IMAGEN_ALT = 'PeopleForPeople: Tu ayuda. Su esperanza. Nosotros unimos.'
LOGO = DOMINIO + '/imagenes/marca/isotipo.png'

# (archivo, ruta publica, titulo sin marca, descripcion, nombre en la miga, producto)
# `producto` es el tipo de entidad de `js/planes.js` cuya tarifa se describe
# como SoftwareApplication, o None.
PAGINAS = [
    ('index.html', '/',
     'Plataforma de voluntariado y coordinación',
     'Conecta a personas voluntarias con ONG, ayuntamientos y empresas: misiones cerca de ti, '
     'horas validadas y un panel para coordinar emergencias y ayuda diaria.',
     None, None),
    ('voluntarios/index.html', '/voluntarios/',
     'Hacer voluntariado cerca de ti',
     'Ayuda cuando puedas y cerca de donde estés: elige misiones de entidades verificadas, '
     'recibe avisos por cercanía y acredita tus horas. Registro gratuito.',
     'Personas voluntarias', None),
    ('ongs/index.html', '/ongs/',
     'Gestión de voluntariado para ONG',
     'Publica misiones, cubre plazas y valida horas desde un panel web para tu ONG. Prueba dos '
     'publicaciones gratis; después, desde 19 € al mes según tu tamaño.',
     'ONG y asociaciones', 'ngo'),
    ('comunidades/index.html', '/comunidades/',
     'Coordinar voluntariado en tu ayuntamiento',
     'Moviliza a la ciudadanía en emergencias y misiones municipales desde un panel web. Prueba '
     'dos publicaciones gratis; después, desde 49 € al mes por población.',
     'Ayuntamientos', 'municipality'),
    ('empresas/index.html', '/empresas/',
     'Voluntariado corporativo y RSC',
     'Organiza el voluntariado de tu plantilla con ONG y ayuntamientos verificados y mide horas '
     'y participación. Prueba dos publicaciones gratis; desde 19 € al mes.',
     'Empresas', 'company'),
    ('ayuda.html', '/ayuda.html',
     'Preguntas frecuentes sobre el voluntariado',
     'Cómo funciona PeopleForPeople: darse de alta, apuntarse a una misión, acreditar horas, '
     'pedir ayuda a tus vecinos y coordinar el voluntariado de una entidad.',
     'Preguntas frecuentes', None),
    ('documentos.html', '/documentos.html',
     'Guías y documentos de voluntariado',
     'Guías para participar como voluntario, ONG, ayuntamiento o empresa, y la documentación '
     'legal de PeopleForPeople: privacidad, condiciones y aviso legal.',
     'Recursos y documentos', None),
    ('acuerdo-voluntariado.html', '/acuerdo-voluntariado.html',
     'Acuerdo de voluntariado (Ley 45/2015)',
     'Acuerdo de incorporación al voluntariado de PeopleForPeople, conforme a la Ley 45/2015: '
     'derechos y deberes, seguro, protección de datos y duración.',
     'Acuerdo de voluntariado', None),
    ('privacidad.html', '/privacidad.html',
     'Política de privacidad',
     'Qué datos trata PeopleForPeople, con qué base legal y durante cuánto tiempo, qué cookies '
     'usa la web y cómo ejercer tus derechos de protección de datos.',
     'Política de privacidad', None),
    ('terminos.html', '/terminos.html',
     'Términos y condiciones',
     'Condiciones de uso de PeopleForPeople: qué es la plataforma, registro y cuenta, '
     'voluntariado, conducta, contenidos, modelo de uso y responsabilidad.',
     'Términos y condiciones', None),
    ('aviso-legal.html', '/aviso-legal.html',
     'Aviso legal · Impressum',
     'Aviso legal e Impressum de PeopleForPeople: quién es el titular de la web, cómo '
     'contactar, responsabilidad sobre contenidos y enlaces, y propiedad intelectual.',
     'Aviso legal', None),
]

# Como se nombra a quien cuenta en cada tipo de entidad, para los tramos.
UNIDAD = {
    'ngo': 'voluntarios activos',
    'municipality': 'habitantes',
    'company': 'personas empleadas',
}
NOMBRE_TRAMO = {'small': 'Pequeña', 'medium': 'Mediana', 'large': 'Grande'}

ORGANIZACION = {
    '@type': 'Organization',
    '@id': DOMINIO + '/#organizacion',
    'name': MARCA,
    'alternateName': 'People for People',
    'url': DOMINIO + '/',
    'logo': LOGO,
    'email': 'peopleforpeopleofficial@gmail.com',
    'address': {
        '@type': 'PostalAddress',
        'streetAddress': 'Av. Monasterio del Escorial 26',
        'postalCode': '28049',
        'addressLocality': 'Madrid',
        'addressCountry': 'ES',
    },
    'areaServed': 'ES',
    'knowsLanguage': ['es', 'de'],
    'description': 'Plataforma que conecta a personas voluntarias con ONG, ayuntamientos y '
                   'empresas para coordinar misiones sociales y respuestas a emergencias.',
}

INICIO = '<!-- seo:inicio · generado por _herramientas/seo.py, no editar a mano -->'
FIN = '<!-- seo:fin -->'


def leer(ruta):
    with open(os.path.join(RAIZ, ruta), encoding='utf-8', newline='') as f:
        return f.read()


def escribir(ruta, texto):
    with open(os.path.join(RAIZ, ruta), 'w', encoding='utf-8', newline='') as f:
        f.write(texto)


def tarifas():
    """Los tramos de `js/planes.js`, que se genera desde la app."""
    texto = leer('js/planes.js')
    inicio = texto.index('window.PFP_TAMANOS = ') + len('window.PFP_TAMANOS = ')
    fin = texto.index('};', inicio) + 1
    return json.loads(texto[inicio:fin])


def miles(n):
    return '{:,}'.format(n).replace(',', '.')


def ofertas(tipo, catalogo):
    bandas = catalogo[tipo]['bandas']
    unidad = UNIDAD[tipo]
    salida = []
    anterior = 0
    for b in bandas:
        if b['upTo'] is None:
            rango = 'Más de %s %s' % (miles(anterior), unidad)
        elif anterior == 0:
            rango = 'Hasta %s %s' % (miles(b['upTo']), unidad)
        else:
            rango = 'De %s a %s %s' % (miles(anterior + 1), miles(b['upTo']), unidad)
        euros = b['cents'] / 100
        salida.append({
            '@type': 'Offer',
            'name': NOMBRE_TRAMO[b['size']],
            'description': rango + '. Las dos primeras publicaciones, gratis.',
            'price': '%.2f' % euros,
            'priceCurrency': 'EUR',
            'priceSpecification': {
                '@type': 'UnitPriceSpecification',
                'price': '%.2f' % euros,
                'priceCurrency': 'EUR',
                'referenceQuantity': {'@type': 'QuantitativeValue', 'value': 1, 'unitCode': 'MON'},
            },
        })
        anterior = b['upTo'] or anterior
    return salida


def datos_estructurados(archivo, url, titulo, descripcion, miga, producto, catalogo):
    bloques = []
    if archivo == 'index.html':
        bloques.append(dict({'@context': 'https://schema.org'}, **ORGANIZACION))
        bloques.append({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': DOMINIO + '/#web',
            'url': DOMINIO + '/',
            'name': MARCA,
            'inLanguage': ['es', 'de'],
            'publisher': {'@id': DOMINIO + '/#organizacion'},
        })
    else:
        bloques.append({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': DOMINIO + '/'},
                {'@type': 'ListItem', 'position': 2, 'name': miga, 'item': url},
            ],
        })
    if producto:
        bloques.append({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            'name': MARCA,
            'url': url,
            'description': descripcion,
            'applicationCategory': 'BusinessApplication',
            # El panel de coordinacion es web. La app aun no esta en las
            # tiendas: no se dice que lo este.
            'operatingSystem': 'Web',
            'inLanguage': ['es', 'de'],
            'provider': {'@type': 'Organization', 'name': MARCA, 'url': DOMINIO + '/'},
            'offers': ofertas(producto, catalogo),
        })
    lineas = []
    for b in bloques:
        # `</` partiria el <script>; en JSON se puede escribir `<\/`.
        js = json.dumps(b, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        lineas.append('<script type="application/ld+json">%s</script>' % js)
    return lineas


def bloque(archivo, ruta, titulo_completo, descripcion, miga, producto, catalogo):
    url = DOMINIO + ruta
    a = lambda s: html.escape(s, quote=True)
    lineas = [
        INICIO,
        '<link rel="canonical" href="%s" />' % url,
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="%s" />' % MARCA,
        '<meta property="og:url" content="%s" />' % url,
        '<meta property="og:title" content="%s" />' % a(titulo_completo),
        '<meta property="og:description" content="%s" />' % a(descripcion),
        '<meta property="og:image" content="%s" />' % IMAGEN,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="%s" />' % a(IMAGEN_ALT),
        '<meta property="og:locale" content="es_ES" />',
        '<meta property="og:locale:alternate" content="de_DE" />',
        '<meta name="twitter:card" content="summary_large_image" />',
    ]
    lineas += datos_estructurados(archivo, url, titulo_completo, descripcion, miga, producto, catalogo)
    lineas.append(FIN)
    return lineas


# Lo que se quita antes de poner el bloque: uno anterior entre marcas, o
# etiquetas sueltas de antes de que existiera este script.
VIEJO_BLOQUE = re.compile(re.escape(INICIO.split(' ·')[0]) + r'.*?' + re.escape(FIN) + r'[ \t]*(?:\r?\n)?', re.S)
VIEJAS_SUELTAS = re.compile(
    r'[ \t]*<(?:link rel="canonical"|meta (?:property="og:|name="twitter:))[^>]*/?>[ \t]*(?:\r?\n)?')
VIEJOS_JSONLD = re.compile(r'[ \t]*<script type="application/ld\+json">.*?</script>[ \t]*(?:\r?\n)?', re.S)


def aplicar(archivo, ruta, titulo, descripcion, miga, producto, catalogo):
    texto = leer(archivo)
    salto = '\r\n' if '\r\n' in texto else '\n'
    titulo_completo = '%s | %s' % (titulo, MARCA)

    texto = re.sub(r'<title>[^<]*</title>', lambda m: '<title>%s</title>' % html.escape(titulo_completo, quote=False), texto, count=1)
    texto = re.sub(r'<meta name="description" content="[^"]*"\s*/?>',
                   lambda m: '<meta name="description" content="%s" />' % html.escape(descripcion, quote=True), texto, count=1)
    texto = VIEJO_BLOQUE.sub('', texto)
    texto = VIEJAS_SUELTAS.sub('', texto)
    texto = VIEJOS_JSONLD.sub('', texto)

    desc = re.search(r'<meta name="description" content="[^"]*" />', texto)
    nuevo = salto.join(bloque(archivo, ruta, titulo_completo, descripcion, miga, producto, catalogo))
    return texto[:desc.end()] + salto + nuevo + texto[desc.end():]


def sitemap():
    lineas = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- Generado por _herramientas/seo.py: las paginas publicas, con la misma',
        '     URL que su canonical. Las de /cuenta/ no van: llevan noindex. -->',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for archivo, ruta, *_ in PAGINAS:
        # La fecha del ultimo commit que toco la pagina: es lo que Google
        # mira de `lastmod`. `changefreq` y `priority` los ignora y no van.
        fecha = subprocess.run(['git', '-C', RAIZ, 'log', '-1', '--format=%cs', '--', archivo],
                               capture_output=True, text=True).stdout.strip()
        lineas.append('  <url><loc>%s%s</loc>%s</url>' % (
            DOMINIO, ruta, '<lastmod>%s</lastmod>' % fecha if fecha else ''))
    # Los casos de impacto los escribe `casos.py`; aquí solo se listan.
    carpeta = os.path.join(RAIZ, 'casos')
    nombres = sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []
    for nombre in sorted(nombres, key=lambda n: n != 'index.html'):
        if not nombre.endswith('.html'):
            continue
        archivo = 'casos/' + nombre
        publica = '/casos/' if nombre == 'index.html' else '/' + archivo
        fecha = subprocess.run(['git', '-C', RAIZ, 'log', '-1', '--format=%cs', '--', archivo],
                               capture_output=True, text=True).stdout.strip()
        lineas.append('  <url><loc>%s%s</loc>%s</url>' % (
            DOMINIO, publica, '<lastmod>%s</lastmod>' % fecha if fecha else ''))
    lineas.append('</urlset>')
    return '\n'.join(lineas) + '\n'


def comprobar_textos():
    avisos = []
    for archivo, _, titulo, descripcion, *_ in PAGINAS:
        largo = len('%s | %s' % (titulo, MARCA))
        if largo > 60:
            avisos.append('%s: el titulo tiene %d caracteres (maximo 60)' % (archivo, largo))
        if not 120 <= len(descripcion) <= 160:
            avisos.append('%s: la descripcion tiene %d caracteres (120-160)' % (archivo, len(descripcion)))
    return avisos


def main():
    solo_comprobar = '--check' in sys.argv
    avisos = comprobar_textos()
    catalogo = tarifas()
    desfasadas = []
    for archivo, ruta, titulo, descripcion, miga, producto in PAGINAS:
        nuevo = aplicar(archivo, ruta, titulo, descripcion, miga, producto, catalogo)
        if nuevo != leer(archivo):
            desfasadas.append(archivo)
            if not solo_comprobar:
                escribir(archivo, nuevo)
    mapa = sitemap()
    if mapa != leer('sitemap.xml'):
        desfasadas.append('sitemap.xml')
        if not solo_comprobar:
            escribir('sitemap.xml', mapa)

    for a in avisos:
        print('AVISO', a)
    if solo_comprobar:
        print('Desfasadas:', ', '.join(desfasadas) if desfasadas else 'ninguna')
        sys.exit(1 if desfasadas or avisos else 0)
    print('Escritas:', ', '.join(desfasadas) if desfasadas else 'nada que cambiar')


if __name__ == '__main__':
    main()
