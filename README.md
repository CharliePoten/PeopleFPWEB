# PeopleFP

Web de PeopleForPeople: https://peopleforpeople.es (GitHub Pages, rama `main`).
HTML, CSS y JavaScript sin compilar: lo que hay en el repositorio es lo que se
publica.

## SEO de las páginas públicas

Título, descripción, canonical, Open Graph, tarjeta de Twitter, datos
estructurados (JSON-LD) y `sitemap.xml` salen de una sola tabla en
`_herramientas/seo.py`. En cada página van entre las marcas
`<!-- seo:inicio -->` y `<!-- seo:fin -->`, y eso no se edita a mano.

```
python _herramientas/seo.py           # escribe páginas y sitemap
python _herramientas/seo.py --check   # avisa si algo está desfasado
```

- **Cambiar un título o una descripción:** en la tabla `PAGINAS`, y ejecutar.
  El script avisa si el título pasa de 60 caracteres o la descripción no está
  entre 120 y 160.
- **Añadir una página pública:** una entrada más en `PAGINAS`, y ejecutar.
  Entra sola en el sitemap con la fecha de su último commit.
- **Precios:** los del JSON-LD salen de `js/planes.js`, que se genera desde la
  app. Si cambian allí, basta con volver a ejecutar.
- Las páginas de `/cuenta/` no van: llevan `noindex`.

`_herramientas/` empieza por guion bajo para que GitHub Pages no la publique.

## Dossier para ayuntamientos

`descargas/peopleforpeople-ayuntamientos.pdf` (una página A4, se descarga
desde `comunidades/`) sale de `_herramientas/dossier/ayuntamientos.html` con
los precios de `js/planes.js`. Si cambian los precios o el texto:

```
python _herramientas/dossier.py
```

Necesita Playwright con Chromium. Si cambia la tarifa más alta de
ayuntamientos, cambiar también a mano los 2.388 € (12 meses) de
`comunidades/` y de `mun.hire1b` en `js/detail-i18n.js`.

## Analítica

Google Analytics 4 (`G-BW63R3XK9E`) lo carga `js/analitica.js`, y **solo si la
persona acepta** en el aviso de cookies: no pegar la etiqueta de Google en el
`<head>`, porque se cargaría antes del consentimiento (art. 22.2 LSSI).

- Solo en las páginas públicas y solo en `peopleforpeople.es`: en local el
  aviso sale, pero no se envía nada.
- Eventos: `volunteer_signup_click`, `organization_signup_click`,
  `lead_b2b_submit`, `contact_submit`, `waitlist_signup` y
  `resource_download`. Se detectan solos por el enlace (alta o documento) o
  por los avisos `pfp:contacto-enviado` y `pfp:lista-espera` de `site.js`. Un
  evento nuevo se añade en `analitica.js`, sin datos personales.
- `lead_b2b_submit` es el formulario de contacto cuando se llega desde un
  botón «Solicitar una presentación» (`contacto.html?presentacion=…`), que
  deja el mensaje escrito y el perfil elegido. Sin ese parámetro, el mismo
  formulario cuenta como `contact_submit`.
- Eventos clave en Analytics (Administrar → Eventos clave): `lead_b2b_submit`,
  `organization_signup_click` y `waitlist_signup`. Sus parámetros (`ubicacion`,
  `tipo`, `archivo`) solo se ven en los informes si se registran como
  dimensiones personalizadas de ámbito «evento».
- **Tráfico interno:** abre la web una vez con `?interno=1` en cada navegador
  del equipo (`?interno=0` lo quita). Esas visitas llevan
  `traffic_type: 'internal'` y el filtro «Tráfico interno» de Analytics, en
  estado «Activo», las descarta. El filtro no es retroactivo.
- Si cambian las cookies, el proveedor o lo que se mide, hay que cambiar
  también «Cookies y analítica» en `privacidad.html`.

## Fuentes

Red Hat Display y Red Hat Text se sirven desde `fuentes/redhat/`
(`css/fuentes.css`), no desde Google Fonts. Licencia en
`fuentes/redhat/OFL.txt`.
