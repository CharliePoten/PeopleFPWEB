"""
Los menús de la cabecera, definidos una vez y escritos en todas las páginas.

Hay dos: el de escritorio (`<nav class="menu-ancho">`, con desplegables) y
el lateral de las tres rayas (`<nav class="nav" id="nav">`), que es el que
se ve por debajo de 1024 px. Antes se copiaban a mano en cada HTML y bastaba
con olvidar uno para que el móvil enseñara otro menú. Ahora salen de MENU.

    python _herramientas/cabecera.py           # escribe
    python _herramientas/cabecera.py --check   # solo dice si algo está desfasado

Después hay que ejecutar `casos.py`, que copia la cabecera de
`documentos.html` en las páginas de casos y de actualidad.
"""
import glob
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (clave del texto, texto en español, enlace desde la raíz o None, submenú)
# Un enlace que empieza por «#» es una sección de la portada.
MENU = [
    ('nav.platform', 'La plataforma', None, [
        ('nav.pCoord', 'Centro de coordinación', 'plataforma/centro-de-coordinacion.html'),
        ('nav.pApp', 'App de voluntariado', 'plataforma/app-voluntariado.html'),
        ('nav.pInformes', 'Informes y certificados', 'plataforma/informes-y-certificados.html'),
        ('nav.pTrust', 'Seguridad y verificación', 'plataforma/seguridad-y-verificacion.html'),
    ]),
    ('nav.who', 'Para quién', '#para-quien', [
        ('nav.whoNgo', 'ONG y asociaciones', 'ongs/index.html'),
        ('nav.whoMuni', 'Ayuntamientos', 'comunidades/index.html'),
        ('nav.whoCorp', 'Empresas RSC', 'empresas/index.html'),
        ('nav.whoVol', 'Voluntarios', 'voluntarios/index.html'),
    ]),
    ('nav.resources', 'Recursos', None, [
        ('nav.cases', 'Casos de impacto', 'casos/index.html'),
        ('nav.calc', 'Calculadora de impacto', 'calculadora.html'),
        ('nav.news', 'Actualidad', 'actualidad/index.html'),
        ('nav.support', 'Centro de soporte', 'ayuda.html'),
    ]),
    ('nav.contact', 'Contacto', 'contacto.html', []),
]

FLECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'


def enlace(destino, archivo):
    """La ruta de `destino` vista desde `archivo`."""
    pre = '../' if os.path.dirname(archivo) else ''
    if destino.startswith('#'):
        return destino if archivo == 'index.html' else pre + 'index.html' + destino
    return pre + destino


def menu_ancho(archivo):
    partes = []
    for clave, texto, destino, sub in MENU:
        if not sub:
            partes.append('<li><a class="menu-ancho__enlace" href="%s" data-i18n="%s">%s</a></li>'
                          % (enlace(destino, archivo), clave, texto))
            continue
        ident = 'menu-' + clave.split('.')[1]
        partes.append(
            '<li class="menu-ancho__grupo"><button class="menu-ancho__boton" type="button" aria-expanded="false" '
            'aria-controls="%s"><span data-i18n="%s">%s</span>%s</button><ul class="menu-ancho__desplegable" id="%s">%s</ul></li>'
            % (ident, clave, texto, FLECHA, ident,
               ''.join('<li><a href="%s" data-i18n="%s">%s</a></li>' % (enlace(d, archivo), k, t) for k, t, d in sub)))
    return ('<nav class="menu-ancho" aria-label="Secciones" data-i18n-aria="nav.desktopAria"><ul class="menu-ancho__lista">'
            + ''.join(partes) + '</ul></nav>')


def menu_lateral(archivo):
    filas = []
    for n, (clave, texto, destino, sub) in enumerate(MENU + [('nav.account', 'Mi cuenta', 'cuenta/index.html', [])], 1):
        cabeza = '<span>%02d</span><strong data-i18n="%s">%s</strong>' % (n, clave, texto)
        if destino:
            filas.append('<li><a class="nav__link" href="%s">%s</a></li>' % (enlace(destino, archivo), cabeza))
        else:
            # Grupo sin página propia: título, no enlace.
            filas.append('<li><span class="nav__link nav__link--grupo">%s</span></li>' % cabeza)
        if sub:
            filas.append('<li><ul class="nav__sub">%s</ul></li>'
                         % ''.join('<li><a class="nav__sublink" href="%s" data-i18n="%s">%s</a></li>'
                                   % (enlace(d, archivo), k, t) for k, t, d in sub))
    return ('<nav class="nav" id="nav" aria-label="Principal" data-open="false"><div class="nav__head">'
            '<span data-i18n="nav.explore">Explora PeopleForPeople</span>'
            '<button class="nav__close" type="button" aria-label="Cerrar menú">&times;</button></div>'
            '<ul class="nav__list">' + ''.join(filas) + '</ul>'
            '<p class="nav__tagline" data-i18n="hero.slogan">Tu ayuda. Su esperanza. Nosotros unimos.</p></nav>')


LATERAL = re.compile(r'<nav class="nav" id="nav".*?</nav>', re.S)
ANCHO = re.compile(r'<nav class="menu-ancho".*?</nav>', re.S)
DEMO = re.compile(r'<a class="btn btn--primary btn--small header__demo"[^>]*>[^<]*</a>')


def paginas():
    for f in sorted(glob.glob(os.path.join(RAIZ, '*.html')) + glob.glob(os.path.join(RAIZ, '*', '*.html'))):
        yield os.path.relpath(f, RAIZ).replace('\\', '/')


def main():
    solo_comprobar = '--check' in sys.argv
    desfasadas = []
    for archivo in paginas():
        ruta = os.path.join(RAIZ, archivo)
        with open(ruta, encoding='utf-8') as fh:
            texto = fh.read()
        if 'id="site-header"' not in texto or not LATERAL.search(texto):
            continue
        nuevo = LATERAL.sub(lambda m: menu_lateral(archivo), texto, count=1)
        nuevo = ANCHO.sub(lambda m: menu_ancho(archivo), nuevo, count=1)
        nuevo = DEMO.sub('', nuevo)
        if nuevo != texto:
            desfasadas.append(archivo)
            if not solo_comprobar:
                with open(ruta, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(nuevo)
    if solo_comprobar:
        print('Desfasadas:', ', '.join(desfasadas) if desfasadas else 'ninguna')
        sys.exit(1 if desfasadas else 0)
    print('Escritas:', ', '.join(desfasadas) if desfasadas else 'nada que cambiar')


if __name__ == '__main__':
    main()
