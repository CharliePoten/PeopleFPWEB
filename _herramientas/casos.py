"""
Casos de impacto y Actualidad: un archivo de texto por artículo y un script.

Son dos colecciones (COLECCIONES, abajo) con el mismo formato. Cada artículo
es un `_casos/<slug>.md` o un `_actualidad/<slug>.md`: unas líneas
`clave: valor` arriba, una línea `---` y el texto en Markdown. El script
escribe, para cada colección,

    casos/<slug>.html    el artículo          (o actualidad/<slug>.html)
    casos/index.html     la lista, del más nuevo al más viejo

con la cabecera y el pie de `documentos.html`, el SEO de cada página
(canonical, Open Graph y datos estructurados de artículo) y los enlaces
entre casos. El mapa del sitio lo rehace `seo.py`, que ya incluye
lo que haya en /casos/.

    python _herramientas/casos.py           # escribe
    python _herramientas/casos.py --check   # solo dice si algo está desfasado

Para publicar un caso nuevo: copiar uno de los .md, cambiarlo, ejecutar
este script y después `seo.py` (por el sitemap).

Normas para los textos, además de las de `seo.py`:
  · cada dato con su fuente en la lista de «Fuentes», con medio y fecha;
  · nunca decir que PeopleForPeople estuvo allí: se cuenta cómo se PODRÍA
    organizar con lo que la plataforma hace hoy;
  · las citas, tal cual se publicaron;
  · la foto, con su autor en `credito`. Mientras no haya permiso, se deja
    «[crédito pendiente]» para que se vea y no se publique así.
"""
import datetime
import html
import json
import math
import os
import re
import sys

import markdown

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMINIO = 'https://peopleforpeople.es'
MARCA = 'PeopleForPeople'
LOGO = DOMINIO + '/imagenes/marca/isotipo.png'
PLANTILLA = 'documentos.html'

# Las dos colecciones. `imagenes` es la carpeta de sus fotos dentro de
# imagenes/; las claves `*_clave` son las del diccionario (home-i18n.js).
COLECCIONES = [
    {
        'md': '_casos', 'carpeta': 'casos', 'imagenes': 'casos', 'nombre': 'Casos de impacto',
        'indice_titulo': 'Casos de impacto en emergencias reales',
        'indice_descripcion': ('Emergencias reales en España contadas con sus fuentes: qué pasó, qué faltó para '
                               'coordinar a los voluntarios y cómo se podría organizar hoy la ayuda.'),
        'titulo_clave': 'cases.title',
        'entrada_clave': 'cases.lead',
        'entrada': 'Emergencias reales, contadas con sus fuentes: qué pasó, qué faltó para coordinar la ayuda y cómo se podría organizar hoy.',
        'volver_clave': 'cases.back', 'volver': '← Casos de impacto',
        'leer_clave': 'cases.read', 'leer': 'Leer el caso →',
        'mas_clave': 'cases.more', 'mas': 'Otros casos',
    },
    {
        'md': '_actualidad', 'carpeta': 'actualidad', 'imagenes': 'actualidad', 'nombre': 'Actualidad',
        'indice_titulo': 'Actualidad del voluntariado y de la app',
        'indice_descripcion': ('Novedades de PeopleForPeople y análisis sobre voluntariado: leyes, emergencias '
                               'y cómo se coordina la ayuda. Con fuentes y fecha en cada artículo.'),
        'titulo_clave': 'news.title',
        'entrada_clave': 'news.lead',
        'entrada': 'Novedades de la plataforma y análisis sobre voluntariado, con fuentes y fecha.',
        'volver_clave': 'news.back', 'volver': '← Actualidad',
        'leer_clave': 'news.read', 'leer': 'Leer el artículo →',
        'mas_clave': 'news.more', 'mas': 'Más artículos',
    },
]
C = COLECCIONES[0]

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']

e = lambda s: html.escape(s, quote=True)


def ruta(*p):
    return os.path.join(RAIZ, *p)


def leer(r):
    with open(ruta(r), encoding='utf-8') as f:
        return f.read()


def escribir(r, texto):
    os.makedirs(os.path.dirname(ruta(r)), exist_ok=True)
    with open(ruta(r), 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)


def fecha_larga(iso):
    d = datetime.date.fromisoformat(iso)
    return '%d de %s de %d' % (d.day, MESES[d.month - 1], d.year)


# ---------------------------------------------------------------- casos

def leer_caso(nombre):
    texto = leer(os.path.join(C['md'], nombre))
    cabeza, cuerpo = texto.split('\n---\n', 1)
    datos = {}
    for linea in cabeza.strip().splitlines():
        clave, valor = linea.split(':', 1)
        datos[clave.strip()] = valor.strip()
    datos['cuerpo_md'] = cuerpo
    datos['palabras'] = len(re.findall(r'\w+', cuerpo))
    return datos


def casos():
    if not os.path.isdir(ruta(C['md'])):
        return []
    lista = [leer_caso(n) for n in sorted(os.listdir(ruta(C['md']))) if n.endswith('.md')]
    # Del más nuevo al más viejo; a igual fecha, por el orden de `orden`.
    return sorted(lista, key=lambda c: (c['publicado'], -int(c.get('orden', 0))), reverse=True)


def cuerpo_html(md):
    h = markdown.markdown(md, extensions=['sane_lists', 'tables'])
    # Markdown junta en un solo bloque dos citas seguidas: se separan, una
    # por párrafo, y la línea «— Quién, dónde» de cada una va como su pie.
    def citas(m):
        salida = []
        for p in re.findall(r'<p>(.*?)</p>', m.group(1), re.S):
            texto, _, fuente = p.partition('\n— ')
            salida.append('<blockquote><p>%s</p>%s</blockquote>'
                          % (texto.strip(), '<footer>— %s</footer>' % fuente.strip() if fuente else ''))
        return '\n'.join(salida)
    h = re.sub(r'<blockquote>(.*?)</blockquote>', citas, h, flags=re.S)
    # Los enlaces de fuera se abren aparte.
    h = re.sub(r'<a href="(https?://[^"]+)">', r'<a href="\1" target="_blank" rel="noopener noreferrer">', h)
    return h


# ---------------------------------------------------------------- plantilla

ATRIBUTO_RELATIVO = re.compile(r'((?:href|src)=")(?!https?:|mailto:|#|/|\.\./|data:)([^"]*")')


def a_subcarpeta(fragmento):
    """Las rutas relativas de la raíz, vistas desde /casos/."""
    return ATRIBUTO_RELATIVO.sub(r'\1../\2', fragmento)


def piezas_de_plantilla():
    t = leer(PLANTILLA)
    estilos = re.search(r'<meta name="theme-color".*?(?=</head>)', t, re.S).group(0)
    cabecera = re.search(r'<body[^>]*>(.*?)<main id="main">', t, re.S).group(1)
    pie = re.search(r'</main>(.*?)</body>', t, re.S).group(1)
    estilos = a_subcarpeta(estilos).rstrip() + '<link rel="stylesheet" href="../css/casos.css" />'
    return estilos, a_subcarpeta(cabecera), a_subcarpeta(pie)


def jsonld(*bloques):
    return '\n'.join('<script type="application/ld+json">%s</script>'
                     % json.dumps(b, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
                     for b in bloques)


def migas(*pasos):
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u}
                            for i, (n, u) in enumerate(pasos)],
    }


def cabeza_html(titulo, descripcion, url, tipo, imagen, imagen_alt, extra_meta, datos):
    completo = '%s | %s' % (titulo, MARCA)
    return '\n'.join([
        '<!DOCTYPE html>',
        '<html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />'
        '<title>%s</title><meta name="description" content="%s" />' % (html.escape(completo, quote=False), e(descripcion)),
        '<!-- casos:inicio · generado por _herramientas/casos.py, no editar a mano -->',
        '<link rel="canonical" href="%s" />' % url,
        '<meta property="og:type" content="%s" />' % tipo,
        '<meta property="og:site_name" content="%s" />' % MARCA,
        '<meta property="og:url" content="%s" />' % url,
        '<meta property="og:title" content="%s" />' % e(completo),
        '<meta property="og:description" content="%s" />' % e(descripcion),
        '<meta property="og:image" content="%s" />' % imagen,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="%s" />' % e(imagen_alt),
        '<meta property="og:locale" content="es_ES" />',
    ] + extra_meta + [
        '<meta name="twitter:card" content="summary_large_image" />',
        datos,
        '<!-- casos:fin -->',
    ])


def tarjeta(c, prefijo=''):
    return (
        '<article class="caso-tarjeta reveal">'
        '<a class="caso-tarjeta__foto" href="%s%s.html" tabindex="-1" aria-hidden="true">'
        '<img src="../imagenes/%s/%s.webp" width="%s" height="%s" loading="lazy" alt="" /></a>'
        '<div class="caso-tarjeta__cuerpo"><p class="caso-tarjeta__meta"><span>%s</span> · <time datetime="%s">%s</time></p>'
        '<h3><a href="%s%s.html">%s</a></h3><p>%s</p>'
        '<a class="text-link" href="%s%s.html" data-i18n="%s">%s</a></div></article>'
    ) % (prefijo, c['slug'], C['imagenes'], c['imagen'], c['imagen_ancho'], c['imagen_alto'],
         e(c['etiqueta']), c['publicado'], fecha_larga(c['publicado']),
         prefijo, c['slug'], e(c['titulo']), e(c['resumen']), prefijo, c['slug'], C['leer_clave'], C['leer'])


CTA = (
    '<aside class="caso-cta reveal"><div><h2 data-i18n="cases.ctaTitle">La próxima emergencia, mejor coordinada.</h2>'
    '<p data-i18n="cases.ctaLead">Si quieres ayudar, crea tu cuenta y di qué sabes hacer. Si coordinas una entidad, '
    'te enseñamos cómo preparar la respuesta antes de que haga falta.</p></div>'
    '<div class="caso-cta__botones"><a class="btn btn--primary" href="../cuenta/registro.html?rol=volunteer" data-i18n="cases.ctaHelp">Quiero ayudar</a>'
    '<a class="btn btn--ghost" href="../contacto.html?role=ong" data-i18n="cases.ctaOrg">Represento a una organización</a></div></aside>'
)


def pagina_caso(c, todos, estilos, cabecera, pie):
    url = '%s/%s/%s.html' % (DOMINIO, C['carpeta'], c['slug'])
    imagen = '%s/imagenes/%s/%s-compartir.jpg' % (DOMINIO, C['imagenes'], c['imagen'])
    minutos = max(1, math.ceil(c['palabras'] / 200))
    datos = jsonld(
        {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            'headline': c['titulo'],
            'description': c['descripcion'],
            'image': imagen,
            'datePublished': c['publicado'],
            'dateModified': c.get('actualizado', c['publicado']),
            'inLanguage': 'es',
            'mainEntityOfPage': url,
            'author': {'@type': 'Organization', 'name': MARCA, 'url': DOMINIO + '/'},
            'publisher': {'@type': 'Organization', 'name': MARCA, 'logo': {'@type': 'ImageObject', 'url': LOGO}},
        },
        migas(('Inicio', DOMINIO + '/'), (C['nombre'], '%s/%s/' % (DOMINIO, C['carpeta'])), (c['titulo'], url)),
    )
    extra = ['<meta property="article:published_time" content="%s" />' % c['publicado']]
    otros = [o for o in todos if o['slug'] != c['slug']][:3]
    return '\n'.join([
        cabeza_html(c['titulo_seo'], c['descripcion'], url, 'article', imagen, c['imagen_alt'], extra, datos),
        estilos,
        '</head>',
        '<body class="home detail-page caso">' + cabecera + '<main id="main">',
        '  <section class="detail-hero"><div class="container reveal caso__cabeza">'
        '<a class="breadcrumb" href="index.html" data-i18n="%s">%s</a>'
        '<span class="eyebrow">%s</span><h1>%s</h1><p class="detail-hero__lead">%s</p>'
        '<p class="caso__meta">Publicado el <time datetime="%s">%s</time> · %s · %d min de lectura</p>'
        '<p class="caso__idioma" data-i18n="cases.soloEs"></p></div></section>'
        % (C['volver_clave'], C['volver'], e(c['etiqueta']), e(c['titulo']), e(c['resumen']), c['publicado'],
           fecha_larga(c['publicado']), e(c['suceso']), minutos),
        '  <div class="container caso__marco">',
        '    <figure class="caso__foto"><img src="../imagenes/%s/%s.webp" width="%s" height="%s" alt="%s" />'
        '<figcaption>%s</figcaption></figure>'
        % (C['imagenes'], c['imagen'], c['imagen_ancho'], c['imagen_alto'], e(c['imagen_alt']),
           # Sin `credito` es una imagen propia (una ilustración): sin «Foto:».
           e(c['imagen_pie']) + (' · Foto: ' + e(c['credito']) if c.get('credito') else '')),
        '    <article class="caso__texto">',
        cuerpo_html(c['cuerpo_md']),
        '    </article>',
        '    ' + CTA,
        '  </div>',
        '  <section class="detail-section caso__otros"><div class="container"><div class="detail-heading reveal">'
        '<h2 data-i18n="%s">%s</h2></div><div class="casos-rejilla">%s</div></div></section>'
        % (C['mas_clave'], C['mas'], ''.join(tarjeta(o) for o in otros)) if otros else '',
        '</main>' + pie + '</body>',
        '</html>',
        '',
    ])


def pagina_indice(todos, estilos, cabecera, pie):
    url = '%s/%s/' % (DOMINIO, C['carpeta'])
    datos = jsonld(
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            'name': C['indice_titulo'],
            'description': C['indice_descripcion'],
            'url': url,
            'inLanguage': 'es',
            'hasPart': [{'@type': 'BlogPosting', 'headline': c['titulo'],
                         'url': '%s/%s/%s.html' % (DOMINIO, C['carpeta'], c['slug']),
                         'datePublished': c['publicado']} for c in todos],
        },
        migas(('Inicio', DOMINIO + '/'), (C['nombre'], url)),
    )
    return '\n'.join([
        cabeza_html(C['indice_titulo'], C['indice_descripcion'], url, 'website', DOMINIO + '/imagenes/compartir.jpg',
                    'PeopleForPeople: Tu ayuda. Su esperanza. Nosotros unimos.', [], datos),
        estilos,
        '</head>',
        '<body class="home detail-page caso">' + cabecera + '<main id="main">',
        '  <section class="detail-hero"><div class="container reveal">'
        '<a class="breadcrumb" href="../index.html">← PeopleForPeople</a>'
        '<span class="eyebrow" data-i18n="nav.resources">Recursos</span><h1 data-i18n="%s">%s</h1>'
        '<p class="detail-hero__lead" data-i18n="%s">%s</p>'
        '<p class="caso__idioma" data-i18n="cases.soloEs"></p></div></section>'
        % (C['titulo_clave'], C['nombre'], C['entrada_clave'], C['entrada']),
        '  <section class="detail-section"><div class="container"><div class="casos-rejilla casos-rejilla--indice">%s</div></div></section>'
        % ''.join(tarjeta(c) for c in todos),
        '  <section class="detail-section detail-section--white"><div class="container">%s</div></section>'
        % CTA,
        '</main>' + pie + '</body>',
        '</html>',
        '',
    ])


def comprobar(todos):
    avisos = []
    for c in todos + [{'slug': C['carpeta'] + '/index', 'titulo_seo': C['indice_titulo'], 'descripcion': C['indice_descripcion']}]:
        largo = len('%s | %s' % (c['titulo_seo'], MARCA))
        if largo > 60:
            avisos.append('%s: el título tiene %d caracteres (máximo 60)' % (c['slug'], largo))
        if not 120 <= len(c['descripcion']) <= 160:
            avisos.append('%s: la descripción tiene %d caracteres (120-160)' % (c['slug'], len(c['descripcion'])))
    return avisos


def main():
    global C
    solo_comprobar = '--check' in sys.argv
    estilos, cabecera, pie = piezas_de_plantilla()
    salida, avisos = {}, []
    for C in COLECCIONES:
        todos = casos()
        salida['%s/index.html' % C['carpeta']] = pagina_indice(todos, estilos, cabecera, pie)
        for c in todos:
            salida['%s/%s.html' % (C['carpeta'], c['slug'])] = pagina_caso(c, todos, estilos, cabecera, pie)
        avisos += comprobar(todos)

    desfasadas = []
    for r, texto in salida.items():
        actual = leer(r) if os.path.exists(ruta(r)) else None
        if actual != texto:
            desfasadas.append(r)
            if not solo_comprobar:
                escribir(r, texto)
    for a in avisos:
        print('AVISO', a)
    if solo_comprobar:
        print('Desfasadas:', ', '.join(desfasadas) if desfasadas else 'ninguna')
        sys.exit(1 if desfasadas or avisos else 0)
    print('Escritas:', ', '.join(desfasadas) if desfasadas else 'nada que cambiar')


if __name__ == '__main__':
    main()
