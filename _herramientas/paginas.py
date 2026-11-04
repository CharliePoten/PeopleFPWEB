"""
Las páginas de «La plataforma», la de Protección Civil y la calculadora de
impacto.

Cada página se describe aquí como una lista de bloques, con sus textos en
español y en alemán. El script escribe

    plataforma/centro-de-coordinacion.html
    plataforma/app-voluntariado.html
    plataforma/informes-y-certificados.html
    plataforma/seguridad-y-verificacion.html
    proteccion-civil/index.html
    calculadora.html
    404.html                  la de «no existe»: sin SEO y con todo desde la raíz
    js/paginas-i18n.js        los textos de todas ellas, en los dos idiomas

con la cabecera y el pie de `documentos.html` y el SEO de `seo.py` (título,
descripción, canonical…: se cambian en la tabla PAGINAS de `seo.py`).

    python _herramientas/paginas.py           # escribe
    python _herramientas/paginas.py --check   # solo dice si algo está desfasado

Norma para los textos: solo lo que la plataforma hace hoy. Cada afirmación
de estas páginas sale del código de la app o de la web (las funciones del
servidor, las pantallas, las migraciones). Si algo cambia allí, se cambia
aquí.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabecera  # noqa: E402
import seo  # noqa: E402

RAIZ = seo.RAIZ
ES, DE = {}, {}


def t(clave, es, de):
    """Registra un texto en los dos idiomas y devuelve el atributo + el texto en español."""
    assert clave not in ES or ES[clave] == es, clave
    ES[clave], DE[clave] = es, de
    return clave, es


def txt(etiqueta, clave, es, de, clase='', extra=''):
    k, v = t(clave, es, de)
    c = ' class="%s"' % clase if clase else ''
    return '<%s%s data-i18n="%s"%s>%s</%s>' % (etiqueta, c, k, extra, v, etiqueta)


# ---------------------------------------------------------------- bloques

def cabecera_azul(pre, eyebrow, titulo, entrada, botones, clase='', figura='', h1_eyebrow=False):
    """La cabecera azul. `clase` elige cómo va la imagen junto al título
    (ver «Cabeceras con imagen» en css/detail.css) y `figura` es esa imagen.
    Con `h1_eyebrow`, el <h1> es la línea de arriba (lo que se busca, como en
    las páginas de cada público) y el título grande va en un párrafo."""
    if h1_eyebrow:
        cabeza = txt('h1', *eyebrow, clase='eyebrow') + txt('p', *titulo, clase='detail-hero__titulo')
    else:
        cabeza = txt('span', *eyebrow, clase='eyebrow') + txt('h1', *titulo)
    return ('  <section class="detail-hero%s"><div class="container reveal">' % (' ' + clase if clase else '')
            + '<a class="breadcrumb" href="%s">← PeopleForPeople</a>' % (pre or './')
            + cabeza
            + txt('p', *entrada, clase='detail-hero__lead')
            + '<div class="detail-hero__actions">' + ''.join(botones) + '</div></div>' + figura + '</section>')


def cristal(pre):
    """Centro de soporte: tres preguntas de la FAQ, en cristal sobre la foto
    (ver «Cabeceras con arte» en css/detail.css). Es ilustración: las
    preguntas de verdad están debajo."""
    return ('<div class="arte arte--cristal" aria-hidden="true">'
            '<span class="arte__franja arte__franja--ambar"></span><span class="arte__franja arte__franja--azul"></span>'
            '<img class="arte__foto" src="%simagenes/paginas/soporte.webp" width="1400" height="788" alt="" />' % pre
            + txt('span', 'faq.arte1', '¿Cuánto cuesta usar la app?', 'Was kostet die Nutzung der App?', clase='arte__pildora')
            + txt('span', 'faq.arte2', '¿Cómo se acreditan mis horas?', 'Wie werden meine Stunden nachgewiesen?',
                  clase='arte__pregunta arte__pregunta--2')
            + txt('span', 'faq.arte3', '¿Funciona sin cobertura?', 'Funktioniert die App ohne Netz?',
                  clase='arte__pregunta arte__pregunta--3')
            + '</div>')


def ventana(src, url, alt_clave, lazy=False):
    """Una captura del panel dentro de su ventana de navegador. `lazy` para
    las que quedan lejos de la cabecera."""
    return ('<div class="navegador"><div class="navegador__barra" aria-hidden="true"><span class="navegador__punto"></span>'
            '<span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__url">%s</span></div>'
            '<img src="%s" width="1600" height="1000"%s alt="" data-i18n-alt="%s" /></div>'
            % (url, src, ' loading="lazy"' if lazy else '', alt_clave))


def boton(href, clave, es, de, primario=True):
    k, v = t(clave, es, de)
    return '<a class="btn %s" href="%s" data-i18n="%s">%s</a>' % ('btn--primary' if primario else 'btn--ghost', href, k, v)


def enlace(href, clave, es, de, extra=''):
    """Un enlace con su frase («… →»), para debajo de un bloque."""
    k, v = t(clave, es, de)
    return '<a class="text-link" href="%s"%s data-i18n="%s">%s</a>' % (href, extra, k, v)


def enlaces(*piezas):
    """Los enlaces de debajo de un bloque, en una línea que se parte sola."""
    return '<p class="pag-enlaces reveal">' + ' '.join(piezas) + '</p>'


def encabezado(eyebrow, titulo, entrada=None):
    h = '<div class="detail-heading reveal">' + txt('span', *eyebrow, clase='eyebrow') + txt('h2', *titulo)
    if entrada:
        h += txt('p', *entrada)
    return h + '</div>'


def tarjetas(eyebrow, titulo, items, fondo='detail-section--white', entrada=None, ident='', pie=''):
    """Tarjetas numeradas. `ident` es el id de la sección (para enlazarla) y
    `pie`, lo que va debajo de las tarjetas (enlaces)."""
    cuerpo = ''.join(
        '<article class="benefit-card reveal"><span class="benefit-card__number">%02d</span>%s%s</article>'
        % (n, txt('h3', *it[0]), txt('p', *it[1])) for n, it in enumerate(items, 1))
    return ('  <section class="detail-section %s"%s><div class="container">%s<div class="benefit-grid">%s</div>%s</div></section>'
            % (fondo, ' id="%s"' % ident if ident else '', encabezado(eyebrow, titulo, entrada), cuerpo, pie))


def pasos(eyebrow, titulo, items, fondo='detail-section--navy'):
    cuerpo = ''.join('<article class="step reveal">%s%s</article>' % (txt('h3', *a), txt('p', *b)) for a, b in items)
    return ('  <section class="detail-section %s"><div class="container">%s<div class="steps">%s</div></div></section>'
            % (fondo, encabezado(eyebrow, titulo), cuerpo))


def con_imagen(eyebrow, titulo, entrada, imagen, fondo='detail-section'):
    return ('  <section class="detail-section %s"><div class="container pag-dos">%s<figure class="pag-figura reveal">%s</figure></div></section>'
            % (fondo, encabezado(eyebrow, titulo, entrada), imagen))


def llamada(titulo, entrada, btn):
    return ('  <section class="detail-section detail-section--white"><div class="container"><div class="cta-panel reveal"><div>%s%s</div>%s</div></div></section>'
            % (txt('h2', *titulo), txt('p', *entrada), btn))


PLATAFORMA = [
    ('plataforma/centro-de-coordinacion.html', 'nav.pCoord', 'Centro de coordinación'),
    ('plataforma/app-voluntariado.html', 'nav.pApp', 'App de voluntariado'),
    ('plataforma/informes-y-certificados.html', 'nav.pInformes', 'Informes y certificados'),
    ('plataforma/seguridad-y-verificacion.html', 'nav.pTrust', 'Seguridad y verificación'),
]


def mas_plataforma(archivo):
    """Enlaces a las otras tres páginas de la plataforma."""
    otras = [p for p in PLATAFORMA if p[0] != archivo]
    enlaces = ''.join('<a class="pag-otra" href="%s" data-i18n="%s">%s</a>'
                      % (os.path.basename(a), k, v) for a, k, v in otras)
    return ('  <section class="detail-section"><div class="container pag-otras">'
            + txt('span', 'pl.mas', 'Más de la plataforma', 'Mehr zur Plattform', clase='eyebrow')
            + '<div class="pag-otras__lista">' + enlaces + '</div></div></section>')


# ---------------------------------------------------------------- páginas

def centro():
    pre = '../'
    alta = boton(pre + 'cuenta/registro.html?rol=organization', 'pl.altaOrg', 'Dar de alta mi organización', 'Organisation registrieren')
    return [
        cabecera_azul(pre, ('pl.eyebrow', 'La plataforma', 'Die Plattform'),
                      ('pl.c.hero', 'Centro de coordinación', 'Koordinationszentrale'),
                      ('pl.c.lead', 'Todo lo que necesita quien coordina, en un mismo sitio y sin grupos de mensajería: lanzar una operación, saber quién va, quién ha llegado y cuántas horas se han hecho.',
                       'Alles, was Koordinierende brauchen, an einem Ort und ohne Messenger-Gruppen: einen Einsatz starten, wissen, wer kommt, wer angekommen ist und wie viele Stunden geleistet wurden.'),
                      [alta, boton(pre + 'contacto.html#mensaje', 'pl.hablar', 'Hablar con nosotros', 'Mit uns sprechen', False)],
                      clase='detail-hero--panel', figura=red()),
        con_imagen(('pl.c.panelEy', 'El panel web', 'Das Web-Dashboard'),
                   ('pl.c.panelT', 'Abre por lo que hay que resolver hoy.', 'Es beginnt mit dem, was heute erledigt werden muss.'),
                   ('pl.c.panelP', 'Se usa en el navegador, sin instalar nada. Al entrar no ves gráficas: ves las altas que esperan respuesta, las horas por validar y las misiones a medio cubrir. Si hay una emergencia activa, aparece arriba del todo.',
                    'Es läuft im Browser, ohne Installation. Beim Öffnen siehst du keine Diagramme, sondern offene Registrierungen, zu bestätigende Stunden und halb besetzte Einsätze. Läuft gerade ein Notfall, steht er ganz oben.'),
                   ventana('../imagenes/consola-panel.webp', 'peopleforpeople.es/cuenta', 'panel.alt1'),
                   'detail-section--white'),
        tarjetas(('pl.c.qEy', 'Qué puedes hacer', 'Was du tun kannst'),
                 ('pl.c.qT', 'Coordinar sin perder el hilo.', 'Koordinieren, ohne den Überblick zu verlieren.'), [
            (('pl.c.q1t', 'Operaciones desde una plantilla', 'Einsätze aus einer Vorlage'),
             ('pl.c.q1b', 'Siete escenarios preparados —inundación, incendio forestal, evacuación, ola de calor, búsqueda de una persona, punto de reparto y apoyo vecinal— con las tareas, las habilidades y las plazas ya definidas. Ajustas las cifras y publicas.',
              'Sieben vorbereitete Szenarien – Hochwasser, Waldbrand, Evakuierung, Hitzewelle, Personensuche, Verteilstelle und Nachbarschaftshilfe – mit Aufgaben, Fähigkeiten und Plätzen. Du passt die Zahlen an und veröffentlichst.')),
            (('pl.c.q2t', 'El aviso llega a quien está cerca', 'Die Meldung erreicht, wer in der Nähe ist'),
             ('pl.c.q2b', 'Cada misión avisa por notificación a los voluntarios que la tienen dentro de su radio. En una urgencia crítica puedes ampliar ese radio para llegar a más gente.',
              'Jeder Einsatz benachrichtigt die Freiwilligen, in deren Umkreis er liegt. Bei kritischer Dringlichkeit kannst du den Umkreis erweitern, um mehr Menschen zu erreichen.')),
            (('pl.c.q3t', 'Plazas y cobertura', 'Plätze und Abdeckung'),
             ('pl.c.q3b', 'Cada tarea dice cuántas personas necesita. Ves en directo qué está cubierto y qué sigue sin gente.',
              'Jede Aufgabe sagt, wie viele Personen sie braucht. Du siehst live, was besetzt ist und wo noch Leute fehlen.')),
            (('pl.c.q4t', 'Quién ha llegado', 'Wer angekommen ist'),
             ('pl.c.q4b', 'Quien coordina marca en la app la llegada de cada persona. Sabes con cuánta gente cuentas en cada sitio, y las horas se calculan solas.',
              'Die Koordination vermerkt in der App die Ankunft jeder Person. Du weißt, mit wie vielen Leuten du an jedem Ort rechnen kannst, und die Stunden berechnen sich selbst.')),
            (('pl.c.q5t', 'Mensajes con orden', 'Nachrichten mit Ordnung'),
             ('pl.c.q5b', 'Las conversaciones cuelgan de cada misión u operación, no de un grupo abierto donde todo se mezcla.',
              'Gespräche hängen an einem Einsatz, nicht an einer offenen Gruppe, in der alles durcheinandergeht.')),
            (('pl.c.q6t', 'Tu voluntariado, de un vistazo', 'Deine Freiwilligen auf einen Blick'),
             ('pl.c.q6b', 'Quién está contigo, qué sabe hacer, cuántas horas lleva y cómo tiene la documentación.',
              'Wer dabei ist, was er oder sie kann, wie viele Stunden schon geleistet wurden und wie die Unterlagen stehen.')),
        ], fondo=''),
        pasos(('pl.pasoEy', 'Paso a paso', 'Schritt für Schritt'),
              ('pl.c.pT', 'De la alerta a la operación cubierta.', 'Von der Warnung zum besetzten Einsatz.'), [
            (('pl.c.p1t', 'Elige el escenario', 'Szenario wählen'), ('pl.c.p1b', 'Parte de una plantilla o crea la operación desde cero.', 'Starte mit einer Vorlage oder lege den Einsatz neu an.')),
            (('pl.c.p2t', 'Ajusta y publica', 'Anpassen und veröffentlichen'), ('pl.c.p2b', 'Dónde, cuándo, cuántas personas y con qué habilidades.', 'Wo, wann, wie viele Personen und mit welchen Fähigkeiten.')),
            (('pl.c.p3t', 'Llega el aviso', 'Die Meldung kommt an'), ('pl.c.p3b', 'Los voluntarios cercanos reciben la notificación y se apuntan.', 'Freiwillige in der Nähe werden benachrichtigt und melden sich an.')),
            (('pl.c.p4t', 'Ficha y valida', 'Erfassen und bestätigen'), ('pl.c.p4b', 'Marcas las llegadas y, al cerrar, validas las horas.', 'Du vermerkst die Ankünfte und bestätigst beim Abschluss die Stunden.')),
        ]),
        llamada(('pl.c.ctaT', 'Prueba el centro de coordinación con una misión real.', 'Teste die Koordinationszentrale mit einem echten Einsatz.'),
                ('pl.c.ctaP', 'Las dos primeras publicaciones son gratis. Comprobamos tu entidad antes de abrirte el panel.',
                 'Die ersten zwei Veröffentlichungen sind kostenlos. Wir prüfen deine Organisation, bevor wir das Dashboard freischalten.'), alta),
        mas_plataforma('plataforma/centro-de-coordinacion.html'),
    ]


def app():
    pre = '../'
    cuenta = boton(pre + 'cuenta/registro.html?rol=volunteer', 'pl.crear', 'Crear mi cuenta', 'Konto erstellen')
    # La de misiones va grande en la cabecera; aquí, las otras dos.
    moviles = ''.join('<img src="../imagenes/app/movil-%s.webp" width="740" height="1530" loading="lazy" alt="" data-i18n-alt="%s" />' % (n, a)
                      for n, a in (('bienvenida', 'app.shot1'), ('organizaciones', 'app.shot3')))
    asi = con_imagen(('pl.a.verEy', 'Así se ve', 'So sieht sie aus'),
                     ('pl.a.verT', 'Clara, directa y sin pasos de más.', 'Klar, direkt und ohne überflüssige Schritte.'),
                     ('pl.a.verP', 'Una misión se entiende de un vistazo: qué hace falta, dónde, cuándo y en qué punto está. Las pantallas son de la app real.',
                      'Ein Einsatz ist auf einen Blick verständlich: was gebraucht wird, wo, wann und wie weit er ist. Die Bildschirme stammen aus der echten App.'),
                     '<div class="pag-moviles">' + moviles + '</div>', 'detail-section--white tras-movil')
    return [
        cabecera_azul(pre, ('pl.eyebrow', 'La plataforma', 'Die Plattform'),
                      ('pl.a.hero', 'App de voluntariado', 'Freiwilligen-App'),
                      ('pl.a.lead', 'Para quien quiere ayudar: las misiones de cerca, un aviso cuando de verdad hace falta y tus horas siempre a mano.',
                       'Für alle, die helfen wollen: Einsätze in der Nähe, eine Meldung, wenn es wirklich nötig ist, und deine Stunden immer griffbereit.'),
                      [cuenta], clase='detail-hero--flota',
                      figura='<figure class="detail-hero__flota detail-hero__flota--movil"><img src="../imagenes/app/movil-misiones.webp" width="740" height="1530" alt="" data-i18n-alt="app.shot2" /></figure>'),
        asi,
        tarjetas(('pl.a.qEy', 'Lo que hace por ti', 'Was sie für dich tut'),
                 ('pl.a.qT', 'Ayudar sin estar pendiente del móvil.', 'Helfen, ohne ständig aufs Handy zu schauen.'), [
            (('pl.a.q1t', 'Avisos que suenan', 'Meldungen, die klingeln'),
             ('pl.a.q1b', 'Cuando se publica una misión cerca, el móvil te avisa aunque no tengas la app abierta. Y si la tienes abierta, el aviso también aparece.',
              'Wird in deiner Nähe ein Einsatz veröffentlicht, meldet sich dein Handy, auch wenn die App geschlossen ist. Ist sie geöffnet, erscheint die Meldung trotzdem.')),
            (('pl.a.q2t', 'Tú decides cuándo y hasta dónde', 'Du entscheidest, wann und wie weit'),
             ('pl.a.q2b', 'Eliges si quieres avisos solo de emergencias, solo de misiones planificadas o de las dos, y hasta qué distancia: 10, 25, 50 o 100 km.',
              'Du wählst, ob du nur Notfälle, nur geplante Einsätze oder beides bekommst, und bis zu welcher Entfernung: 10, 25, 50 oder 100 km.')),
            (('pl.a.q3t', 'Mapa y lista', 'Karte und Liste'),
             ('pl.a.q3b', 'Las misiones y las peticiones de ayuda de tu zona, en el mapa o en una lista.',
              'Einsätze und Hilfeanfragen in deiner Umgebung, auf der Karte oder als Liste.')),
            (('pl.a.q4t', 'Lo que sabes hacer, acreditado', 'Was du kannst – nachgewiesen'),
             ('pl.a.q4b', 'Indicas tus habilidades. Las que exigen titulación, como conducir un camión o manejar maquinaria pesada, se acreditan con un documento que revisa nuestro equipo.',
              'Du gibst deine Fähigkeiten an. Solche, die einen Nachweis erfordern – etwa Lkw fahren oder schwere Maschinen bedienen –, belegst du mit einem Dokument, das unser Team prüft.')),
            (('pl.a.q5t', 'Pedir ayuda en una emergencia', 'Im Notfall um Hilfe bitten'),
             ('pl.a.q5b', 'Cuando hay una emergencia declarada en tu provincia, pides ayuda a tus vecinos en un minuto y eliges la urgencia. Tu dirección exacta solo la recibe la persona que aceptas.',
              'Ist in deiner Provinz ein Notfall ausgerufen, bittest du deine Nachbarn in einer Minute um Hilfe und wählst die Dringlichkeit. Deine genaue Adresse bekommt nur die Person, die du annimmst.')),
            (('pl.a.q6t', 'Tus horas, siempre a mano', 'Deine Stunden immer griffbereit'),
             ('pl.a.q6b', 'Las horas validadas forman tu historial, que puedes imprimir. Son la base del certificado de voluntariado que emite la entidad.',
              'Die bestätigten Stunden bilden deinen Verlauf, den du ausdrucken kannst. Sie sind die Grundlage für die Freiwilligenbescheinigung der Organisation.')),
        ], fondo=''),
        llamada(('pl.a.ctaT', 'Empieza a ayudar cerca de ti.', 'Fang an, in deiner Nähe zu helfen.'),
                ('app.storeAccount', 'Mientras llega a las tiendas, crea tu cuenta en la web: es la misma con la que entrarás en la app.',
                 'Bis sie in den Stores ist, erstelle dein Konto im Web: Es ist dasselbe, mit dem du dich in der App anmeldest.'), cuenta),
        mas_plataforma('plataforma/app-voluntariado.html'),
    ]


def informes():
    pre = '../'
    return [
        cabecera_azul(pre, ('pl.eyebrow', 'La plataforma', 'Die Plattform'),
                      ('pl.i.hero', 'Informes y certificados', 'Berichte und Bescheinigungen'),
                      ('pl.i.lead', 'Cada hora se ficha sobre el terreno y la valida la entidad. De ahí salen la memoria de actividad, los datos para tu informe de RSC o ESG y la base del certificado de cada voluntario.',
                       'Jede Stunde wird vor Ort erfasst und von der Organisation bestätigt. Daraus entstehen der Tätigkeitsbericht, die Daten für deinen CSR- oder ESG-Bericht und die Grundlage für die Bescheinigung jeder freiwilligen Person.'),
                      [boton(pre + 'cuenta/registro.html?rol=organization', 'pl.altaOrg', 'Dar de alta mi organización', 'Organisation registrieren'),
                       boton(pre + 'calculadora.html', 'pl.i.calc', 'Probar la calculadora', 'Rechner ausprobieren', False)],
                      clase='detail-hero--flota',
                      figura='<figure class="detail-hero__flota detail-hero__flota--papel"><img src="../imagenes/certificado-ejemplo-es.webp" data-i18n-src="pl.i.docSrc" width="765" height="1024" alt="" data-i18n-alt="hours.docAlt" /></figure>'),
        tarjetas(('pl.i.qEy', 'Informes', 'Berichte'),
                 ('pl.i.qT', 'Datos que se pueden defender.', 'Daten, die man vertreten kann.'), [
            (('pl.i.q1t', 'Solo cuentan las validadas', 'Nur bestätigte Stunden zählen'),
             ('pl.i.q1b', 'Los totales solo suman horas validadas. Lo pendiente no se esconde: se avisa arriba, con un enlace para revisarlo.',
              'Die Summen enthalten nur bestätigte Stunden. Offenes wird nicht versteckt, sondern oben angezeigt, mit einem Link zur Prüfung.')),
            (('pl.i.q2t', 'La memoria, entre dos fechas', 'Der Bericht zwischen zwei Daten'),
             ('pl.i.q2b', 'Personas, horas y actividad entre dos fechas, por persona o por misión. Se descarga en CSV o se imprime.',
              'Personen, Stunden und Aktivität zwischen zwei Daten, nach Person oder nach Einsatz. Als CSV herunterladen oder drucken.')),
            (('pl.i.q3t', 'Para subvenciones, RSC y ESG', 'Für Förderungen, CSR und ESG'),
             ('pl.i.q3b', 'Es la memoria que se adjunta a la justificación de una subvención. A una empresa le da los datos de participación para su memoria de RSC o su informe ESG.',
              'Es ist der Bericht, der einem Förderantrag beigelegt wird. Unternehmen liefert er die Teilnahmedaten für ihren CSR- oder ESG-Bericht.')),
            (('pl.i.q4t', 'La base del certificado', 'Die Grundlage der Bescheinigung'),
             ('pl.i.q4b', 'La Ley 45/2015 da a cada voluntario derecho a un certificado con la fecha de incorporación, la duración, las tareas y el lugar (art. 24.1). Lo expide y firma la entidad, sobre las horas validadas.',
              'Das spanische Freiwilligengesetz (Ley 45/2015, Art. 24.1) gibt jeder freiwilligen Person das Recht auf eine Bescheinigung mit Eintrittsdatum, Dauer, Aufgaben und Ort. Sie wird von der Organisation auf Basis der bestätigten Stunden ausgestellt.')),
        ], fondo='',
           pie=enlaces(enlace('../actualidad/ley-45-2015-obligaciones-entidades.html', 'pl.i.ley',
                              'Lo que la Ley 45/2015 exige a una entidad de voluntariado →',
                              'Was das spanische Freiwilligengesetz von Organisationen verlangt (auf Spanisch) →'),
                       enlace('../actualidad/horas-voluntariado-subvenciones.html', 'pl.i.horas',
                              'Cómo cuentan las horas de voluntariado en una subvención →',
                              'Wie Freiwilligenstunden bei einer Förderung zählen (auf Spanisch) →'))),
        con_imagen(('pl.i.vEy', 'Validar', 'Bestätigen'),
                   ('pl.i.vT', 'Ninguna hora cuenta sin que alguien la mire.', 'Keine Stunde zählt, ohne dass jemand sie geprüft hat.'),
                   ('pl.i.vP', 'Las horas llegan de la app con el fichaje de cada persona. Se validan una a una o en tanda; si alguien las ajusta, tiene que decir por qué, y la persona voluntaria lo lee en su historial.',
                    'Die Stunden kommen mit der Erfassung jeder Person aus der App. Sie werden einzeln oder gesammelt bestätigt; wer sie korrigiert, muss einen Grund angeben, und die freiwillige Person liest ihn in ihrem Verlauf.'),
                   '<div class="navegador"><div class="navegador__barra" aria-hidden="true"><span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__url">peopleforpeople.es/cuenta/horas</span></div>'
                   '<img src="../imagenes/consola-horas.webp" width="1600" height="1000" loading="lazy" alt="" data-i18n-alt="panel.alt3" /></div>',
                   'detail-section--white'),
        pasos(('pl.pasoEy', 'Paso a paso', 'Schritt für Schritt'),
              ('pl.i.pT', 'De la llegada al certificado.', 'Von der Ankunft zur Bescheinigung.'), [
            (('pl.i.p1t', 'Se fichan', 'Erfassen'), ('pl.i.p1b', 'Quien coordina marca la llegada en la app; al cerrar, se calculan las horas.', 'Die Koordination vermerkt die Ankunft in der App; beim Abschluss werden die Stunden berechnet.')),
            (('pl.i.p2t', 'Se validan', 'Bestätigen'), ('pl.i.p2b', 'La entidad las confirma o las ajusta, y si las ajusta dice por qué.', 'Die Organisation bestätigt oder korrigiert sie – und begründet jede Korrektur.')),
            (('pl.i.p3t', 'Se usan fuera', 'Draußen nutzen'), ('pl.i.p3b', 'Memoria en CSV o impresa, historial de cada voluntario y certificado de la entidad.', 'Bericht als CSV oder gedruckt, Verlauf jeder freiwilligen Person und Bescheinigung der Organisation.')),
        ]),
        llamada(('pl.i.ctaT', '¿Cuánto podría acreditar tu plantilla?', 'Wie viel könnte euer Team nachweisen?'),
                ('pl.i.ctaP', 'La calculadora estima personas, horas y el valor del tiempo donado, con supuestos que puedes cambiar.',
                 'Der Rechner schätzt Personen, Stunden und den Wert der gespendeten Zeit – mit Annahmen, die du ändern kannst.'),
                boton(pre + 'calculadora.html', 'pl.i.calcAbrir', 'Abrir la calculadora', 'Rechner öffnen')),
        mas_plataforma('plataforma/informes-y-certificados.html'),
    ]


def red():
    """La cabecera del Centro de coordinación: puntos que se conectan en red
    y acaban en uno solo, el que coordina. Dibujo plano, decorativo."""
    entradas = [(70, 105), (70, 200), (70, 295)]
    medios = [(250, 60), (250, 153), (250, 247), (250, 340)]
    centro = (430, 200)
    enlaces = [(0, 0), (0, 1), (0, 2), (1, 1), (1, 2), (2, 1), (2, 2), (2, 3)]
    lineas = ''.join('<line x1="%d" y1="%d" x2="%d" y2="%d" />' % (entradas[a] + medios[b]) for a, b in enlaces)
    lineas += ''.join('<line x1="%d" y1="%d" x2="%d" y2="%d" />' % (m + centro) for m in medios)
    puntos = (''.join('<circle class="red__entrada" cx="%d" cy="%d" r="20" />' % p for p in entradas)
              + ''.join('<circle class="red__medio" cx="%d" cy="%d" r="26" />' % p for p in medios)
              + '<circle class="red__centro" cx="%d" cy="%d" r="36" />' % centro)
    return ('<figure class="detail-hero__panel red" aria-hidden="true">'
            '<svg viewBox="0 0 500 400" focusable="false"><g class="red__lineas">%s</g>%s</svg></figure>' % (lineas, puntos))


def ficha():
    """La ficha de verificación de la cabecera de Seguridad: un esquema del
    proceso (no los datos de ninguna entidad), con el sello al final."""
    filas = ''.join('<li><span>%02d</span>%s%s</li>' % (n, txt('strong', a, b, c), txt('em', d, e, f))
                    for n, (a, b, c, d, e, f) in enumerate([('pl.s.f1', 'Razón social y CIF', 'Firmenname und Steuernummer', 'pl.s.f1e', 'Dígito de control válido', 'Prüfziffer gültig'), ('pl.s.f2', 'Representación', 'Vertretung', 'pl.s.f2e', 'Declarada', 'Erklärt'), ('pl.s.f3', 'Revisión del equipo', 'Prüfung durch das Team', 'pl.s.f3e', 'Hecha a mano', 'Von Hand'), ('pl.s.f4', 'Publicar misiones', 'Einsätze veröffentlichen', 'pl.s.f4e', 'Permitido', 'Erlaubt')], 1))
    return ('<figure class="detail-hero__panel ficha" aria-label="Proceso de verificación de una entidad">'
            + txt('p', 'pl.s.fT', 'Alta de una entidad', 'Anmeldung einer Organisation', clase='ficha__titulo')
            + txt('p', 'pl.s.fS', 'Lo que se comprueba antes de que pueda publicar.', 'Was geprüft wird, bevor sie veröffentlichen kann.', clase='ficha__sub')
            + '<ol>' + filas + '</ol>'
            + txt('p', 'pl.s.fSello', 'Entidad verificada', 'Geprüfte Organisation', clase='ficha__sello')
            + '</figure>')


def seguridad():
    pre = '../'
    alta = boton(pre + 'cuenta/registro.html?rol=organization', 'pl.altaOrg', 'Dar de alta mi organización', 'Organisation registrieren')
    # Las cuatro de la portada, con sus mismas claves (el alemán ya está en home-i18n.js).
    tarj = [
        (('trust.c1t', 'Nadie ve dónde vives', ''), ('trust.c1b', 'Tu ubicación solo sirve para calcular distancias. El mapa enseña cuántas personas hay disponibles en una zona, nunca quién ni dónde.', '')),
        (('trust.c2t', 'Tu dirección, solo a quien aceptas', ''), ('trust.c2b', 'Si pides ayuda, quien se ofrece ve una zona aproximada de un kilómetro. La dirección exacta solo la recibe la persona que aceptas.', '')),
        (('trust.c3t', 'Entidades verificadas', ''), ('trust.c3b', 'Solo las entidades que ha verificado el equipo de PeopleForPeople pueden publicar misiones y coordinar operaciones.', '')),
        (('trust.c4t', 'Nadie te escribe sin permiso', ''), ('trust.c4b', 'Para escribirte por privado hace falta un vínculo —que te hayan aceptado en una misión, o que tú hayas aceptado su ayuda— o que aceptes antes su solicitud.', '')),
    ]
    return [
        cabecera_azul(pre, ('pl.eyebrow', 'La plataforma', 'Die Plattform'),
                      ('pl.s.hero', 'Seguridad y verificación', 'Sicherheit und Prüfung'),
                      ('pl.s.lead', 'Publicar en PeopleForPeople moviliza a personas que se van a presentar en un sitio. Por eso ninguna entidad publica hasta que comprobamos que existe y que quien la registra la representa.',
                       'Eine Veröffentlichung auf PeopleForPeople bringt Menschen dazu, an einen Ort zu kommen. Deshalb veröffentlicht keine Organisation etwas, bevor wir geprüft haben, dass es sie gibt und dass die anmeldende Person sie vertritt.'),
                      [alta], clase='detail-hero--panel', figura=ficha()),
        pasos(('pl.s.vEy', 'Verificación', 'Prüfung'),
              ('pl.s.vT', 'Cómo comprobamos una entidad.', 'Wie wir eine Organisation prüfen.'), [
            (('pl.s.v1t', 'Alta con sus datos', 'Anmeldung mit ihren Daten'),
             ('pl.s.v1b', 'Razón social, CIF o NIF, tipo de entidad, dirección y, si la tiene, web. Quien la registra declara que la representa.',
              'Firmenname, Steuernummer (CIF/NIF), Art der Organisation, Adresse und – falls vorhanden – Website. Wer sie anmeldet, erklärt, sie zu vertreten.')),
            (('pl.s.v2t', 'El CIF se comprueba al escribirlo', 'Die Steuernummer wird sofort geprüft'),
             ('pl.s.v2b', 'Los CIF y NIF llevan un dígito de control: uno mal tecleado no pasa, y no hace falta esperar a la revisión para saberlo.',
              'CIF und NIF haben eine Prüfziffer: Eine falsch getippte Nummer wird sofort abgelehnt, ohne auf die Prüfung warten zu müssen.')),
            (('pl.s.v3t', 'Revisión a mano', 'Prüfung von Hand'),
             ('pl.s.v3b', 'Una persona de nuestro equipo revisa los datos antes de activar la entidad. Cada verificación, y cada una que se retira, queda registrada.',
              'Eine Person aus unserem Team prüft die Daten, bevor die Organisation freigeschaltet wird. Jede Freischaltung – und jeder Widerruf – wird protokolliert.')),
            (('pl.s.v4t', 'Bloqueo en el servidor', 'Sperre auf dem Server'),
             ('pl.s.v4b', 'Mientras no está verificada, la base de datos no le deja publicar misiones ni coordinar operaciones, aunque alguien lo intente fuera de la app. Y si cambia la razón social o el CIF, hay que verificarla de nuevo.',
              'Solange sie nicht geprüft ist, lässt die Datenbank sie keine Einsätze veröffentlichen oder koordinieren – auch nicht an der App vorbei. Ändern sich Firmenname oder Steuernummer, wird sie erneut geprüft.')),
        ], fondo='detail-section--white'),
        '  <section class="detail-section detail-section--white"><div class="container">'
        + encabezado(('pl.s.pEy', 'Para quien ayuda', 'Für alle, die helfen'), ('trust.title', 'Ayudar no debería exponer a nadie.', 'Helfen sollte niemanden bloßstellen.'))
        + '<div class="benefit-grid">'
        + ''.join('<article class="benefit-card reveal"><span class="benefit-card__number">%02d</span>%s%s</article>'
                  % (n, txt('h3', *a), txt('p', *b)) for n, (a, b) in enumerate(tarj, 1))
        + '<article class="benefit-card reveal"><span class="benefit-card__number">05</span>'
        + txt('h3', 'pl.s.h5t', 'Habilidades acreditadas', 'Nachgewiesene Fähigkeiten')
        + txt('p', 'pl.s.h5b', 'Las habilidades que exigen titulación se acreditan con un documento que revisa el equipo antes de darlas por comprobadas.',
              'Fähigkeiten, die eine Qualifikation erfordern, werden mit einem Dokument belegt, das das Team prüft, bevor sie als bestätigt gelten.')
        + '</article><article class="benefit-card reveal"><span class="benefit-card__number">06</span>'
        + txt('h3', 'pl.s.h6t', 'Constancia del acuerdo', 'Nachweis der Vereinbarung')
        + txt('p', 'trust.ley', 'Al darte de alta como voluntario aceptas el acuerdo de voluntariado, con tus derechos y deberes según la Ley 45/2015, y queda constancia de qué versión aceptaste y cuándo.',
              'Wer sich als Freiwillige:r anmeldet, akzeptiert die Freiwilligenvereinbarung mit den Rechten und Pflichten nach dem spanischen Freiwilligengesetz 45/2015 – mit Nachweis, welche Fassung wann akzeptiert wurde.')
        + '</article></div><p class="pag-enlaces reveal">'
        + '<a class="text-link" href="../privacidad.html" data-i18n="trust.privacy">Política de privacidad →</a> '
        + '<a class="text-link" href="../acuerdo-voluntariado.html" data-i18n="trust.agreement">Acuerdo de voluntariado →</a></p></div></section>',
        llamada(('pl.s.ctaT', 'Da de alta tu entidad.', 'Melde deine Organisation an.'),
                ('pl.s.ctaP', 'Solo te pedimos los datos que necesitamos para comprobar que existe.',
                 'Wir fragen nur die Daten ab, die wir brauchen, um zu prüfen, dass es sie gibt.'), alta),
        mas_plataforma('plataforma/seguridad-y-verificacion.html'),
    ]


def proteccion_civil():
    """Para las agrupaciones de voluntarios de Protección Civil. Se dan de
    alta como administración pública, a través de su ayuntamiento (lo dice
    el alta de entidad, js/cuenta-alta.js), y contratan con la tarifa
    municipal de js/planes.js. Las afirmaciones son las de comunidades/ y de
    las páginas de la plataforma."""
    pre = '../'
    presentar = boton(pre + 'contacto.html?presentacion=proteccion-civil#mensaje', 'pc.presentar',
                      'Solicitar una presentación', 'Präsentation anfragen')
    cents = [b['cents'] for b in seo.tarifas()['municipality']['bandas']]
    minimo, maximo, anual = seo.euros(min(cents)), seo.euros(max(cents)), seo.euros(max(cents) * 12)

    return [
        cabecera_azul(pre, ('pc.eyebrow', 'Gestión de voluntarios de Protección Civil', 'Freiwilligenmanagement für den Zivilschutz'),
                      # Espacio de no separación en «Que llegue»: si no, el título se parte tras «Que».
                      ('pc.hero', 'La ayuda llega. Que llegue con orden.', 'Hilfe, die geordnet ankommt.'),
                      ('pc.lead', 'Para agrupaciones de voluntarios y servicios municipales de Protección Civil: lanzad una operación desde una plantilla, avisad a quien está cerca y comprobad quién ha llegado a cada punto. Refuerza vuestros servicios; no los sustituye.',
                       'Für Freiwilligengruppen und kommunale Zivilschutzdienste: Startet einen Einsatz aus einer Vorlage, benachrichtigt Freiwillige in der Nähe und seht, wer an jedem Ort angekommen ist. Es verstärkt eure Einsatzkräfte, ohne sie zu ersetzen.'),
                      [presentar, boton('#precios', 'pc.precios', 'Ver precios', 'Preise ansehen', False)],
                      clase='detail-hero--pantalla', h1_eyebrow=True,
                      figura='<figure class="detail-hero__pantalla">%s</figure>'
                      % ventana('../imagenes/consola-panel.webp', 'peopleforpeople.es/cuenta', 'panel.alt1')),
        tarjetas(('pc.opEy', 'En la emergencia', 'Im Ernstfall'),
                 ('pc.opT', 'Toda la operación, en un mismo sitio.', 'Der ganze Einsatz an einem Ort.'), [
            (('pc.op1t', 'Siete escenarios preparados', 'Sieben vorbereitete Szenarien'),
             ('pc.op1b', 'Inundación, incendio forestal, evacuación, ola de calor, búsqueda de una persona, punto de reparto y apoyo vecinal, con las tareas, las habilidades y las plazas ya definidas. Ajustáis las cifras y publicáis.',
              'Hochwasser, Waldbrand, Evakuierung, Hitzewelle, Personensuche, Verteilstelle und Nachbarschaftshilfe – mit Aufgaben, Fähigkeiten und Plätzen. Ihr passt die Zahlen an und veröffentlicht.')),
            (('pc.op2t', 'El aviso llega a quien está cerca', 'Die Meldung erreicht, wer in der Nähe ist'),
             ('pc.op2b', 'Cada misión avisa por notificación a los voluntarios que la tienen dentro de su radio. En una urgencia crítica podéis ampliar ese radio para llegar a más gente.',
              'Jeder Einsatz benachrichtigt die Freiwilligen, in deren Umkreis er liegt. Bei kritischer Dringlichkeit könnt ihr den Umkreis erweitern, um mehr Menschen zu erreichen.')),
            (('pc.op3t', 'Plazas por tarea', 'Plätze pro Aufgabe'),
             ('pc.op3b', 'Cada tarea dice cuántas personas necesita: veis en directo qué está cubierto y dónde falta gente.',
              'Jede Aufgabe sagt, wie viele Personen sie braucht: Ihr seht live, was besetzt ist und wo noch Leute fehlen.')),
            (('pc.op4t', 'Quién ha llegado a cada punto', 'Wer an jedem Ort angekommen ist'),
             ('pc.op4b', 'Quien coordina marca en la app la llegada de cada persona. Sabéis con cuánta gente contáis en cada sitio, y las horas se calculan solas.',
              'Die Koordination vermerkt in der App die Ankunft jeder Person. Ihr wisst, mit wie vielen Leuten ihr an jedem Ort rechnen könnt, und die Stunden berechnen sich selbst.')),
            (('pc.op5t', 'Mensajes por operación', 'Nachrichten pro Einsatz'),
             ('pc.op5b', 'Las conversaciones cuelgan de cada misión u operación, no de un grupo abierto donde todo se mezcla.',
              'Gespräche hängen an einem Einsatz, nicht an einer offenen Gruppe, in der alles durcheinandergeht.')),
            (('pc.op6t', 'Con poca cobertura', 'Bei schlechtem Netz'),
             ('pc.op6b', 'La app enseña lo último que guardó y lo actualiza cuando vuelve la conexión: las misiones se consultan sin datos. Publicar o apuntarse sí necesita conexión.',
              'Die App zeigt den zuletzt gespeicherten Stand und aktualisiert ihn, sobald die Verbindung zurück ist: Einsätze lassen sich ohne Daten ansehen. Veröffentlichen oder sich anmelden braucht eine Verbindung.')),
        ], entrada=('pc.opP', 'Sin hojas de cálculo ni grupos de mensajería: quién va, a qué punto y quién ha llegado.',
                    'Ohne Tabellen und Messenger-Gruppen: wer kommt, wohin und wer angekommen ist.'),
           pie=enlaces(enlace('../plataforma/centro-de-coordinacion.html', 'pc.centro', 'Así funciona el centro de coordinación →',
                              'So funktioniert das Koordinationszentrum →'),
                       enlace('../plataforma/app-voluntariado.html', 'pc.app', 'La app que usan los voluntarios →',
                              'Die App für die Freiwilligen →'),
                       enlace('../actualidad/incendios-forestales-voluntarios.html', 'pc.guiaIncendios',
                              'Guía: voluntarios en un incendio forestal →',
                              'Leitfaden: Freiwillige bei einem Waldbrand (auf Spanisch) →'),
                       enlace('../actualidad/ola-de-calor-voluntarios.html', 'pc.guiaCalor',
                              'Guía: voluntarios en una ola de calor →',
                              'Leitfaden: Freiwillige bei einer Hitzewelle (auf Spanisch) →'),
                       enlace('../actualidad/whatsapp-excel-o-plataforma-voluntarios.html', 'pc.comparativa',
                              'WhatsApp, Excel o una plataforma: cuándo conviene cada uno →',
                              'WhatsApp, Excel oder eine Plattform: was wann passt (auf Spanisch) →'))),
        con_imagen(('pc.agEy', 'Vuestra agrupación', 'Eure Gruppe'),
                   ('pc.agT', 'Los papeles de cada voluntario, a la vista.', 'Die Unterlagen jeder Person im Blick.'),
                   ('pc.agP', 'Los miembros de la agrupación piden entrar en vuestra entidad y los aceptáis desde el panel. Ahí veis qué sabe hacer cada uno, cuántas horas lleva y cómo tiene los papeles: el panel avisa de quién tiene el seguro o una acreditación caducada, o a punto de caducar. Las habilidades que exigen titulación, como conducir un camión o manejar maquinaria pesada, se acreditan con un documento que revisa nuestro equipo.',
                    'Die Mitglieder eurer Gruppe beantragen den Beitritt zu eurer Organisation, und ihr nehmt sie im Dashboard auf. Dort seht ihr, was jede Person kann, wie viele Stunden sie geleistet hat und wie ihre Unterlagen stehen: Das Dashboard meldet, wessen Versicherung oder Nachweis abgelaufen ist oder bald abläuft. Fähigkeiten, die eine Qualifikation erfordern – etwa Lkw fahren oder schwere Maschinen bedienen –, werden mit einem Dokument belegt, das unser Team prüft.'),
                   ventana('../imagenes/consola-voluntariado.webp', 'peopleforpeople.es/cuenta/voluntariado', 'panel.alt2', lazy=True)),
        tarjetas(('pc.espEy', 'Voluntariado espontáneo', 'Spontane Hilfe'),
                 ('pc.espT', 'Quien quiere ayudar, con una tarea y un sitio.', 'Wer helfen will, bekommt eine Aufgabe und einen Ort.'), [
            (('pc.esp1t', 'Las misiones, solo de entidades verificadas', 'Einsätze nur von geprüften Organisationen'),
             ('pc.esp1b', 'Comprobamos que la entidad existe y quién la representa antes de abrir el panel. Mientras no está verificada, la base de datos no le deja publicar. Lo que piden los vecinos durante una emergencia declarada sale en el mapa marcado como no verificado.',
              'Wir prüfen, ob es die Organisation gibt und wer sie vertritt, bevor wir das Dashboard freischalten. Solange sie nicht geprüft ist, lässt die Datenbank sie nichts veröffentlichen. Was Anwohner während eines ausgerufenen Notfalls erbitten, erscheint auf der Karte als nicht verifiziert.')),
            (('pc.esp2t', 'Cada uno decide hasta dónde', 'Jede Person entscheidet, wie weit'),
             ('pc.esp2b', 'Cada voluntario elige si recibe avisos de emergencias, de misiones planificadas o de las dos, y hasta qué distancia: 10, 25, 50 o 100 km.',
              'Jede freiwillige Person wählt, ob sie Meldungen zu Notfällen, zu geplanten Einsätzen oder zu beidem bekommt, und bis zu welcher Entfernung: 10, 25, 50 oder 100 km.')),
            (('pc.esp3t', 'Nadie aparece en el mapa', 'Niemand erscheint auf der Karte'),
             ('pc.esp3b', 'La ubicación de los voluntarios solo sirve para calcular distancias: el mapa enseña cuánta gente hay disponible en una zona, nunca quién ni dónde.',
              'Der Standort der Freiwilligen dient nur zur Entfernungsberechnung: Die Karte zeigt, wie viele Menschen in einem Gebiet verfügbar sind, nie wer oder wo.')),
        ], entrada=('pc.espP', 'En una gran emergencia aparece mucha gente dispuesta a ayudar que no pertenece a ninguna agrupación. Con una cuenta en PeopleForPeople, recibe el aviso de lo que publicáis cerca y se apunta a una tarea concreta, en un sitio y a una hora.',
                    'Bei einer großen Notlage wollen viele Menschen helfen, die zu keiner Gruppe gehören. Mit einem Konto bei PeopleForPeople bekommen sie die Meldung zu dem, was ihr in der Nähe veröffentlicht, und melden sich für eine konkrete Aufgabe an – an einem Ort, zu einer Uhrzeit.'),
           pie=enlaces(enlace('../actualidad/voluntarios-espontaneos-emergencias.html', 'pc.guiaEsp',
                              'Guía: cómo organizar a los voluntarios espontáneos →',
                              'Leitfaden: Spontanhelfende im Notfall organisieren (auf Spanisch) →'),
                       enlace('../plataforma/seguridad-y-verificacion.html', 'pc.verif', 'Cómo verificamos a cada entidad →',
                              'Wie wir jede Organisation prüfen →'),
                       enlace('../casos/dana-valencia-2024.html', 'pc.casoDana', 'Voluntariado en la DANA de Valencia →',
                              'Freiwillige bei der DANA in Valencia (auf Spanisch) →'),
                       enlace('../casos/filomena-madrid-2021.html', 'pc.casoFilomena', 'Filomena y los voluntarios 4x4 de Madrid →',
                              'Filomena und die 4x4-Freiwilligen in Madrid (auf Spanisch) →'))),
        pasos(('pl.pasoEy', 'Paso a paso', 'Schritt für Schritt'),
              ('pc.pT', 'Del aviso a la memoria.', 'Von der Meldung bis zum Bericht.'), [
            (('pc.p1t', 'Publicáis', 'Ihr veröffentlicht'),
             ('pc.p1b', 'Desde una plantilla o desde cero: dónde, cuándo, cuántas personas y con qué habilidades.', 'Aus einer Vorlage oder neu: wo, wann, wie viele Personen und mit welchen Fähigkeiten.')),
            (('pc.p2t', 'Se apuntan', 'Sie melden sich an'),
             ('pc.p2b', 'Los voluntarios cercanos reciben el aviso y ocupan las plazas.', 'Freiwillige in der Nähe werden benachrichtigt und besetzen die Plätze.')),
            (('pc.p3t', 'Ficháis las llegadas', 'Ihr erfasst die Ankünfte'),
             ('pc.p3b', 'Quien coordina marca en la app quién ha llegado a cada punto.', 'Die Koordination vermerkt in der App, wer an jedem Ort angekommen ist.')),
            (('pc.p4t', 'Validáis las horas', 'Ihr bestätigt die Stunden'),
             ('pc.p4b', 'Al cerrar, las horas se calculan solas. Las validáis y sale la memoria, en CSV o impresa.', 'Beim Abschluss berechnen sich die Stunden selbst. Ihr bestätigt sie und erhaltet den Bericht als CSV oder gedruckt.')),
        ]),
        tarjetas(('pc.prEy', 'Precios', 'Preise'),
                 ('pc.prT', 'Con la tarifa de vuestro ayuntamiento.', 'Zum Tarif eurer Gemeinde.'), [
            (('pc.pr1t', 'Se da de alta el ayuntamiento', 'Die Gemeinde meldet sich an'),
             ('pc.pr1b', 'Protección Civil entra como administración pública, a través de su ayuntamiento. Comprobamos que existe y quién lo representa antes de abrir el panel.',
              'Der Zivilschutz wird als öffentliche Verwaltung über seine Gemeinde angemeldet. Wir prüfen, ob es sie gibt und wer sie vertritt, bevor wir das Dashboard freischalten.')),
            (('pc.pr2t', 'De %s a %s al mes' % (minimo, maximo), '%s bis %s pro Monat' % (minimo, maximo)),
             ('pc.pr2b', 'Según la población del municipio, sin IVA y sin permanencia. Las dos primeras publicaciones son gratis y no piden tarjeta.',
              'Je nach Einwohnerzahl der Gemeinde, ohne MwSt. und ohne Mindestlaufzeit. Die ersten zwei Veröffentlichungen sind kostenlos und ohne Kreditkarte.')),
            (('pc.pr3t', 'Cabe en un contrato menor', 'Passt in einen Kleinauftrag'),
             ('pc.pr3b', 'Un año de la tarifa más alta son %s sin IVA, por debajo de los 15.000 € del contrato menor de servicios (art. 118 de la Ley 9/2017 de Contratos del Sector Público).' % anual,
              'Ein Jahr im höchsten Tarif kostet %s ohne MwSt. – unter der Grenze von 15.000 €, bis zu der spanische Kommunen Dienstleistungen als Kleinauftrag vergeben können (Art. 118 Ley 9/2017).' % anual)),
        ], fondo='', ident='precios',
           pie=enlaces(enlace('../comunidades/#precios', 'pc.tarifas', 'Las tarifas de ayuntamientos, tramo a tramo →',
                              'Die Tarife für Kommunen im Einzelnen →'),
                       enlace('../descargas/peopleforpeople-ayuntamientos.pdf', 'pc.dossier', 'Dossier para ayuntamientos (PDF) →',
                              'Dossier für Kommunen (PDF, auf Spanisch) →', extra=' download'))),
        llamada(('pc.ctaT', '¿Lo vemos con vuestra agrupación?', 'Schauen wir es uns mit eurer Gruppe an?'),
                ('pc.ctaP', 'En 20 minutos os enseñamos el panel y la app, y resolvemos las dudas de contratación y de datos.',
                 'In 20 Minuten zeigen wir euch das Dashboard und die App und klären Fragen zu Beauftragung und Datenschutz.'),
                '<div class="cta-panel__botones">' + presentar
                + boton(pre + 'cuenta/registro.html?rol=organization', 'pc.alta', 'Dar de alta el ayuntamiento', 'Gemeinde anmelden', False)
                + '</div>'),
    ]


def grafico():
    """El gráfico de la cabecera de la calculadora. Lo dibuja calculadora.js
    con los datos del formulario: horas al año según qué parte de la
    plantilla participe, con el caso de quien lo mira resaltado."""
    return ('<figure class="detail-hero__panel grafico" id="calc-grafico">'
            + txt('p', 'pl.k.gT', 'Horas al año según la participación', 'Stunden pro Jahr nach Beteiligung', clase='grafico__titulo')
            + '<p class="grafico__sub" id="calc-grafico-sub"></p>'
            + '<div class="grafico__cuerpo"><svg id="calc-svg" viewBox="0 0 460 270" role="img" aria-labelledby="calc-grafico-sub"></svg>'
            + '<div class="grafico__globo" id="calc-globo" hidden></div></div>'
            + '<table class="sr-only" id="calc-tabla"></table>'
            + '</figure>')


def calculadora():
    def campo(ident, clave, es, de, valor, minimo, maximo, paso, ayuda):
        k, v = t(clave, es, de)
        ka, va = t(*ayuda)
        return ('<div class="field"><label for="%s" data-i18n="%s">%s</label>'
                '<input id="%s" name="%s" type="number" inputmode="decimal" value="%s" min="%s" max="%s" step="%s" />'
                '<p class="field__hint" data-i18n="%s">%s</p></div>' % (ident, k, v, ident, ident, valor, minimo, maximo, paso, ka, va))

    def cifra(ident, clave, es, de):
        k, v = t(clave, es, de)
        return '<div class="calc__cifra"><strong id="%s">—</strong><span data-i18n="%s">%s</span></div>' % (ident, k, v)

    return [
        cabecera_azul('', ('nav.resources', 'Recursos', 'Ressourcen'),
                      ('pl.k.hero', 'Calculadora de impacto', 'Wirkungsrechner'),
                      ('pl.k.lead', '¿Cuántas personas de tu plantilla podrían hacer voluntariado, cuántas horas sumarían y cuánto vale ese tiempo? Una estimación con supuestos que puedes cambiar.',
                       'Wie viele Menschen aus deinem Team könnten sich engagieren, wie viele Stunden kämen zusammen und was ist diese Zeit wert? Eine Schätzung mit Annahmen, die du ändern kannst.'),
                      [], clase='detail-hero--panel', figura=grafico()),
        '  <section class="detail-section detail-section--white"><div class="container calc">'
        '<form class="calc__datos reveal" id="calc" novalidate>'
        + txt('h2', 'pl.k.datos', 'Tus datos', 'Deine Angaben')
        + campo('calc-plantilla', 'pl.k.plantilla', 'Personas en plantilla', 'Beschäftigte', 120, 1, 1000000, 1,
                ('pl.k.plantillaA', 'Todas las de la empresa.', 'Alle im Unternehmen.'))
        + campo('calc-participacion', 'pl.k.part', 'Participación (%)', 'Beteiligung (%)', 10, 0, 100, 1,
                ('pl.k.partA', 'Supuesto: qué parte de la plantilla participaría. Cámbialo.', 'Annahme: welcher Anteil mitmachen würde. Ändere sie.'))
        + campo('calc-horas', 'pl.k.horas', 'Horas por persona al año', 'Stunden pro Person und Jahr', 8, 0, 2000, 1,
                ('pl.k.horasA', 'Supuesto: una jornada al año. Cámbialo.', 'Annahme: ein Arbeitstag pro Jahr. Ändere sie.'))
        + campo('calc-valor', 'pl.k.valor', 'Coste de una hora de trabajo (€)', 'Kosten einer Arbeitsstunde (€)', '26.51', 0, 1000, '0.01',
                ('pl.k.valorA', 'Coste laboral por hora efectiva en España, 4.º trimestre de 2025 (INE). Pon el de tu empresa si lo sabes.',
                 'Arbeitskosten je tatsächlich geleisteter Stunde in Spanien, 4. Quartal 2025 (INE). Setze den Wert deines Unternehmens ein, wenn du ihn kennst.'))
        + '</form><div class="calc__resultado reveal" aria-live="polite">'
        + txt('h2', 'pl.k.res', 'Al año', 'Pro Jahr')
        + cifra('calc-r-personas', 'pl.k.rPersonas', 'personas voluntarias', 'freiwillige Personen')
        + cifra('calc-r-horas', 'pl.k.rHoras', 'horas de voluntariado', 'Stunden Engagement')
        + cifra('calc-r-valor', 'pl.k.rValor', 'valor del tiempo donado', 'Wert der gespendeten Zeit')
        + '<p class="calc__plan"><span data-i18n="pl.k.plan">Plan de PeopleForPeople para una empresa de ese tamaño:</span> <strong id="calc-r-plan">—</strong></p>'
        + txt('p', 'pl.k.aviso', 'Es una estimación, no una promesa: depende de cuánta gente participe de verdad. Con PeopleForPeople esas horas quedan fichadas, validadas y listas para tu memoria de RSC o ESG.',
              'Das ist eine Schätzung, kein Versprechen: Sie hängt davon ab, wie viele wirklich mitmachen. Mit PeopleForPeople werden diese Stunden erfasst, bestätigt und sind bereit für deinen CSR- oder ESG-Bericht.', clase='calc__aviso')
        + boton('contacto.html#mensaje', 'pl.k.cta', 'Hablar con nosotros', 'Mit uns sprechen')
        + '</div></div></section>',
        '  <section class="detail-section"><div class="container calc-metodo">'
        + encabezado(('pl.k.mEy', 'Cómo se calcula', 'Wie gerechnet wird'), ('pl.k.mT', 'Sin cajas negras.', 'Ohne Blackbox.'))
        + '<ol class="calc-metodo__lista">'
        + txt('li', 'pl.k.m1', 'Personas voluntarias = plantilla × participación.', 'Freiwillige = Beschäftigte × Beteiligung.')
        + txt('li', 'pl.k.m2', 'Horas al año = personas voluntarias × horas por persona.', 'Stunden pro Jahr = Freiwillige × Stunden pro Person.')
        + txt('li', 'pl.k.m3', 'Valor del tiempo = horas × coste de una hora de trabajo. Es lo que cuesta a la empresa el tiempo que dona si el voluntariado se hace en horario laboral.',
              'Wert der Zeit = Stunden × Kosten einer Arbeitsstunde. So viel kostet das Unternehmen die gespendete Zeit, wenn das Engagement in der Arbeitszeit stattfindet.')
        + txt('li', 'pl.k.m4', 'El plan sale de nuestras tarifas para empresas, según el número de personas en plantilla. Precios sin IVA.',
              'Der Tarif ergibt sich aus unseren Preisen für Unternehmen nach Zahl der Beschäftigten. Preise ohne MwSt.')
        + '</ol>'
        + txt('p', 'pl.k.social', 'Lo que no ponemos en euros, a propósito: a quién llega esa ayuda. Eso lo cuentan las misiones, no una fórmula.',
              'Was wir bewusst nicht in Euro umrechnen: wen diese Hilfe erreicht. Das erzählen die Einsätze, nicht eine Formel.', clase='calc-metodo__nota')
        + '<p class="calc-metodo__fuente"><span data-i18n="pl.k.fuente">Fuente del coste por hora:</span> '
        '<a href="https://www.ine.es/dyngs/Prensa/ETCL4T25.htm" target="_blank" rel="noopener noreferrer">INE, Encuesta Trimestral de Coste Laboral, 4.º trimestre de 2025</a> '
        '<span data-i18n="pl.k.fuenteFecha">(publicada el 17 de marzo de 2026).</span></p>'
        + '</div></section>',
    ]


FAQ = [
    ('quien-ayuda', 'Para quien ayuda', [
        ('¿Cuánto cuesta usar la app?',
         'Nada. Para los voluntarios es gratuita y siempre lo será. Quien paga es la entidad que coordina.'),
        ('¿Tengo que estar disponible siempre?',
         'No. En tu perfil dices cuándo puedes y hasta dónde te desplazarías, y solo te avisamos de lo que encaja. Puedes cambiarlo cuando quieras desde Ajustes.'),
        ('¿Qué pasa si me apunto y luego no puedo ir?',
         'Te retiras desde la misión y quien coordina lo ve al momento. Es mejor saber que no vienes que contar contigo y descubrirlo sobre el terreno. No pasa nada por hacerlo.'),
        ('¿Cómo se acreditan mis horas?',
         'Quien coordina la operación marca en la app que has llegado. A partir de ese momento empieza a contar tu tiempo, y al cerrar la operación se calculan tus horas solas: no tienes que apuntar nada. Sin esa confirmación de llegada no hay horas, porque unas horas sin comprobar no acreditan voluntariado.'),
        ('¿Para qué me sirven las horas acreditadas?',
         'Son la base del carnet de voluntario: un registro comprobable de lo que has hecho, que las entidades pueden certificar y que aspira a dar acceso a ventajas culturales, de transporte y académicas.'),
        ('¿Se publica mi dirección o mi teléfono?',
         'No. Tu domicilio nunca aparece en el mapa: los voluntarios no se pintan uno a uno, solo se muestra cuánta gente hay disponible en una zona. Tu teléfono solo se comparte con quien coordina una misión que has aceptado.'),
        ('¿Puedo escribir a cualquiera?',
         'No, y es a propósito. Las conversaciones cuelgan siempre de una misión, de una petición de ayuda o de un canal de tu organización. Si quieres hablar con alguien con quien no compartes ninguna de esas cosas, se le envía una solicitud de contacto y decide si acepta.'),
    ]),
    ('necesita-ayuda', 'Para quien necesita ayuda', [
        ('¿Cuándo puedo pedir ayuda?',
         'Cuando hay una emergencia declarada en la provincia de tu perfil, por ejemplo por una DANA o un incendio. Entonces aparece en la app la pestaña «Pedir ayuda»: describes lo que necesitas, marcas el sitio y eliges la urgencia. Fuera de una emergencia solo publican las entidades verificadas, y la ayuda llega a través de sus misiones.'),
        ('¿Quién ve mi petición?',
         'Los voluntarios de tu zona, que la ven en el mapa marcada como no verificada y con una ubicación aproximada, de un kilómetro. Tu dirección exacta solo la recibe la persona que aceptas, y habláis por el chat de la app: tu teléfono no se comparte.'),
        ('¿Y si nadie responde?',
         'Puedes cerrarla indicando que no llegó ayuda. Nos sirve para saber dónde falta gente, que es justo lo que la plataforma existe para arreglar.'),
    ]),
    ('entidades', 'Para ONG, ayuntamientos y empresas', [
        ('¿Qué tengo que hacer para empezar?',
         'Darte de alta como entidad, desde la app o desde la <a href="cuenta/registro.html?rol=organization">web</a>. Comprobamos que la organización existe y que quien la representa eres tú antes de abrirte el panel de coordinación: publicar moviliza a gente que se va a presentar en un sitio, así que no se abre sin más.'),
        ('¿Cuánto tarda la verificación?',
         'Suele ser cuestión de días laborables. Mientras tanto puedes seguir usando la app como voluntario con normalidad.'),
        ('¿Cuánto cuesta?',
         'Una cuota mensual según el tamaño de la entidad, sin permanencia: las ONG, de 19 a 99 € al mes según sus voluntarios activos; los ayuntamientos, de 49 a 199 € según su población, y las empresas, de 19 a 99 € según su plantilla. El tramo lo confirma nuestro equipo al verificar la entidad. Los detalles, en las páginas de <a href="ongs/#precios">ONG</a>, <a href="comunidades/#precios">ayuntamientos</a> y <a href="empresas/#precios">empresas</a>.'),
        ('¿Cuándo se paga?',
         'Las dos primeras misiones que publiques son gratis y no piden tarjeta; la suscripción empieza solo si decides publicar una tercera. Darte de alta, montar tu equipo y ver el panel no cuesta nada.'),
        ('¿Qué es una operación?',
         'El paraguas que agrupa las tareas de una misma emergencia o proyecto. Eliges un escenario preparado —inundación, incendio, evacuación, ola de calor, búsqueda, punto de reparto, apoyo vecinal— y se publican sus tareas ya dimensionadas. Cada tarea sale como una misión independiente a la que se apuntan los voluntarios.'),
        ('¿Puedo justificar subvenciones con esto?',
         'Para eso está el parte de horas: horas confirmadas por voluntario y por periodo, exportable. Más en <a href="plataforma/informes-y-certificados.html">Informes y certificados</a>.'),
    ]),
    ('cuenta', 'Cuenta y datos', [
        ('¿Puedo borrar mi cuenta?',
         'Sí, desde Ajustes. Se borran tu nombre, correo, teléfono, ubicación y documentos. Las horas que tengas acreditadas se conservan de forma anónima, porque forman parte de la justificación de subvenciones ya concedidas a las entidades con las que colaboraste.'),
        ('¿Funciona sin cobertura?',
         'En parte. La app enseña lo último que guardó y lo actualiza cuando vuelve la conexión, así que puedes consultar tus misiones aunque estés sin datos. Publicar o apuntarte sí necesita conexión.'),
        ('¿En qué idiomas está?',
         'Español, alemán e inglés. El idioma por defecto es siempre el español; los otros dos se cambian desde Ajustes.'),
    ]),
]


def ayuda():
    """Preguntas frecuentes: un índice de temas y, en cada tema, una lista
    de preguntas que se despliegan al pulsarlas (<details>, sin JavaScript).
    El contenido está solo en español; en alemán se avisa."""
    indice = ''.join('<a href="#%s">%s<span>%d</span></a>' % (ident, titulo, len(preguntas))
                     for ident, titulo, preguntas in FAQ)
    grupos = ''.join(
        '<section class="faq__grupo" id="%s"><h2>%s</h2><div class="faq__lista">%s</div></section>'
        % (ident, titulo, ''.join(
            '<details class="faq__item"><summary><span class="faq__num">%02d</span><span class="faq__q">%s</span>'
            '<span class="faq__signo" aria-hidden="true"></span></summary><div class="faq__a"><p>%s</p></div></details>'
            % (n, q, a) for n, (q, a) in enumerate(preguntas, 1)))
        for ident, titulo, preguntas in FAQ)
    return [
        cabecera_azul('', ('nav.support', 'Centro de soporte', 'Hilfe-Center'),
                      ('faq.title', 'Preguntas frecuentes', 'Häufige Fragen'),
                      ('faq.lead', 'Lo que más nos preguntáis, ordenado por temas. Pulsa una pregunta para ver la respuesta.',
                       'Die häufigsten Fragen, nach Themen sortiert. Tippe auf eine Frage, um die Antwort zu sehen.'),
                      [], clase='detail-hero--arte', figura=cristal('')).replace('<div class="detail-hero__actions"></div>', '<p class="pag-idioma" data-i18n="cases.soloEs"></p>', 1),
        '  <section class="detail-section detail-section--white"><div class="container faq">'
        '<nav class="faq__indice" aria-label="Temas">' + indice + '</nav>'
        '<div class="faq__grupos">' + grupos + '</div></div></section>',
        llamada(('faq.ctaT', '¿No está tu pregunta?', 'Deine Frage ist nicht dabei?'),
                ('faq.ctaP', 'Escríbenos desde Perfil → Soporte en la app o desde el formulario de contacto. Respondemos en un par de días laborables.',
                 'Schreib uns in der App unter Profil → Support oder über das Kontaktformular. Wir antworten innerhalb von zwei Werktagen.'),
                boton('contacto.html#mensaje', 'faq.cta', 'Escribirnos', 'Uns schreiben')),
    ]


def no_encontrada():
    """404.html, la página de «no existe». Los destinos son los del menú, con
    sus mismas claves y textos (cabecera.py)."""
    menu = {k: (v, d) for k, v, d, _ in cabecera.MENU}
    for *_, sub in cabecera.MENU:
        menu.update({k: (v, d) for k, v, d in sub})
    destinos = ''.join('<a class="pag-otra" href="%s" data-i18n="%s">%s</a>' % (menu[k][1], k, menu[k][0])
                       for k in ('nav.whoVol', 'nav.whoNgo', 'nav.whoMuni', 'nav.whoPc', 'nav.whoCorp',
                                 'nav.cases', 'nav.support', 'nav.contact'))
    return [
        cabecera_azul('', ('nf.eyebrow', 'Error 404', 'Fehler 404'),
                      ('nf.title', 'No encontramos esta página.', 'Diese Seite gibt es hier nicht.'),
                      ('nf.lead', 'Puede que el enlace esté mal escrito o que la página haya cambiado de dirección.',
                       'Vielleicht ist der Link falsch geschrieben, oder die Seite hat eine neue Adresse.'),
                      [boton('./', 'nf.inicio', 'Ir a la portada', 'Zur Startseite')]),
        '  <section class="detail-section detail-section--white"><div class="container pag-otras">'
        + txt('span', 'nf.mas', 'O ve directamente a', 'Oder direkt zu', clase='eyebrow')
        + '<div class="pag-otras__lista">' + destinos + '</div></div></section>',
    ]


# Lo que cada página carga de más
PAGINAS_DEF = [
    ('ayuda.html', ayuda, []),
    ('plataforma/centro-de-coordinacion.html', centro, []),
    ('plataforma/app-voluntariado.html', app, []),
    ('plataforma/informes-y-certificados.html', informes, []),
    ('plataforma/seguridad-y-verificacion.html', seguridad, []),
    ('proteccion-civil/index.html', proteccion_civil, []),
    ('calculadora.html', calculadora, ['js/planes.js', 'js/calculadora.js']),
]

# Textos que no salen de ningún bloque
t('pl.i.docSrc', '../imagenes/certificado-ejemplo-es.webp', '../imagenes/certificado-ejemplo-de.webp')
t('pl.k.fuente', 'Fuente del coste por hora:', 'Quelle der Stundenkosten:')
t('pl.k.fuenteFecha', '(publicada el 17 de marzo de 2026).', '(veröffentlicht am 17. März 2026).')
t('pl.k.plan', 'Plan de PeopleForPeople para una empresa de ese tamaño:', 'PeopleForPeople-Tarif für ein Unternehmen dieser Größe:')
t('pl.k.mes', '{n} € al mes', '{n} € pro Monat')
t('pl.k.gColH', 'Horas al año', 'Stunden pro Jahr')
t('pl.k.gColP', 'Participación', 'Beteiligung')
t('pl.k.gTip', '{pct} % de la plantilla · {horas} h · {valor}', '{pct} % der Belegschaft · {horas} Std. · {valor}')
t('pl.k.gTu', 'tu caso', 'dein Fall')
t('pl.k.gS', 'Con {p} personas en plantilla y {h} h por persona.', 'Bei {p} Beschäftigten und {h} Std. pro Person.')

# `./` (la portada vista desde la raíz) se cambia por `../`, no se le antepone.
ATRIBUTO_RELATIVO = re.compile(r'((?:href|src)=")(?!https?:|mailto:|#|/|\.\./|data:)(?:\./)?([^"]*")')


def plantilla(archivo):
    texto = seo.leer('documentos.html')
    cab = texto[:texto.index('<main id="main">') + len('<main id="main">')]
    pie = texto[texto.index('</main>'):]
    sub = os.path.dirname(archivo)
    if sub:
        cab = ATRIBUTO_RELATIVO.sub(r'\1../\2', cab)
        pie = ATRIBUTO_RELATIVO.sub(r'\1../\2', pie)
    pre = '../' if sub else ''
    cab = cab.replace('</head>', '<link rel="stylesheet" href="%scss/paginas.css" />\n</head>' % pre, 1)
    return cab, pie, pre


def construir():
    salida = {}
    tabla = {p[0]: p for p in seo.PAGINAS}
    catalogo = seo.tarifas()
    for archivo, fn, extras in PAGINAS_DEF:
        cab, pie, pre = plantilla(archivo)
        cuerpo = '\n'.join(fn())
        guiones = ''.join('<script src="%s%s"></script>' % (pre, g) for g in extras)
        pie = pie.replace('<script src="%sjs/detail-i18n.js"></script>' % pre,
                          '<script src="%sjs/detail-i18n.js"></script><script src="%sjs/paginas-i18n.js"></script>%s' % (pre, pre, guiones), 1)
        assert 'paginas-i18n.js' in pie, archivo
        texto = cab + '\n' + cuerpo + '\n' + pie
        _, ruta, titulo, descripcion, miga, producto = tabla[archivo]
        salida[archivo] = seo.aplicar_texto(texto, archivo, ruta, titulo, descripcion, miga, producto, catalogo)
    # La 404. GitHub Pages la sirve en cualquier dirección que no exista, a
    # cualquier profundidad (/plataforma/lo-que-sea): por eso todo va desde la
    # raíz (/css/…) y no relativo. No es una página que buscar: `noindex`, sin
    # canonical ni datos estructurados, y fuera del sitemap (no está en
    # seo.PAGINAS). cabecera.py no la toca: sus menús salen de aquí.
    cab, pie, _ = plantilla('404.html')
    pie = pie.replace('<script src="js/detail-i18n.js"></script>',
                      '<script src="js/detail-i18n.js"></script><script src="js/paginas-i18n.js"></script>', 1)
    assert 'paginas-i18n.js' in pie
    texto = cab + '\n' + '\n'.join(no_encontrada()) + '\n' + pie
    texto = re.sub(r'<title>[^<]*</title>', '<title>Página no encontrada | %s</title>' % seo.MARCA, texto, count=1)
    texto = re.sub(r'<meta name="description" content="[^"]*" />', '<meta name="robots" content="noindex" />', texto, count=1)
    texto = seo.VIEJOS_JSONLD.sub('', seo.VIEJO_BLOQUE.sub('', texto))
    assert 'noindex' in texto and 'canonical' not in texto
    salida['404.html'] = ATRIBUTO_RELATIVO.sub(r'\1/\2', texto)
    # Las claves que ya están en otros diccionarios no se repiten aquí.
    with open(os.path.join(RAIZ, 'js', 'i18n.js'), encoding='utf-8') as fh:
        existentes = fh.read()
    with open(os.path.join(RAIZ, 'js', 'home-i18n.js'), encoding='utf-8') as fh:
        existentes += fh.read()
    propias = [k for k in ES if "'%s':" % k not in existentes]
    js = ['/* GENERADO por _herramientas/paginas.py: los textos de las páginas de',
          '   «La plataforma», de Protección Civil y de la calculadora. No se edita',
          '   a mano. */',
          '(function () {', "  'use strict';"]
    for lang, d in (('es', ES), ('de', DE)):
        js.append('  Object.assign(window.I18N.%s, {' % lang)
        js += ['    %s: %s,' % (json.dumps(k), json.dumps(d[k], ensure_ascii=False)) for k in propias]
        js.append('  });')
    js.append('})();')
    salida['js/paginas-i18n.js'] = '\n'.join(js) + '\n'
    return salida


def main():
    solo_comprobar = '--check' in sys.argv
    desfasadas = []
    for archivo, texto in construir().items():
        ruta = os.path.join(RAIZ, archivo)
        actual = None
        if os.path.exists(ruta):
            with open(ruta, encoding='utf-8') as fh:
                actual = fh.read()
        if actual != texto:
            desfasadas.append(archivo)
            if not solo_comprobar:
                os.makedirs(os.path.dirname(ruta), exist_ok=True)
                with open(ruta, 'w', encoding='utf-8', newline='\n') as fh:
                    fh.write(texto)
    if solo_comprobar:
        print('Desfasadas:', ', '.join(desfasadas) if desfasadas else 'ninguna')
        sys.exit(1 if desfasadas else 0)
    print('Escritas:', ', '.join(desfasadas) if desfasadas else 'nada que cambiar')


if __name__ == '__main__':
    main()
