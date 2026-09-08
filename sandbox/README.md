# Sandbox local de Better Discovery

Entorno de demostración **sin dependencias** (solo Node.js, nada de `npm install`):
sirve el sitio real de la raíz del repo y un **mock de Supabase** (REST + auth)
en el mismo origen, con datos de ejemplo. Así se puede ver todo el flujo de
punta a punta: explorar, buscar, ordenar, previsualizar al pasar el ratón,
ver un snippet, dar like, comentar, subir HTML, registrarse/loguearse y perfil.

## Uso

```bash
node sandbox/server.js          # → http://localhost:8078
PORT=9000 node sandbox/server.js  # puerto personalizado
```

Abre `http://localhost:8078/`. Verás una barra 🧪 en la parte inferior con:

- **Credenciales demo:** `ana@demo.com` / `demo1234` (también `luis@demo.com`)
- **Reiniciar datos:** vuelve a los 14 snippets y comentarios de ejemplo

## Cómo funciona

| Ruta | Qué hace |
| --- | --- |
| `/` (y el resto del sitio) | Archivos estáticos del repo, tal cual |
| `*.html` (servidos) | Inyecta la barra 🧪 del sandbox. El SDK sigue cargándose del CDN fijado con SRI, igual que en producción |
| `/js/config.js` (servido) | Reescrito en el momento: `SUPABASE_URL = window.location.origin`, para que el cliente hable con el mock local. **Ningún archivo del repo se modifica** |
| `/rest/v1/snippets`, `/rest/v1/comments` | Mock del PostgREST de Supabase (filtros, orden, paginación, insert, update, delete) |
| `/auth/v1/*` | Mock de GoTrue: login por contraseña, registro (con sesión inmediata), sesión, logout y actualización del `user_metadata` (Discovery+) |
| `/__reset` | Vuelve a sembrar los datos de ejemplo |
| `/__health` | Estado (nº de snippets y comentarios) |
| `/__requests` | Últimas peticiones API recibidas (debug) |

Los datos se persisten en `sandbox/data/data.json` (ignorado por Git).

## Datos de ejemplo

14 snippets interactivos (Snake, Pong, juego de memoria, cronómetro,
dibujo, generador de gradientes, gestor de tareas…) con likes y comentarios,
creados por 4 autores demo: Ana, Luis, Marta y Carlos.
