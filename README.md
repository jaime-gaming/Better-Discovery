# Better Discovery 🚀

Una galería comunitaria de creaciones HTML alojada en **GitHub Pages** y conectada a **Supabase**.

Sube hasta **1 MB** de código HTML para que otras personas lo vean en una vista previa con sandbox y puedan interactuar con **likes**, **comentarios** y perfiles. Incluye **Discovery+**, el plan premium con feed «Siguiendo», filtros por categoría, Guardadas y estadísticas.

---

## ✨ Funciones

| Función | Descripción |
|---|---|
| 📤 Subir HTML | Pega hasta 1 MB de HTML y publícalo con un clic (5 MB con Discovery+) |
| 🖥️ Vista previa en vivo | Un iframe con sandbox ejecuta el HTML de forma segura |
| ❤️ Me gusta | Sistema de likes persistido en Supabase (a prueba de dobles clics) |
| 💬 Comentarios | Deja feedback y lee opiniones de otras personas |
| 👤 Perfil y creaciones | Edita tu perfil, sigue a gente y revisa tu espacio usado |
| 🔍 Búsqueda | Búsqueda instantánea por título o descripción (sanitizada) |
| 📄 Orden y filtros | Recientes, valorados o por título; filtros por categoría |
| ⛶ Pantalla completa / copiar | En la vista de una creación, a pantalla completa o copia el HTML |
| ⚡ Discovery+ | Suscripción de 3,99 €/mes (activa cuando un moderador la canjea) + códigos de activación creados por el moderador: 5 MB por creación, badge exclusivo, feed «Siguiendo», filtros, Guardadas y estadísticas |
| 🎫 Soporte | Tickets de soporte con chat y auto-cierre a las 6 horas |
| 🛡️ Moderación | Panel `mod.html` para moderadores: canjear suscripciones, crear y canjear códigos Discovery+, editar/borrar creaciones y gestionar tickets |
| 📱 Responsive | Funciona en escritorio y móvil |

## ⚡ Discovery+ (suscripción de 3,99 €/mes)

El plan premium de la plataforma, ahora con **suscripción mensual de 3,99 €**.
El flujo es:

1. El usuario pulsa «Suscribirme» y se genera una **solicitud pendiente** con un
   **código de canje** (`BDP-XXXX-XXXX`).
2. Un **moderador canjea** ese código desde [`mod.html`](mod.html) (sección
   «Suscripciones»). Al canjear, la suscripción queda **activa 30 días**.
3. Al vencer, el usuario genera otra solicitud para renovar.

El estado se guarda en la tabla `subscriptions`, que es la **única fuente de
verdad**: viaja con la cuenta y se mantiene entre dispositivos. A propósito,
no se consulta `user_metadata` para el estado (cualquier usuario podría
escribir `discovery_plus=true` en sus propios metadatos y autoconcederse el
plan).

- **Página propia**: [`discovery-plus.html`](discovery-plus.html) con ventajas, planes, estado de la suscripción (Estado / Precio / Vigencia), código de canje y cancelación.
- **5 MB por creación**: los miembros suben hasta 5 MB (el resto, 1 MB); el límite se refleja en la subida y en la cuota del perfil.
- **Badge exclusivo**: insignia «⚡ Discovery+» junto a tu nombre en tu perfil y en tus creaciones.
- **Feed «Siguiendo»**: pestaña en Explorar con solo creaciones de las personas que sigues.
- **Filtros por categoría**: juegos, arte, herramientas, interactivos…
- **Guardadas**: marca tus favoritas y accede a ellas desde tu perfil.
- **Estadísticas ampliadas**: likes y comentarios recibidos por tus creaciones.

**Códigos de activación** (creados por el moderador): desde `mod.html` se
pueden **añadir códigos** que se guardan en la base de datos (`dp_codes`). Un
usuario los canjea desde `discovery-plus.html` (o un moderador los aplica a un
email): si hay una solicitud pendiente la activa, si no hay suscripción crea
una activa de 30 días, y si ya hay una activa le **suma 30 días**. Cada código
se usa una sola vez (queda registrado quién lo canjeó y cuándo).

Sin cuenta se muestra un CTA al login (conservando el destino con `?next=`);
con cuenta sin suscripción, un botón para suscribirse; con solicitud pendiente,
el código de canje; con Discovery+ activo, el estado de miembro y la opción de
cancelar. En todas las cuentas, el bloque «¿Tienes un código?» para canjearlos.

## 🎫 Soporte y 🛡️ Moderación

- **Soporte** (`support.html`): los usuarios abren tickets (asunto + mensaje)
  y conversan en un chat. Si no hay respuesta en **6 horas**, el ticket se
  cierra automáticamente.
- **Moderación** (`mod.html`): solo accesible para los emails moderador
  (ver `MODERATOR_EMAILS` en `js/config.js`). Permite revisar **todas** las
  creaciones (editar título/descripción/autor/categoría/HTML y borrarlas),
  **canjear solicitudes de suscripción** (por fila o pegando el código),
  **crear códigos de activación** (se guardan en `dp_codes` y se pueden
  aplicar a un email) y gestionar los tickets (responder y cerrar).

## 🧾 Perfil, almacenamiento y auditoría

- **Perfil persistente**: el nombre público y la biografía se guardan en
  `localStorage` como caché **y se sincronizan con la cuenta** (`user_metadata`
  de Supabase Auth: `display_name`, `bio`). Al entrar en otro dispositivo sin
  caché local, el perfil se recupera del servidor.
- **Storage local por dispositivo** (`bd_profile`, `bd_liked`, `bd_bookmarks`,
  `bd_followed_authors`, `bd_owned_snippets`): al **cerrar sesión** se limpian
  automáticamente para que el siguiente usuario del equipo no herede perfil,
  likes, Guardadas ni seguidos.
- **Registro de auditoría**: los eventos relevantes (login/logout, subidas y
  borrados de creaciones, suscripciones y canjes de Discovery+, cambios de
  perfil y vinculación de base de datos) se registran en la tabla `audit_log`
  (mejor esfuerzo; si la tabla no existe, se ignora) y en la consola.
  En el sandbox se consulta con `GET /__audit`.

## 🗄️ Vinculación de base de datos en tiempo de ejecución

Aunque `js/config.js` no esté rellena (o quieras apuntar a otro proyecto), la
base de datos se puede **vincular directamente desde la interfaz**:

- Botón **«⚙️ BD»** en la barra de navegación (todas las páginas) → modal con
  URL del proyecto y clave `anon`/publicable.
- Al vincular, la credencial se guarda en `localStorage` (`bd_db_config`) y
  **tiene prioridad sobre `js/config.js`**; se puede desvincular en el mismo
  modal para volver a la config empaquetada.
- El aviso «No se pudo conectar a la base de datos» incluye un botón para
  abrir directamente la vinculación.
- La clave `anon` es pública por diseño (la seguridad la dan las políticas
  RLS); solo se guarda en el navegador del usuario que la vincula.

## 🗄️ ¿Dónde va la base de datos? (y cómo evitar que la abusen)

Pregunta directa, respuesta directa:

**1. La base de datos no vive en este repo, nunca.** Es un proyecto de
[Supabase](https://supabase.com) en la nube. De este repo solo forman parte:

- [`supabase/schema.sql`](supabase/schema.sql): el script de creación (tablas +
  políticas de seguridad). Se pega **una sola vez** en *Dashboard → SQL Editor*.
- Dos datos en [`js/config.js`](js/config.js): la URL del proyecto y la clave
  `anon`.

**2. La clave `anon` tiene que estar en el código, y no es un secreto.** En un
sitio 100 % estático (GitHub Pages no tiene servidor) **no existe ningún sitio
privado para credenciales**: no hay variables de entorno ni backend donde
esconder nada. Cualquier "truco" para ocultarla (base64, segundo archivo,
`localStorage`, el modal «⚙️ BD»…) es legible con F12 y no aporta seguridad.
Por eso Supabase diseña esa clave como **pública**: no da acceso a la base de
datos cruda, solo a lo que las políticas RLS permiten.

> La clave que sí es secreta es la **`service_role` key: no va en el repo,
> nunca**. Solo se usa desde un servidor o una CI (este sitio no la necesita).

**3. "Que no puedan abusar" se logra con RLS + límites del dashboard:**

- **RLS (lo importante).** `supabase/schema.sql` activa *Row Level Security* en
  las 7 tablas. Con RLS activo, aunque cualquiera tenga la URL y la clave
  pública, solo puede leer lo público y escribir **sus propias filas**; los
  moderadores se reconocen por email (tabla `moderators`). Sin RLS, esa misma
  clave daría acceso total a todo, así que el script lo activa por ti.
- **Límites anti-abuso** (Dashboard → *Project Settings → API*):
  - *Rate limits*: peticiones por minuto por clave `anon` (frena
    martilleos, scrapers y bots).
  - *Max rows per request*: tope de filas por consulta (evita volcar tablas).
- **Autenticación** (Dashboard → *Authentication*): activa *Confirm email* si
  quieres que las cuentas validen el correo; habilita *MFA* para los
  moderadores.
- **Rotación**: si crees que una clave se ha filtrado, *Dashboard → Project
  Settings → API → API keys → Rotate* y actualiza la línea de `config.js`.
- **Auditoría**: la tabla `audit_log` registra las acciones del panel de
  moderación, para detectar abuso a posteriori.

En resumen: **BBDD → Supabase (fuera del código) · credencial pública →
`js/config.js` (el único sitio posible en un sitio estático) · anti-abuso →
RLS + límites del dashboard de Supabase.**

## 🔐 Acceso

Usa `login.html` para entrar con tu cuenta y navegar por el sitio. Si entras
como invitado a una página que requiere cuenta, tras el login vuelves a la
página de origen (`?next=`, validado contra una lista de páginas propias).

## 📄 Páginas

- **`login.html`** — Pantalla de acceso (con mostrar/ocultar contraseña)
- **`index.html`** — Explora y descubre creaciones (búsqueda, orden, filtros, feed)
- **`upload.html`** — Sube una nueva creación HTML
- **`view.html?id=…`** — Visualiza, da like y comenta una creación
- **`profile.html`** — Edita tu perfil, ve tus creaciones, Guardadas y estadísticas
- **`discovery-plus.html`** — Página de Discovery+ (ventajas, planes, estado de la suscripción, código de canje, cancelación)
- **`support.html`** — Soporte: abrir tickets y chatear con un moderador
- **`mod.html`** — Panel de moderación: creaciones, suscripciones + códigos de Discovery+ y tickets
- **`about.html`** — Resumen del proyecto
- **`terms.html`** — Términos y condiciones (contenido, moderación, Discovery+, limitación de responsabilidad, jurisdicción)
- **`privacy.html`** — Política de privacidad alineada con RGPD/LOPDGDD (datos, bases legales, subprocesadores, derechos, almacenamiento local)

---

## 🧪 Sandbox local (demo sin Supabase)

Incluye un servidor de demostración que sirve la web real y emula las APIs de
Supabase con datos de ejemplo:

```bash
node sandbox/server.js
# → http://localhost:8078/
```

- Cuentas demo (contraseña `demo1234`): `ana@demo.com` (con Discovery+), `luis@demo.com` (sin Discovery+) y `mod@demo.com` (moderador).
- `ana` tiene una suscripción Discovery+ **activa** (canjeada por el moderador, vigente 27 días): prueba el feed «Siguiendo», los filtros, Guardadas, los 5 MB y el badge.
- `luis` permite probar el flujo completo de suscripción: se suscribe (queda pendiente con código de canje) y un moderador lo canjea. También abre tickets de soporte.
- `mod@demo.com` desbloquea `mod.html` (editar/borrar creaciones, **canjear suscripciones**, **crear y canjear códigos de Discovery+** y gestionar tickets) y el botón «🛡️ Mod» de la barra. El sandbox lo inyecta como moderador **solo en memoria**: el `js/config.js` que se lanza no lleva ese dato de prueba.
- `/__reset` regenera los datos de ejemplo; `/__requests` muestra el log de peticiones emuladas; `/__audit` muestra el registro de auditoría.
- El servidor reescribe `js/config.js` **solo en memoria** (nunca el archivo del repo) para apuntar al propio sandbox.

## 🛠️ Stack técnico

- HTML / CSS / JavaScript puro (sin paso de build)
- [Supabase JS v2](https://supabase.com/docs/reference/javascript) via CDN con pin exacto + SRI
- GitHub Pages para hosting estático gratuito

## 🚀 Preparar el lanzamiento (checklist)

El sitio no lleva datos de prueba en el código: solo tienes que **poner tus
datos en unas pocas líneas** y aplicar el esquema una vez.

1. **Rellena tus datos en [`js/config.js`](js/config.js)** (son las 3 únicas
   líneas de configuración):
   - `SUPABASE_URL` — URL de tu proyecto Supabase.
   - `SUPABASE_ANON_KEY` — clave `anon` (o `publishable`) del proyecto.
   - `MODERATOR_EMAILS` — los correos de los moderadores (acceso a
     `mod.html`: canjear suscripciones, crear códigos, editar creaciones,
     tickets).
2. **Aplica el esquema en Supabase una vez**: abre *Dashboard → SQL Editor*,
   pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa
   *Run*. Crea las tablas que falten (incluidas `subscriptions`, `dp_codes`,
   `audit_log` y `moderators`), activa las políticas **RLS duras** (cada
   usuario solo gestiona sus propios datos y los moderadores, todo) e
   inserta tus moderadores (ya van rellenos en el script; ajústalos si
   cambian). Es idempotente: puedes volver a ejecutarlo cuando quieras.
3. **Publica en GitHub Pages**: el workflow actual
   (`.github/workflows/pages.yml`) publica en cada push a la rama `master`,
   pero la rama principal de este repo es `main`. Hay dos formas de arreglarlo
   (elige una):
   - **Opción A (recomendada, sin tocar el workflow)**: en GitHub, *Settings →
     Pages → Build and deployment → Source: "Deploy from a branch"* y elige
     `main` / raíz. Publica cada push a `main` sin necesidad de Actions.
   - **Opción B (workflow)**: edita `.github/workflows/pages.yml` en `main` y
     cambia `branches: [master]` por `branches: [main]`. (Editar archivos de
     workflow desde una App/CI requiere el permiso `workflows`; desde una
     cuenta humana funciona directamente.)
4. **Verificación**: entra en `https://<usuario>.github.io/Better-Discovery/`
   y comprueba login, subida, vista, Discovery+ (suscríbete, canjea el código
   desde `mod.html`) y el panel de moderación.

> ¿No quieres tocar `js/config.js`? También puedes vincular la base de datos
> en tiempo de ejecución desde el botón «⚙️ BD» (sección
> [Vinculación de base de datos](#-vinculación-de-base-de-datos-en-tiempo-de-ejecución));
> la credencial vinculada tiene prioridad sobre `js/config.js`.

## 🔒 Seguridad

La seguridad es por capas. El HTML de terceros se aísla y el cliente se protege con varias medidas:

- **Sandbox del preview.** Todo el HTML subido se ejecuta en un `<iframe>` con
  `sandbox="allow-scripts allow-forms allow-modals allow-popups"` y **sin**
  `allow-same-origin`. El contenido queda con *origen nulo*: no puede tocar el
  DOM, cookies ni `localStorage` del sitio, ni leer datos de otras páginas.
- **Cabeceras de seguridad** (archivos [`_headers`](_headers), que GitHub Pages
  sirve automáticamente): `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`
  (anti-clickjacking) y una CSP. `Permissions-Policy` bloquea cámara,
  micrófono, geolocalización, pago y USB, de modo que una creación maliciosa no
  puede pedir estos permisos aunque incluya código que los pida.
- **Fijación de dependencias (SRI).** El SDK de Supabase se carga desde CDN con
  versión exacta y atributo `integrity` (Subresource Integrity): si el archivo
  remoto cambia aunque sea un byte, el navegador rechaza cargarlo.
- **Escapado de salida.** Todo texto del servidor (títulos, descripciones,
  comentarios, autores) se inserta en el DOM con `escapeHtml()` o
  `textContent`, evitando inyección de HTML desde datos de la base de datos.
- **Búsqueda segura.** El texto de búsqueda se sanea antes de componer el
  filtro PostgREST (se eliminan paréntesis, comas, `&` y comodines) para que una
  búsqueda no pueda romper ni inyectar en la consulta.
- **Redirecciones seguras.** `?next=` solo acepta páginas propias del sitio
  (`getSafeNextPage`), evitando open redirect tras el login.
- **Likes a prueba de dobles clics.** El botón de like usa un bloqueo +
  relectura del contador justo antes de escribir, evitando dobles conteos y
  actualizaciones perdidas.

### ⚠️ Importante: activa RLS en Supabase

El código del cliente **no puede** proteger tu base de datos: la clave `anon` es
pública por diseño. Para que el sitio sea seguro de verdad, cada tabla debe tener
**Row Level Security activada** en el dashboard de Supabase. Sin RLS, cualquier
persona con la clave pública (que va en el navegador) podría leer, borrar o
modificar todos los registros.

**Todo el DDL + políticas RLS + triggers va en [`supabase/schema.sql`](supabase/schema.sql):**
cubre las 7 tablas (`snippets`, `comments`, `support_tickets`,
`support_messages`, `subscriptions`, `dp_codes`, `audit_log`), es idempotente
(`if not exists` / `add column if not exists` / `drop policy if exists`) y
basta con pegarlo una vez en el *SQL Editor* de Supabase.

### Capas de protección (todas en el servidor)

1. **RLS (filas):** cada usuario solo lee/escribe sus propias filas; los
   moderadores (tabla `moderators`, validada por el JWT) pueden todo.
2. **Triggers anti-manipulación** (`bd_client_guard`): sobre las escrituras de
   cliente impiden inflar `likes` (solo ±1), falsear `created_at`/`created_by`
   o el autor de un ticket, falsear la firma de un moderador en el chat de
   soporte, insertarse un `active` de Discovery+ y saltarse el límite de
   tamaño (5 MB solo con DP vigente, 1 MB en free).
3. **Constraints de integridad:** largos máximos (título 120, descripción 500,
   comentario 120/1000…) y valores permitidos (`status` de suscripciones,
   códigos y tickets).
4. **Canje atómico de códigos** (función `redeem_dp_code`, expuesta como RPC):
   el canje se resuelve en el servidor con *row locks* — dos canjes
   simultáneos del mismo código, uno solo funciona; un usuario solo puede
   canjear para **su** email y un moderador para el que indique.

Matriz de políticas (duras):

- **Galería** (`snippets`): lectura pública; sube cualquier cuenta (el autor
  se rellena solo con `auth.uid()`, no se puede registrar una creación
  "ajena"); **editar/borrar solo el autor o un moderador**. `comments`:
  lectura pública, escribe cualquier cuenta.
- **Soporte** (`support_tickets`, `support_messages`): cada usuario ve y
  gestiona **sus** tickets; un moderador, todos. En el chat, un usuario solo
  firma con su propio email (no puede falsear la de un moderador).
- **Suscripciones** (`subscriptions`): cada usuario ve **solo las suyas** y
  solo puede insertarlas como `pending` — **un usuario jamás puede
  autoactivarse Discovery+** (eso lo hace un moderador canjeando, o el canje
  atómico de un código). Cancelar la suya, sí.
- **Códigos** (`dp_codes`): los crea **solo un moderador**. Los disponibles
  **no son legibles por los usuarios** (no se pueden enumerar ni robar); un
  usuario solo ve los que él canjeó. El canje en sí pasa por
  `redeem_dp_code()`.
- **Auditoría** (`audit_log`): un usuario solo puede registrar eventos a su
  propio nombre (no falsear acciones de moderador); se consulta desde el
  dashboard.
- **`moderators`**: sin políticas → nadie desde el cliente la ve ni la
  modifica (solo el dashboard/SQL).

Las filas antiguas de `snippets` (sin `created_by`) solo las gestiona un
moderador; si quieres que sus autores originales las editen, rellena
`created_by` a mano (`update snippets set created_by = '<uid>' where id = …`).

### Defensas en la propia web (cabeceras + cliente)

- **Cabeceras de seguridad** ([`_headers`](_headers), activas al desplegar en
  GitHub Pages):
  - `Content-Security-Policy`: los scripts solo se cargan del propio sitio y
    del CDN (con SRI); **sin `eval`**, sin scripts remotos, sin `http:`
    plano y sin `data:`/`blob:` como código. Las únicas excepciones son los
    scripts inline (arquitectura del sitio) y `connect-src https:` (necesario
    para la vinculación de base de datos en tiempo de ejecución, botón
    «⚙️ BD»).
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` +
    `frame-ancestors 'none'` (anti clickjacking), `Referrer-Policy:
    strict-origin-when-cross-origin`, `Permissions-Policy` (cámara,
    micrófono, geolocalización y demás desactivados) y
    `Cross-Origin-Resource-Policy: same-origin`.
- **XSS:** todo dato que viene de la base se renderiza **siempre** escapado
  (`escapeHtml`), y los contenidos HTML de las creaciones solo se ejecutan
  dentro de iframes `sandbox` **sin** `allow-same-origin` (no pueden tocar
  cookies ni `localStorage` del sitio).
- **Vista previa en hover** y **vista de creación**: el HTML subido por los
  usuarios corre aislado (origen nulo), nunca en la página principal.
- **Validación de entradas:** largos máximos en cliente y en base, contraseña
  mínima de 8 caracteres en el registro, email validado, búsqueda saneada
  antes de llegar a los filtros, y solo se aceptan documentos HTML completos
  en las subidas.

### Rate limits (anti-abuso)

- **En el navegador** (JS): frenos por dispositivo para frenar el spam
  antes de que llegue a la base — login (5 intentos / 15 min), comentarios y
  chat (20/h), likes (60/h), subidas (10/h), tickets (5/h) y canje de
  códigos (10/h, **cada intento cuenta**, frena el forcejeo de códigos).
  Son una capa de cortesía: un script puede saltárselos.
- **En Supabase** (la capa que de verdad frena a los bots): *Dashboard →
  Project Settings → API → Rate limits* (peticiones por minuto por clave
  `anon`) y *Max rows per request*.
- **En Auth**: *Dashboard → Authentication* → activa *Confirm email* y
  habilita **MFA** para las cuentas de moderador.

## 🧑‍️ Legal

Consulta [terms.html](terms.html) y [privacy.html](privacy.html) para ver las condiciones de uso y la política de privacidad.

---

> Consulta [about.html](about.html) para ver el resumen del sitio.
