"""
Las páginas de «La plataforma» y la calculadora de impacto.

Cada página se describe aquí como una lista de bloques, con sus textos en
español y en alemán. El script escribe

    plataforma/centro-de-coordinacion.html
    plataforma/app-voluntariado.html
    plataforma/informes-y-certificados.html
    plataforma/seguridad-y-verificacion.html
    calculadora.html
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

def cabecera_azul(pre, eyebrow, titulo, entrada, botones):
    return ('  <section class="detail-hero"><div class="container reveal">'
            '<a class="breadcrumb" href="%sindex.html">← PeopleForPeople</a>' % pre
            + txt('span', *eyebrow, clase='eyebrow') + txt('h1', *titulo)
            + txt('p', *entrada, clase='detail-hero__lead')
            + '<div class="detail-hero__actions">' + ''.join(botones) + '</div></div></section>')


def boton(href, clave, es, de, primario=True):
    k, v = t(clave, es, de)
    return '<a class="btn %s" href="%s" data-i18n="%s">%s</a>' % ('btn--primary' if primario else 'btn--ghost', href, k, v)


def encabezado(eyebrow, titulo, entrada=None):
    h = '<div class="detail-heading reveal">' + txt('span', *eyebrow, clase='eyebrow') + txt('h2', *titulo)
    if entrada:
        h += txt('p', *entrada)
    return h + '</div>'


def tarjetas(eyebrow, titulo, items, fondo='detail-section--white', entrada=None):
    cuerpo = ''.join(
        '<article class="benefit-card reveal"><span class="benefit-card__number">%02d</span>%s%s</article>'
        % (n, txt('h3', *it[0]), txt('p', *it[1])) for n, it in enumerate(items, 1))
    return ('  <section class="detail-section %s"><div class="container">%s<div class="benefit-grid">%s</div></div></section>'
            % (fondo, encabezado(eyebrow, titulo, entrada), cuerpo))


def pasos(eyebrow, titulo, items):
    cuerpo = ''.join('<article class="step reveal">%s%s</article>' % (txt('h3', *a), txt('p', *b)) for a, b in items)
    return ('  <section class="detail-section detail-section--navy"><div class="container">%s<div class="steps">%s</div></div></section>'
            % (encabezado(eyebrow, titulo), cuerpo))


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
                      [alta, boton(pre + 'contacto.html?role=ong', 'pl.hablar', 'Hablar con nosotros', 'Mit uns sprechen', False)]),
        con_imagen(('pl.c.panelEy', 'El panel web', 'Das Web-Dashboard'),
                   ('pl.c.panelT', 'Abre por lo que hay que resolver hoy.', 'Es beginnt mit dem, was heute erledigt werden muss.'),
                   ('pl.c.panelP', 'Se usa en el navegador, sin instalar nada. Al entrar no ves gráficas: ves las altas que esperan respuesta, las horas por validar y las misiones a medio cubrir. Si hay una emergencia activa, aparece arriba del todo.',
                    'Es läuft im Browser, ohne Installation. Beim Öffnen siehst du keine Diagramme, sondern offene Registrierungen, zu bestätigende Stunden und halb besetzte Einsätze. Läuft gerade ein Notfall, steht er ganz oben.'),
                   '<div class="navegador"><div class="navegador__barra" aria-hidden="true"><span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__url">peopleforpeople.es/cuenta</span></div>'
                   '<img src="../imagenes/consola-panel.webp" width="1600" height="1000" loading="lazy" alt="" data-i18n-alt="panel.alt1" /></div>',
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
    ]


def app():
    pre = '../'
    cuenta = boton(pre + 'cuenta/registro.html?rol=volunteer', 'pl.crear', 'Crear mi cuenta', 'Konto erstellen')
    moviles = ''.join('<img src="../imagenes/app/movil-%s.webp" width="740" height="1530" loading="lazy" alt="" data-i18n-alt="%s" />' % (n, a)
                      for n, a in (('bienvenida', 'app.shot1'), ('misiones', 'app.shot2'), ('organizaciones', 'app.shot3')))
    return [
        cabecera_azul(pre, ('pl.eyebrow', 'La plataforma', 'Die Plattform'),
                      ('pl.a.hero', 'App de voluntariado', 'Freiwilligen-App'),
                      ('pl.a.lead', 'Para quien quiere ayudar: las misiones de cerca, un aviso cuando de verdad hace falta y tus horas siempre a mano.',
                       'Für alle, die helfen wollen: Einsätze in der Nähe, eine Meldung, wenn es wirklich nötig ist, und deine Stunden immer griffbereit.'),
                      [cuenta]),
        con_imagen(('pl.a.verEy', 'Así se ve', 'So sieht sie aus'),
                   ('pl.a.verT', 'Clara, directa y sin pasos de más.', 'Klar, direkt und ohne überflüssige Schritte.'),
                   ('pl.a.verP', 'Una misión se entiende de un vistazo: qué hace falta, dónde, cuándo y en qué punto está. Las pantallas son de la app real.',
                    'Ein Einsatz ist auf einen Blick verständlich: was gebraucht wird, wo, wann und wie weit er ist. Die Bildschirme stammen aus der echten App.'),
                   '<div class="pag-moviles">' + moviles + '</div>', 'detail-section--white'),
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
            (('pl.a.q5t', 'Pedir ayuda a tus vecinos', 'Nachbarn um Hilfe bitten'),
             ('pl.a.q5b', 'Si eres tú quien necesita algo, lo pides en un minuto y eliges la urgencia. Tu dirección exacta solo la recibe la persona que aceptas.',
              'Brauchst du selbst etwas, bittest du in einer Minute darum und wählst die Dringlichkeit. Deine genaue Adresse bekommt nur die Person, die du annimmst.')),
            (('pl.a.q6t', 'Tus horas, siempre a mano', 'Deine Stunden immer griffbereit'),
             ('pl.a.q6b', 'Las horas validadas forman tu historial, que puedes imprimir. Son la base del certificado de voluntariado que emite la entidad.',
              'Die bestätigten Stunden bilden deinen Verlauf, den du ausdrucken kannst. Sie sind die Grundlage für die Freiwilligenbescheinigung der Organisation.')),
        ], fondo=''),
        llamada(('pl.a.ctaT', 'Empieza a ayudar cerca de ti.', 'Fang an, in deiner Nähe zu helfen.'),
                ('app.storeAccount', 'Mientras llega a las tiendas, crea tu cuenta en la web: es la misma con la que entrarás en la app.',
                 'Bis sie in den Stores ist, erstelle dein Konto im Web: Es ist dasselbe, mit dem du dich in der App anmeldest.'), cuenta),
    ]


def informes():
    pre = '../'
    return [
        cabecera_azul(pre, ('pl.eyebrow', 'La plataforma', 'Die Plattform'),
                      ('pl.i.hero', 'Informes y certificados', 'Berichte und Bescheinigungen'),
                      ('pl.i.lead', 'Cada hora se ficha sobre el terreno y la valida la entidad. De ahí salen la memoria de actividad, los datos para tu informe de RSC o ESG y la base del certificado de cada voluntario.',
                       'Jede Stunde wird vor Ort erfasst und von der Organisation bestätigt. Daraus entstehen der Tätigkeitsbericht, die Daten für deinen CSR- oder ESG-Bericht und die Grundlage für die Bescheinigung jeder freiwilligen Person.'),
                      [boton(pre + 'cuenta/registro.html?rol=organization', 'pl.altaOrg', 'Dar de alta mi organización', 'Organisation registrieren'),
                       boton(pre + 'calculadora.html', 'pl.i.calc', 'Probar la calculadora', 'Rechner ausprobieren', False)]),
        con_imagen(('pl.i.vEy', 'Validar', 'Bestätigen'),
                   ('pl.i.vT', 'Ninguna hora cuenta sin que alguien la mire.', 'Keine Stunde zählt, ohne dass jemand sie geprüft hat.'),
                   ('pl.i.vP', 'Las horas llegan de la app con el fichaje de cada persona. Se validan una a una o en tanda; si alguien las ajusta, tiene que decir por qué, y la persona voluntaria lo lee en su historial.',
                    'Die Stunden kommen mit der Erfassung jeder Person aus der App. Sie werden einzeln oder gesammelt bestätigt; wer sie korrigiert, muss einen Grund angeben, und die freiwillige Person liest ihn in ihrem Verlauf.'),
                   '<div class="navegador"><div class="navegador__barra" aria-hidden="true"><span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__punto"></span><span class="navegador__url">peopleforpeople.es/cuenta/horas</span></div>'
                   '<img src="../imagenes/consola-horas.webp" width="1600" height="1000" loading="lazy" alt="" data-i18n-alt="panel.alt3" /></div>',
                   'detail-section--white'),
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
        ], fondo=''),
        con_imagen(('pl.i.cEy', 'Certificado', 'Bescheinigung'),
                   ('pl.i.cT', 'Así puede quedar el certificado de un voluntario.', 'So kann die Bescheinigung einer freiwilligen Person aussehen.'),
                   ('pl.i.cP', 'Un ejemplo con datos ficticios. Cada entidad lo emite y lo sella con las horas que ha validado.',
                    'Ein Beispiel mit erfundenen Daten. Jede Organisation stellt sie mit den von ihr bestätigten Stunden aus und stempelt sie.'),
                   '<img class="pag-papel" src="../imagenes/certificado-ejemplo-es.webp" data-i18n-src="pl.i.docSrc" width="765" height="1024" loading="lazy" alt="" data-i18n-alt="hours.docAlt" />',
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
    ]


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
                      [alta]),
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
        ]),
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
        + txt('p', 'trust.ley', 'Al darte de alta como voluntario aceptas el acuerdo de incorporación de la Ley 45/2015, y queda constancia de qué versión aceptaste y cuándo.',
              'Bei der Anmeldung als Freiwillige:r akzeptierst du die Vereinbarung nach dem Gesetz 45/2015, und es wird festgehalten, welche Version du wann akzeptiert hast.')
        + '</article></div><p class="pag-enlaces reveal">'
        + '<a class="text-link" href="../privacidad.html" data-i18n="trust.privacy">Política de privacidad →</a> '
        + '<a class="text-link" href="../acuerdo-voluntariado.html" data-i18n="trust.agreement">Acuerdo de voluntariado →</a></p></div></section>',
        llamada(('pl.s.ctaT', 'Da de alta tu entidad.', 'Melde deine Organisation an.'),
                ('pl.s.ctaP', 'Solo te pedimos los datos que necesitamos para comprobar que existe.',
                 'Wir fragen nur die Daten ab, die wir brauchen, um zu prüfen, dass es sie gibt.'), alta),
    ]


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
                      []),
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
        + boton('contacto.html?role=empresa', 'pl.k.cta', 'Hablar con nosotros', 'Mit uns sprechen')
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
        ('¿Puedo pedir ayuda aunque no sea una emergencia?',
         'Sí. La app cubre desde una inundación hasta acompañar a un mayor o subir la compra. Al publicar eliges el grado de urgencia.'),
        ('¿Quién ve mi petición?',
         'Los voluntarios de tu zona. Tu teléfono no se publica: solo se comparte con la persona concreta a la que aceptes.'),
        ('¿Y si nadie responde?',
         'Puedes cerrarla indicando que no llegó ayuda. Nos sirve para saber dónde falta gente, que es justo lo que la plataforma existe para arreglar.'),
    ]),
    ('entidades', 'Para ONG, ayuntamientos y empresas', [
        ('¿Qué tengo que hacer para empezar?',
         'Darte de alta como entidad, desde la app o desde la <a href="cuenta/registro.html?rol=organization">web</a>. Comprobamos que la organización existe y que quien la representa eres tú antes de abrirte el panel de coordinación: publicar moviliza a gente que se va a presentar en un sitio, así que no se abre sin más.'),
        ('¿Cuánto tarda la verificación?',
         'Suele ser cuestión de días laborables. Mientras tanto puedes seguir usando la app como voluntario con normalidad.'),
        ('¿Cuánto cuesta?',
         'Una cuota mensual según el tamaño de la entidad, sin permanencia: las ONG, de 19 a 99 € al mes según sus voluntarios activos; los ayuntamientos, de 49 a 199 € según su población, y las empresas, de 19 a 99 € según su plantilla. El tramo lo confirma nuestro equipo al verificar la entidad. Los detalles, en las páginas de <a href="ongs/index.html#precios">ONG</a>, <a href="comunidades/index.html#precios">ayuntamientos</a> y <a href="empresas/index.html#precios">empresas</a>.'),
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
                      []).replace('<div class="detail-hero__actions"></div>', '<p class="pag-idioma" data-i18n="cases.soloEs"></p>', 1),
        '  <section class="detail-section detail-section--white"><div class="container faq">'
        '<nav class="faq__indice" aria-label="Temas">' + indice + '</nav>'
        '<div class="faq__grupos">' + grupos + '</div></div></section>',
        llamada(('faq.ctaT', '¿No está tu pregunta?', 'Deine Frage ist nicht dabei?'),
                ('faq.ctaP', 'Escríbenos desde Perfil → Soporte en la app o desde el formulario de contacto. Respondemos en un par de días laborables.',
                 'Schreib uns in der App unter Profil → Support oder über das Kontaktformular. Wir antworten innerhalb von zwei Werktagen.'),
                boton('contacto.html?role=voluntario', 'faq.cta', 'Escribirnos', 'Uns schreiben')),
    ]


# Lo que cada página carga de más
PAGINAS_DEF = [
    ('ayuda.html', ayuda, []),
    ('plataforma/centro-de-coordinacion.html', centro, []),
    ('plataforma/app-voluntariado.html', app, []),
    ('plataforma/informes-y-certificados.html', informes, []),
    ('plataforma/seguridad-y-verificacion.html', seguridad, []),
    ('calculadora.html', calculadora, ['js/planes.js', 'js/calculadora.js']),
]

# Textos que no salen de ningún bloque
t('pl.i.docSrc', '../imagenes/certificado-ejemplo-es.webp', '../imagenes/certificado-ejemplo-de.webp')
t('pl.k.fuente', 'Fuente del coste por hora:', 'Quelle der Stundenkosten:')
t('pl.k.fuenteFecha', '(publicada el 17 de marzo de 2026).', '(veröffentlicht am 17. März 2026).')
t('pl.k.plan', 'Plan de PeopleForPeople para una empresa de ese tamaño:', 'PeopleForPeople-Tarif für ein Unternehmen dieser Größe:')
t('pl.k.mes', '{n} € al mes', '{n} € pro Monat')

ATRIBUTO_RELATIVO = re.compile(r'((?:href|src)=")(?!https?:|mailto:|#|/|\.\./|data:)([^"]*")')


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
    # Las claves que ya están en otros diccionarios no se repiten aquí.
    with open(os.path.join(RAIZ, 'js', 'i18n.js'), encoding='utf-8') as fh:
        existentes = fh.read()
    with open(os.path.join(RAIZ, 'js', 'home-i18n.js'), encoding='utf-8') as fh:
        existentes += fh.read()
    propias = [k for k in ES if "'%s':" % k not in existentes]
    js = ['/* GENERADO por _herramientas/paginas.py: los textos de las páginas de',
          '   «La plataforma» y de la calculadora. No se edita a mano. */',
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
