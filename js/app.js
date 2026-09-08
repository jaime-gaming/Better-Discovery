// ============================================================
// Better Discovery – Shared App Utilities
// ============================================================

/* ── Supabase client ── */
let supabaseClient = null;
const DEFAULT_AUTHOR_NAME = 'Anónimo';
const LOGIN_PAGE = 'login.html';
const PROFILE_PAGE = 'profile.html';
const PROFILE_STORAGE_KEY = 'bd_profile';
const FOLLOW_STORAGE_KEY = 'bd_followed_authors';
const OWNED_SNIPPETS_STORAGE_KEY = 'bd_owned_snippets';
const DB_CONFIG_STORAGE_KEY = 'bd_db_config';
const textEncoder = new TextEncoder();

/* ── Vinculación de base de datos ──
   La config puede venir de dos sitios, con esta prioridad:
   1) Una base de datos vinculada en tiempo de ejecución (guardada en
      localStorage, p. ej. desde el botón "⚙️ BD" de la barra).
   2) js/config.js (la que viene empaquetada con el proyecto).
   Así, aunque config.js no esté rellena, se puede vincular la DB
   directamente desde la interfaz. */
function getLinkedDbConfig() {
  return readJsonStorage(DB_CONFIG_STORAGE_KEY, null);
}

function resolveSupabaseConfig() {
  const linked = getLinkedDbConfig();
  if (linked && linked.url && linked.key) {
    return { url: String(linked.url), key: String(linked.key), source: 'local' };
  }
  if (typeof IS_CONFIGURED !== 'undefined' && IS_CONFIGURED) {
    return { url: SUPABASE_URL, key: SUPABASE_KEY, source: 'config.js' };
  }
  return null;
}

function getDatabaseStatus() {
  const cfg = resolveSupabaseConfig();
  return cfg ? { linked: true, source: cfg.source } : { linked: false, source: null };
}

function createSupabaseClient(cfg) {
  supabaseClient = window.supabase.createClient(cfg.url, cfg.key);
}

function linkDatabase(url, key) {
  const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
  const cleanKey = String(key || '').trim();
  if (!cleanUrl || !/^[a-z][a-z0-9+.-]*:\/\//i.test(cleanUrl)) {
    throw new Error('Introduce una URL de Supabase válida (p. ej. https://tu-proyecto.supabase.co).');
  }
  if (!cleanKey) throw new Error('Introduce la clave anon/publicable de Supabase.');
  writeJsonStorage(DB_CONFIG_STORAGE_KEY, { url: cleanUrl, key: cleanKey });
  createSupabaseClient({ url: cleanUrl, key: cleanKey });
  void logEvent('db.linked', { source: 'local' });
  return getDatabaseStatus();
}

function unlinkDatabase() {
  try { localStorage.removeItem(DB_CONFIG_STORAGE_KEY); } catch { /* sin storage */ }
  void logEvent('db.unlinked', {});
  const cfg = resolveSupabaseConfig();
  if (cfg) createSupabaseClient(cfg);
  else supabaseClient = null;
  return getDatabaseStatus();
}

const _initialDbConfig = resolveSupabaseConfig();
if (_initialDbConfig) createSupabaseClient(_initialDbConfig);

/* ── Logging / auditoría ──
   Registra eventos importantes (subidas, borrados, suscripciones,
   canjes, perfil, login/logout) en dos sitios:
   - consola (console.debug, siempre)
   - tabla audit_log de Supabase (mejor esfuerzo; si no existe la
     tabla, se ignora en silencio) */
async function logEvent(event, details, actor) {
  let actorEmail;
  if (actor !== undefined) {
    actorEmail = actor || null;
  } else {
    try { actorEmail = getSessionEmail(await getSession()) || null; } catch { actorEmail = null; }
  }
  const entry = {
    event,
    details: details || {},
    actor_email: actorEmail,
    created_at: new Date().toISOString(),
  };
  try { if (typeof console !== 'undefined' && console.debug) console.debug('[BD]', event, entry.details, 'actor=' + actorEmail); } catch { /* sin consola */ }
  if (!supabaseClient) return;
  try { await supabaseClient.from('audit_log').insert([entry]); } catch { /* sin tabla audit_log */ }
}

/* ── Storage local de usuario ──
   Los datos de un usuario viven en localStorage y son por dispositivo.
   Al cerrar sesión se limpian para que no "pase" el perfil, los likes,
   las guardadas ni los seguidos al siguiente usuario del mismo equipo. */
const LOCAL_USER_KEYS = [
  PROFILE_STORAGE_KEY,
  FOLLOW_STORAGE_KEY,
  OWNED_SNIPPETS_STORAGE_KEY,
  'bd_liked',
  'bd_bookmarks',
];

function clearLocalUserData() {
  for (const k of LOCAL_USER_KEYS) {
    try { localStorage.removeItem(k); } catch { /* sin storage */ }
  }
}


function isLoginPage() {
  return window.location.pathname.endsWith('/login.html') ||
         window.location.pathname.endsWith('/login');
}

async function getSession() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data?.session ?? null;
}

async function requireAuth(options = {}) {
  const redirect = options.redirect !== false;
  if (isLoginPage()) return true;
  const session = await getSession();
  if (!session) {
    if (redirect) {
      // Conserva la página de origen: tras el login se vuelve a ella (?next=).
      const here = window.location.pathname.split('/').pop() || 'index.html';
      window.location.replace(`${LOGIN_PAGE}?next=${encodeURIComponent(here)}`);
      return false;
    }
    return false;
  }
  return true;
}

/** Solo se aceptan páginas propias del sitio (evita open redirect). */
const SAFE_PAGES = new Set([
  'index.html', 'login.html', 'upload.html', 'view.html',
  'profile.html', 'about.html', 'terms.html', 'privacy.html',
  'discovery-plus.html',
]);

function getSafeNextPage(raw) {
  const name = String(raw || '').replace(/^\//, '');
  // Si viene con ?id=... (view.html?id=x) se conserva la query.
  const [pageName, query] = name.split('?');
  if (!SAFE_PAGES.has(pageName)) return 'index.html';
  return query ? `${pageName}?${query}` : pageName;
}

async function renderAuthNav() {
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;

  if (!supabaseClient) {
    navAuth.innerHTML = '';
    return;
  }

  const session = await getSession();
  // El estado de Discovery+ se resuelve desde la tabla de suscripciones
  // (con respaldo en user_metadata) e hidrata el perfil desde el servidor.
  if (session) {
    await hydrateProfileFromServer(session);
    await getDiscoveryPlusState(session);
  }

  const dpBtn = `<button type="button" class="dp-btn${window.__dpActive ? ' active' : ''}" id="dpNavBtn" title="Discovery+">⚡<span>Discovery+</span></button>`;
  const dbBtn = `<button type="button" class="btn btn-outline" id="dbNavBtn" title="Vincular base de datos">⚙️ BD</button>`;

  if (!session) {
    navAuth.innerHTML = `${dbBtn}${dpBtn}<a href="${LOGIN_PAGE}" class="btn btn-primary">Login</a>`;
    navAuth.querySelector('#dpNavBtn')?.addEventListener('click', openDiscoveryPlusModal);
    navAuth.querySelector('#dbNavBtn')?.addEventListener('click', openDatabaseModal);
    return;
  }

  const profile = getProfileData();
  // Si el usuario no eligió nombre público, se muestra su email (así
  // sabe en qué cuenta está; "Anónimo" no identifica a nadie).
  const displayLabel = profile.displayName !== DEFAULT_AUTHOR_NAME
    ? profile.displayName
    : (session.user?.email || DEFAULT_AUTHOR_NAME);
  const profileLink = window.location.pathname.endsWith('/profile.html') || window.location.pathname.endsWith('/profile')
    ? ''
    : `<a href="${PROFILE_PAGE}" class="btn btn-outline">Perfil</a>`;
  const modLink = isModerator(session)
    ? `<a href="mod.html" class="btn btn-outline" id="modNavBtn" title="Panel de moderación">🛡️ Mod</a>`
    : '';
  navAuth.innerHTML = `
    ${dbBtn}
    ${dpBtn}
    <span class="user-label">${getModeratorBadgeHtml(session)}${getDiscoveryPlusBadgeHtml(profile.displayName)}${escapeHtml(displayLabel)}</span>
    ${modLink}
    ${profileLink}
    <button type="button" class="btn btn-outline" id="logoutBtn">Salir</button>
  `;

  const dp = navAuth.querySelector('#dpNavBtn');
  if (dp) {
    dp.addEventListener('click', async () => {
      if (window.__dpActive) {
        // Ya activo: ir directo a la sección de Discovery+ del perfil.
        window.location.replace(PROFILE_PAGE + '#discovery-plus');
        return;
      }
      openDiscoveryPlusModal();
    });
    dp.addEventListener('click', () => dp.classList.toggle('active', window.__dpActive));
  }

  navAuth.querySelector('#dbNavBtn')?.addEventListener('click', openDatabaseModal);

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    let preEmail = null;
    try { preEmail = getSessionEmail(await getSession()); } catch { /* sin sesión */ }
    try { await supabaseClient.auth.signOut(); } catch { /* sin sesión */ }
    void logEvent('auth.logout', {}, preEmail);
    // El storage local es por dispositivo: se limpia al salir para que el
    // siguiente usuario no herede perfil/likes/guardadas/seguidos.
    clearLocalUserData();
    window.location.replace(LOGIN_PAGE);
  });
}

/* ── Toast notifications ── */
const TOAST_ICONS = { success: '✓', error: '⚠', info: 'ℹ' };

function showToast(message, type = 'info', duration = 3500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] || TOAST_ICONS.info}</span><span class="toast-msg">${escapeHtml(message)}</span>`;
  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 340);
  }, duration);
}

/* ── Barra de carga superior (feedback de peticiones) ── */
let loadBarTimer = null;

function showLoadBar() {
  let bar = document.getElementById('bdLoadBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bdLoadBar';
    bar.className = 'load-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }
  clearTimeout(loadBarTimer);
  // reinicia la animación
  bar.classList.remove('on', 'done');
  void bar.offsetWidth; // reflow
  bar.classList.add('on');
}

function hideLoadBar() {
  const bar = document.getElementById('bdLoadBar');
  if (!bar) return;
  bar.classList.remove('on');
  bar.classList.add('done');
  clearTimeout(loadBarTimer);
  loadBarTimer = setTimeout(() => bar.remove(), 450);
}

/* ── Reveal on scroll (animación al entrar en viewport) ── */
function initRevealOnScroll() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('reveal-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  els.forEach(el => io.observe(el));
}

/* ── Error messages ── */
/** Traduce errores comunes de PostgREST/Supabase a mensajes legibles. */
function friendlyDbError(err) {
  const code = err?.code || '';
  const msg  = String(err?.message || '');

  if (code === 'PGRST116' || /row not found|no rows? returned/i.test(msg)) {
    return 'No se encontró el elemento.';
  }
  if (code === '23505' || /duplicate key/i.test(msg)) {
    return 'Ya existe un registro con ese valor.';
  }
  if (code === '23503' || /foreign key/i.test(msg)) {
    return 'La operación no es válida porque el registro relacionado no existe.';
  }
  if (code === '42501' || /new row violates row-level security/i.test(msg)) {
    return 'No tienes permiso para realizar esta operación.';
  }
  if (code === '23514' || /check constraint/i.test(msg)) {
    return 'El contenido supera el límite permitido. Recórtalo e inténtalo de nuevo.';
  }
  if (/supera el límite de|solo puedes|ya tienes una suscripción|inicia sesión para canjear|email válido|código no encontrado|ya fue canjeado/i.test(msg)) {
    // Mensajes de las funciones/triggers de la base: ya van en español.
    return msg;
  }
  if (code === 'PGRST301' || /schema cache/i.test(msg)) {
    return 'El servidor está actualizando su caché. Vuelve a intentarlo en unos segundos.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  if (/invalid api key|jwt|token/i.test(msg)) {
    return 'Las credenciales de la app no son válidas.';
  }
  return msg || 'Error desconocido.';
}

/* ── Rate limiting de cliente (anti-spam por dispositivo) ──
   Límites suaves para frenar el abuso desde el propio navegador.
   No son una frontera de seguridad (un script puede saltárselos):
   la defensa real está en la base (RLS + triggers) y en los rate
   limits del dashboard de Supabase. */
const BD_RATE_LIMITS = {
  login:    { max: 5,  windowMs: 15 * 60 * 1000,        message: 'Demasiados intentos fallidos. Espera unos minutos y prueba otra vez.' },
  comment:  { max: 20, windowMs: 60 * 60 * 1000,        message: 'Has escrito demasiados comentarios en poco tiempo. Espera un rato.' },
  like:     { max: 60, windowMs: 60 * 60 * 1000,        message: 'Demasiados me gusta en poco tiempo. Espera un rato.' },
  upload:   { max: 10, windowMs: 60 * 60 * 1000,        message: 'Has publicado demasiadas creaciones en poco tiempo. Espera un rato.' },
  ticket:   { max: 5,  windowMs: 60 * 60 * 1000,        message: 'Has abierto demasiados tickets en poco tiempo. Espera un rato.' },
  redeem:   { max: 10, windowMs: 60 * 60 * 1000,        message: 'Demasiados intentos de canje en poco tiempo. Espera un rato.' },
  modcanje: { max: 60, windowMs: 60 * 60 * 1000,        message: 'Estás canjeando demasiado rápido. Espera un rato.' },
};

/**
 * Comprueba si la acción está dentro de su límite.
 * @returns {{ok: boolean, retryMs?: number, message?: string}}
 */
function bdThrottleCheck(action) {
  const rule = BD_RATE_LIMITS[action];
  if (!rule) return { ok: true };
  try {
    const now = Date.now();
    const raw = localStorage.getItem('bd_rl_' + action);
    const stamps = (raw ? JSON.parse(raw) : []).filter(t => now - t < rule.windowMs);
    if (stamps.length >= rule.max) {
      const retryMs = stamps[0] + rule.windowMs - now;
      return { ok: false, retryMs, message: rule.message };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // si no hay localStorage, no bloqueamos
  }
}

/** Registra un intento (llamándolo después de la comprobación). */
function bdThrottleRecord(action) {
  const rule = BD_RATE_LIMITS[action];
  if (!rule) return;
  try {
    const now = Date.now();
    const raw = localStorage.getItem('bd_rl_' + action);
    const stamps = (raw ? JSON.parse(raw) : []).filter(t => now - t < rule.windowMs);
    stamps.push(now);
    localStorage.setItem('bd_rl_' + action, JSON.stringify(stamps));
  } catch { /* sin localStorage: sin límite */ }
}

/** Mensaje de espera legible a partir de ms. */
function bdRetryMessage(retryMs) {
  const min = Math.max(1, Math.ceil(retryMs / 60000));
  return min === 1 ? 'Espera 1 minuto y prueba otra vez.' : `Espera ${min} min y prueba otra vez.`;
}

/* ── Date helpers ── */
function timeAgo(dateStr) {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);

  if (m < 1)  return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  if (h < 24) return `hace ${h} h`;
  if (d <  7) return `hace ${d} d`;
  return new Date(dateStr).toLocaleDateString('es');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ── Size formatting ── */
function bytesToSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ── HTML escaping ── */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function getProfileInitial(name) {
  const value = String(name || '').trim();
  return value ? value[0].toUpperCase() : DEFAULT_AUTHOR_NAME[0].toUpperCase();
}

/* ── Storage helpers ── */
function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function getProfileData() {
  const profile = readJsonStorage(PROFILE_STORAGE_KEY, {});
  return {
    displayName: String(profile.displayName || DEFAULT_AUTHOR_NAME).trim(),
    bio: String(profile.bio || '').trim(),
  };
}

function _normalizeProfile(profile) {
  return {
    displayName: String(profile.displayName || DEFAULT_AUTHOR_NAME).trim() || DEFAULT_AUTHOR_NAME,
    bio: String(profile.bio || '').trim(),
  };
}

// Escribe el perfil solo en localStorage (sin tocar el servidor).
function saveProfileDataLocalOnly(profile) {
  const next = _normalizeProfile(profile);
  writeJsonStorage(PROFILE_STORAGE_KEY, next);
  return next;
}

// Escribe en localStorage Y lo persiste en el servidor (user_metadata),
// para que el perfil sea el mismo en cualquier dispositivo.
function saveProfileData(profile) {
  const next = saveProfileDataLocalOnly(profile);
  void syncProfileToServer(next);
  return next;
}

async function syncProfileToServer(profile) {
  if (!supabaseClient) return false;
  try {
    const session = await getSession();
    if (!session) return false;
    const { error } = await supabaseClient.auth.updateUser({
      user_metadata: { display_name: profile.displayName, bio: profile.bio || null },
    });
    if (error) throw error;
    void logEvent('profile.updated', { display_name: profile.displayName });
    return true;
  } catch { return false; }
}

// Si no hay perfil local (sigue "Anónimo"), adopta el que hay en el
// servidor, para que al entrar en otro dispositivo se recupere.
async function hydrateProfileFromServer(session) {
  const local = getProfileData();
  if (local.displayName !== DEFAULT_AUTHOR_NAME || local.bio) return local;
  let meta = (session && session.user && session.user.user_metadata) || {};
  // La sesión cacheada por supabase-js puede estar desactualizada:
  // se pide al servidor el usuario fresco si es posible.
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.auth.getUser();
      if (data && data.user) meta = data.user.user_metadata || meta;
    } catch { /* sin red/servidor: se usa la sesión cacheada */ }
  }
  const serverName = String(meta.display_name || '').trim();
  if (serverName && serverName !== DEFAULT_AUTHOR_NAME) {
    return saveProfileDataLocalOnly({ displayName: serverName, bio: String(meta.bio || '').trim() });
  }
  return local;
}

function getOwnedSnippetIds() {
  const ids = readJsonStorage(OWNED_SNIPPETS_STORAGE_KEY, []);
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

function recordOwnedSnippetId(id) {
  const ids = new Set(getOwnedSnippetIds());
  ids.add(String(id));
  writeJsonStorage(OWNED_SNIPPETS_STORAGE_KEY, [...ids]);
}

function getFollowedAuthors() {
  const authors = readJsonStorage(FOLLOW_STORAGE_KEY, []);
  return Array.isArray(authors)
    ? [...new Set(authors.map(author => String(author || '').trim()).filter(Boolean))]
    : [];
}

function isFollowingAuthor(author) {
  const target = String(author || '').trim().toLowerCase();
  if (!target) return false;
  return getFollowedAuthors().some(name => name.toLowerCase() === target);
}

function toggleFollowAuthor(author) {
  const target = String(author || '').trim();
  if (!target) return { nowFollowing: false };
  const current = getFollowedAuthors();
  const targetLower = target.toLowerCase();
  const index = current.findIndex(name => name.toLowerCase() === targetLower);
  const nowFollowing = index === -1;
  if (nowFollowing) {
    current.unshift(target);
  } else {
    current.splice(index, 1);
  }
  writeJsonStorage(FOLLOW_STORAGE_KEY, current);
  return { nowFollowing };
}

function snippetBytes(snippet) {
  return textEncoder.encode(String(snippet?.html_content || '')).length;
}

/* ── Tags ── */
const TAG_META = {
  game: { emoji: '🎮', label: 'Juego' },
  art: { emoji: '🎨', label: 'Arte' },
  tool: { emoji: '🛠️', label: 'Herramienta' },
  demo: { emoji: '📐', label: 'Demo' },
  interactive: { emoji: '🖱️', label: 'Interactivo' },
  other: { emoji: '📦', label: 'Otro' },
};

function tagMeta(tag) {
  return TAG_META[tag] || { emoji: '📦', label: String(tag || 'Otro') };
}

/* ── Query helpers ── */
/**
 * Limpia el texto de búsqueda para que sea seguro dentro de un
 * filtro PostgREST `.or(...)`: elimina caracteres que rompen la
 * sintaxis del filtro (paréntesis, comas, comillas, ampersands…)
 * y los comodines ilike, y limita la longitud.
 */
function sanitizeSearchText(raw) {
  return String(raw || '')
    .replace(/[()&|,"'\\]/g, ' ')  // rompen la sintaxis del filtro
    .replace(/[%_*]/g, ' ')        // comodines ilike
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/* ── Likes (stored in localStorage) ── */
function getLikedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('bd_liked') || '[]')); }
  catch { return new Set(); }
}

function saveLikedSet(set) {
  localStorage.setItem('bd_liked', JSON.stringify([...set]));
}

function isLiked(id) {
  return getLikedSet().has(id);
}

/**
 * Toggle like state.
 * Returns { nowLiked: boolean }
 */
function toggleLike(id) {
  const set = getLikedSet();
  const nowLiked = !set.has(id);
  if (nowLiked) { set.add(id); } else { set.delete(id); }
  saveLikedSet(set);
  return { nowLiked };
}

/* ── Discovery+ ──
   La condición se guarda en el user_metadata de Supabase Auth
   (supabaseClient.auth.updateUser), de modo que no requiere migración
   de esquema y viaja con la cuenta del usuario. */
const DISCOVERY_PLUS_PERKS = [
  { icon: '📡', title: 'Feed «Siguiendo»',    desc: 'Pestaña en Explorar con solo creaciones de las personas que sigues.' },
  { icon: '🏷️', title: 'Filtros por categoría', desc: 'Filtra la galería por juegos, arte, herramientas, interactivos y más.' },
  { icon: '⭐', title: 'Guardadas',           desc: 'Guarda tus creaciones favoritas y accede a ellas desde tu perfil.' },
  { icon: '📊', title: 'Estadísticas ampliadas', desc: 'Me gusta y comentarios recibidos por tus creaciones.' },
];

function isDiscoveryPlusActive() {
  return !!window.__dpActive;
}

/* ── Discovery+: límites de almacenamiento ──
   Los miembros suben hasta 5 MB por creación; el resto, 1 MB. */
const MAX_FREE_BYTES = 1 * 1024 * 1024;
const MAX_PRO_BYTES = 5 * 1024 * 1024;

function getMaxUploadBytes() {
  return isDiscoveryPlusActive() ? MAX_PRO_BYTES : MAX_FREE_BYTES;
}

/**
 * Badge exclusivo de Discovery+ (herencia de la versión anterior del sitio).
 * Solo se muestra cuando el autor coincide con el perfil local del miembro
 * (el estado DP viaja con la cuenta y es privado de cada usuario).
 */
function getDiscoveryPlusBadgeHtml(authorName) {
  if (!isDiscoveryPlusActive()) return '';
  const mine = getProfileData().displayName;
  if (authorName && mine && authorName !== DEFAULT_AUTHOR_NAME &&
      String(authorName).trim().toLowerCase() !== mine.trim().toLowerCase()) {
    return '';
  }
  return '<span class="discovery-badge" title="Miembro Discovery+">⚡ Discovery+</span>';
}

/* ── Discovery+: suscripción mensual ──
   Modelo: el usuario se suscribe (3,99 €/mes) y queda "pendiente";
   un moderador CANJEA el código de la suscripción y queda "activa"
   durante 30 días. La tabla `subscriptions` es la ÚNICA fuente de
   verdad (user_metadata.discovery_plus NO se consulta: no serviría
   de nada, cualquier usuario podría escribirlo y autoconcederse el
   plan). */
const DP_PLAN = 'discovery_plus';
const DP_PRICE_EUR = 3.99;
const DP_PRICE_CENTS = 399;
const DP_DURATION_DAYS = 30;

function formatDpPrice() {
  return DP_PRICE_EUR.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/mes';
}

function generateRedeemCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  try {
    const arr = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr);
    else for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
    for (let i = 0; i < 8; i++) out += abc[arr[i] % abc.length];
  } catch {
    for (let i = 0; i < 8; i++) out += abc[Math.floor(Math.random() * abc.length)];
  }
  return `BDP-${out.slice(0, 4)}-${out.slice(4)}`;
}

async function getLatestSubscription(email) {
  if (!supabaseClient || !email) return null;
  try {
    const { data, error } = await supabaseClient.from('subscriptions')
      .select('*').eq('user_email', email)
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) || null;
  } catch { return null; } // sin tabla subscriptions
}

async function getDiscoveryPlusState(session) {
  if (!supabaseClient) { window.__dpActive = false; window.__dpPending = false; return false; }
  const sess = session || await getSession();
  const email = getSessionEmail(sess);
  // La tabla `subscriptions` es la ÚNICA fuente de verdad del estado.
  // (No se consulta user_metadata: cualquiera podría escribir
  // discovery_plus=true en sus propios metadatos y autoconcederse el plan.)
  if (email) {
    const sub = await getLatestSubscription(email);
    if (sub) {
      const now = Date.now();
      if (sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at).getTime() > now)) {
        window.__dpActive = true;
        window.__dpPending = false;
        return true;
      }
      // Expirada o pendiente: no activa, pero "pendiente" marca el UI
      // (chip "Pendiente de canje" + caja con tu código).
      window.__dpActive = false;
      window.__dpPending = sub.status === 'pending';
      return false;
    }
  }
  window.__dpActive = false;
  window.__dpPending = false;
  return false;
}

async function subscribeToDiscoveryPlus() {
  if (!supabaseClient) { showToast('Supabase no está configurado.', 'error'); return null; }
  const session = await getSession();
  if (!session) { window.location.replace(LOGIN_PAGE); return null; }
  const email = getSessionEmail(session);
  if (!email) { showToast('No se pudo leer tu email de sesión.', 'error'); return null; }
  // Sin duplicados: una sola solicitud pendiente, y no se re-suscribe si
  // ya hay una suscripción vigente (para ampliar, se canjea un código).
  const latest = await getLatestSubscription(email);
  if (latest) {
    const now = Date.now();
    if (latest.status === 'pending') {
      showToast('Ya tienes una solicitud pendiente; un moderador debe canjearla.', 'info', 5000);
      return null;
    }
    if (latest.status === 'active' && latest.expires_at && new Date(latest.expires_at).getTime() > now) {
      showToast('Ya tienes Discovery+ activo; canjea un código para ampliarlo.', 'info', 5000);
      return null;
    }
  }
  try {
    const { data, error } = await supabaseClient.from('subscriptions')
      .insert([{
        user_email: email,
        plan: DP_PLAN,
        price_cents: DP_PRICE_CENTS,
        status: 'pending',
        redeem_code: generateRedeemCode(),
      }])
      .select().single();
    if (error) throw error;
    window.__dpPending = true;
    refreshDiscoveryPlusUI();
    void logEvent('dp.subscribed', { email, redeem_code: data.redeem_code });
    showToast('Solicitud enviada. Un moderador debe canjearla para activarla.', 'success', 5000);
    return data;
  } catch (err) {
    showToast(friendlyDbError(err), 'error', 5000);
    return null;
  }
}

async function redeemSubscription(code, moderatorEmail) {
  if (!supabaseClient) throw new Error('Supabase no está configurado');
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) throw new Error('Introduce un código de canje.');
  const { data, error } = await supabaseClient.from('subscriptions')
    .select('*').eq('redeem_code', clean).limit(1);
  if (error) throw error;
  const sub = (Array.isArray(data) ? data[0] : data) || null;
  if (!sub) throw new Error('Código de canje no encontrado.');
  if (sub.status === 'active') throw new Error('Esta suscripción ya está activa.');
  const now = new Date();
  const expires = new Date(now.getTime() + DP_DURATION_DAYS * 86400e3);
  const patch = {
    status: 'active',
    activated_at: now.toISOString(),
    activated_by: moderatorEmail || 'moderador',
    expires_at: expires.toISOString(),
  };
  const { error: upErr } = await supabaseClient.from('subscriptions')
    .update(patch).eq('id', sub.id);
  if (upErr) throw upErr;
  void logEvent('dp.redeemed', { email: sub.user_email, code: clean, by: moderatorEmail || 'moderador' });
  return { ...sub, ...patch };
}

async function cancelDiscoveryPlus() {
  if (!supabaseClient) { showToast('Supabase no está configurado.', 'error'); return false; }
  const session = await getSession();
  const email = getSessionEmail(session);
  if (!email) { showToast('Inicia sesión para gestionar tu suscripción.', 'error'); return false; }
  try {
    const { data, error } = await supabaseClient.from('subscriptions')
      .select('*').eq('user_email', email)
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    const sub = (Array.isArray(data) ? data[0] : data) || null;
    if (!sub || sub.status === 'cancelled') { showToast('No tienes una suscripción activa.', 'info'); return false; }
    const { error: upErr } = await supabaseClient.from('subscriptions')
      .update({ status: 'cancelled' }).eq('id', sub.id);
    if (upErr) throw upErr;
    window.__dpActive = false;
    window.__dpPending = false;
    refreshDiscoveryPlusUI();
    void logEvent('dp.cancelled', { email });
    showToast('Suscripción cancelada.', 'success');
    return true;
  } catch (err) {
    showToast(friendlyDbError(err), 'error', 5000);
    return false;
  }
}

/* ── Códigos de Discovery+ (creados por un moderador) ──
   Un moderador genera códigos (tabla dp_codes) que pueden canjearse:
   - por un usuario desde discovery-plus.html (activa o amplía su
     suscripción), o
   - aplicados a un email concreto desde el panel de moderación.
   Al canjear: si hay solicitud pendiente la activa; si hay suscripción
   activa le suma 30 días; si no, crea una activa de 30 días. */
async function createDpCode(note, moderatorEmail) {
  if (!supabaseClient) throw new Error('Supabase no está configurado');
  const who = String(moderatorEmail || 'moderador');
  const { data, error } = await supabaseClient.from('dp_codes')
    .insert([{
      code: generateRedeemCode(),
      status: 'available',
      note: String(note || '').trim().slice(0, 120) || null,
      created_by: who,
    }])
    .select().single();
  if (error) throw error;
  void logEvent('dp.code_created', { code: data.code, by: who });
  return data;
}

async function getDpCode(code) {
  if (!supabaseClient) return null;
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const { data, error } = await supabaseClient.from('dp_codes')
    .select('*').eq('code', clean).limit(1);
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) || null;
}

async function redeemDpCode(code, targetEmail, appliedBy) {
  if (!supabaseClient) throw new Error('Supabase no está configurado');
  const clean = String(code || '').trim().toUpperCase();
  const email = String(targetEmail || '').trim().toLowerCase();
  if (!clean) throw new Error('Introduce un código de Discovery+.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Indica un email de usuario válido.');

  // El canje lo resuelve el servidor de forma atómica
  // (función redeem_dp_code): el usuario solo puede canjear para su
  // propio email, un moderador para el email que indique, y el
  // código queda marcado como usado en la misma transacción.
  const { data, error } = await supabaseClient.rpc('redeem_dp_code', {
    p_code: clean,
    p_user_email: email,
  });
  if (error) {
    // Los errores de la función vienen ya con mensaje en español.
    throw new Error(friendlyDbError(error) || 'No se pudo canjear el código.');
  }
  const sub = (data && data.sub) || data;
  const extended = !!(data && data.extended);
  void logEvent('dp.code_redeemed', { code: clean, for: email, by: appliedBy || null });
  return { sub, extended, code: { code: clean, status: 'used' } };
}


async function useDpCode(code) {
  const session = supabaseClient ? await getSession() : null;
  const email = getSessionEmail(session);
  if (!email) {
    window.location.replace(`${LOGIN_PAGE}?next=${encodeURIComponent('discovery-plus.html')}`);
    throw new Error('Inicia sesión para canjear un código.');
  }
  const result = await redeemDpCode(code, email, email);
  refreshDiscoveryPlusUI();
  return result;
}

/** Redibuja botones/estados que dependen de Discovery+ en la página actual. */
function refreshDiscoveryPlusUI() {
  document.dispatchEvent(new CustomEvent('dp:changed'));
}

function openDiscoveryPlusModal() {
  closeDiscoveryPlusModal();
  const sessionPromise = supabaseClient ? getSession() : Promise.resolve(null);

  const overlay = document.createElement('div');
  overlay.className = 'dp-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Discovery+');
  overlay.innerHTML = `
    <div class="dp-modal">
      <button type="button" class="dp-close" aria-label="Cerrar">×</button>
      <div class="dp-kicker">Discovery+</div>
      <h2 class="dp-title">Discovery<span>+</span></h2>
      <p class="dp-sub">Descubre mejor, más rápido y a tu manera.</p>
      <ul class="dp-perks">
        ${DISCOVERY_PLUS_PERKS.map(p => `
          <li>
            <span class="dp-perk-icon">${p.icon}</span>
            <div><strong>${p.title}</strong><br><small>${p.desc}</small></div>
          </li>`).join('')}
      </ul>
      <div class="dp-action" data-state="loading">
        <button type="button" class="btn btn-dp dp-activate" disabled>Comprobando…</button>
      </div>
      <p class="dp-fineprint">Suscripción de <strong>${formatDpPrice()}</strong>: se activa cuando un moderador canjea tu solicitud.<br><a href="discovery-plus.html">Descubre todo sobre Discovery+ →</a></p>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => closeDiscoveryPlusModal();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.dp-close').addEventListener('click', close);
  overlay._escHandler = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', overlay._escHandler);

  (async () => {
    const action = overlay.querySelector('.dp-action');
    try {
      const active = await getDiscoveryPlusState();
      const session = await sessionPromise;
      if (!action.isConnected) return;
      if (active) {
        action.innerHTML = '<div class="dp-active-note"><strong>Discovery+ activo</strong> — ya disfrutas de todas las funciones.</div>';
        return;
      }
      if (window.__dpPending) {
        action.innerHTML = '<div class="dp-active-note"><strong>Pendiente de canje</strong> — un moderador debe canjear tu solicitud para activarla.</div>';
        return;
      }
      action.innerHTML = session
        ? `<button type="button" class="btn btn-dp dp-activate">Suscribirme a Discovery+ · ${formatDpPrice()}</button>`
        : `<a href="${LOGIN_PAGE}?next=discovery-plus.html" class="btn dp-activate">Login para suscribirte</a>`;
      action.querySelector('.dp-activate')?.addEventListener('click', async e => {
        const el = e.currentTarget;
        if (el.tagName === 'A') return; // el enlace hace la redirección
        el.disabled = true;
        el.textContent = 'Enviando solicitud…';
        const sub = await subscribeToDiscoveryPlus();
        if (sub) {
          action.innerHTML = `<div class="dp-active-note"><strong>Pendiente de canje.</strong><br>Un moderador debe canjear tu solicitud. Tu código: <code>${escapeHtml(sub.redeem_code || '')}</code></div>`;
        } else {
          el.disabled = false;
          el.textContent = `Suscribirme a Discovery+ · ${formatDpPrice()}`;
        }
      });
    } catch (err) {
      if (!action.isConnected) return;
      action.innerHTML = `<div class="dp-active-note">${escapeHtml(friendlyDbError(err))}</div>
        <button type="button" class="btn btn-outline dp-retry" style="margin-top:12px">Reintentar</button>`;
      action.querySelector('.dp-retry')?.addEventListener('click', () => openDiscoveryPlusModal());
    }
  })();
}

/* Sincroniza el botón de nav y otras vistas cuando cambia Discovery+. */
document.addEventListener('dp:changed', () => {
  const dp = document.getElementById('dpNavBtn');
  if (dp) dp.classList.toggle('active', isDiscoveryPlusActive());
});

function closeDiscoveryPlusModal() {
  const overlay = document.querySelector('.dp-overlay');
  if (!overlay) return;
  document.removeEventListener('keydown', overlay._escHandler);
  overlay.remove();
}

/* ── Moderadores ──
   La lista de moderadores se define en js/config.js (MODERATOR_EMAILS).
   Se normaliza (minúsculas, sin espacios) para comparar con la sesión.
   Los moderadores ven un panel (mod.html) con creaciones, suscripciones,
   códigos de Discovery+ y tickets de soporte. */
const MODERATOR_SET = new Set(
  (typeof MODERATOR_EMAILS !== 'undefined' ? MODERATOR_EMAILS : [])
    .map(e => String(e || '').trim().toLowerCase())
    .filter(Boolean)
);

function getSessionEmail(session) {
  return String(session?.user?.email || '').trim().toLowerCase();
}

function isModerator(session) {
  return !!session && MODERATOR_SET.has(getSessionEmail(session));
}

function getModeratorBadgeHtml(session) {
  if (!isModerator(session)) return '';
  return '<span class="mod-badge" title="Moderador">MOD</span>';
}

/* ── Acciones del panel de moderador (mod.html) ── */
function openEditModal(snippet) {
  const modal = document.getElementById('editModal');
  if (!modal) return;
  document.getElementById('editTitle').value = snippet.title || '';
  document.getElementById('editDescription').value = snippet.description || '';
  document.getElementById('editAuthor').value = snippet.author || '';
  document.getElementById('editTag').value = snippet.tag || '';
  document.getElementById('editHtml').value = snippet.html_content || '';
  modal.style.display = 'block';
  modal.dataset.snippetId = snippet.id;
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) modal.style.display = 'none';
}

async function saveSnippetEdits() {
  const modal = document.getElementById('editModal');
  const id = modal?.dataset?.snippetId;
  if (!id || !supabaseClient) return;

  const title = document.getElementById('editTitle').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const author = document.getElementById('editAuthor').value.trim();
  const tag = document.getElementById('editTag').value.trim() || null;
  const html_content = document.getElementById('editHtml').value;
  if (!title) { showToast('El título no puede estar vacío.', 'error'); return; }

  const btn = document.getElementById('editSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  try {
    const { error } = await supabaseClient.from('snippets')
      .update({ title, description, author, tag, html_content })
      .eq('id', id);
    if (error) throw error;
    showToast('Cambios guardados.', 'success');
    closeEditModal();
    if (typeof window.__modReload === 'function') window.__modReload();
    else window.location.reload();
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error', 5000);
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}

async function modDeleteSnippet(id) {
  if (!supabaseClient) return;
  if (!confirm('¿Seguro que quieres eliminar esta creación? Esta acción no se puede deshacer.')) return;
  try {
    const { error } = await supabaseClient.from('snippets').delete().eq('id', id);
    if (error) throw error;
    void logEvent('mod.deleted', { id });
    showToast('Creación eliminada (con sus comentarios).', 'success');
    if (typeof window.__modReload === 'function') window.__modReload();
    else window.location.replace('index.html');
  } catch (err) {
    showToast('No se pudo eliminar: ' + err.message, 'error', 5000);
  }
}

/* ── Tickets de soporte (support.html / mod.html) ──
   Se cierran solos pasadas 6 horas si nadie los ha atendido. */
const TICKET_CLOSE_DELAY_MS = 6 * 60 * 60 * 1000;

async function createSupportTicket(subject, message, session) {
  if (!supabaseClient) throw new Error('Supabase no está configurado');
  const email = getSessionEmail(session);
  if (!email) throw new Error('Debes iniciar sesión para crear un ticket');
  const { data, error } = await supabaseClient.from('support_tickets').insert([{
    user_email: email,
    subject: String(subject || '').slice(0, 120),
    status: 'open',
  }]).select().single();
  if (error) throw error;
  if (message) {
    const { error: msgErr } = await supabaseClient.from('support_messages').insert([{
      ticket_id: data.id,
      email,
      message: String(message || '').slice(0, 1000),
    }]);
    if (msgErr) throw msgErr;
  }
  return data;
}

async function closeSupportTicket(ticketId, closedBy) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from('support_tickets')
    .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: closedBy || 'system' })
    .eq('id', ticketId);
  if (error) throw error;
}

async function maybeAutoCloseTicket(ticket) {
  const created = new Date(ticket.created_at).getTime();
  const elapsed = Date.now() - created;
  if (elapsed >= TICKET_CLOSE_DELAY_MS) {
    await closeSupportTicket(ticket.id, 'system');
  } else {
    const remaining = TICKET_CLOSE_DELAY_MS - elapsed;
    setTimeout(() => closeSupportTicket(ticket.id, 'system'), Math.max(remaining, 1000));
  }
}

/* ── Modal de vinculación de base de datos ──
   Permite vincular (o desvincular) la base de datos de Supabase
   directamente desde la interfaz, aunque js/config.js no esté
   rellena. La credencial se guarda en localStorage (bd_db_config)
   y tiene prioridad sobre config.js. */
function openDatabaseModal() {
  const existing = document.querySelector('.db-overlay');
  if (existing) existing.remove();
  const status = getDatabaseStatus();
  const linked = getLinkedDbConfig() || {};

  const overlay = document.createElement('div');
  overlay.className = 'db-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Vincular base de datos');
  overlay.innerHTML = `
    <div class="db-modal">
      <button type="button" class="db-close" aria-label="Cerrar">×</button>
      <h2 class="db-title">Base de datos</h2>
      <p class="db-status" id="dbStatus" data-status="${status.source || 'none'}">
        ${status.linked
          ? `Vinculada vía <strong>${status.source === 'local' ? 'configuración local' : 'js/config.js'}</strong>.`
          : '<strong>Sin vincular.</strong> Rellena URL y clave anon para conectar tu proyecto Supabase.'}
      </p>
      <div class="form-group">
        <label class="form-label" for="dbUrl">URL del proyecto Supabase</label>
        <input id="dbUrl" class="form-input" type="text" placeholder="https://tu-proyecto.supabase.co" value="${escapeHtml(linked.url || '')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="dbKey">Clave anon / publicable</label>
        <input id="dbKey" class="form-input" type="password" placeholder="eyJhbGci… o sb_publishable_…" value="${escapeHtml(linked.key || '')}">
      </div>
      <p class="db-fineprint">La clave anon es pública por diseño; la seguridad la dan las políticas RLS. Se guarda solo en este navegador.</p>
      <div class="db-actions">
        <button type="button" class="btn btn-primary db-link-btn">Vincular base de datos</button>
        ${linked.url ? '<button type="button" class="btn btn-outline db-unlink-btn">Desvincular</button>' : ''}
      </div>
      <p class="db-error" id="dbError" role="alert"></p>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.db-close').addEventListener('click', close);
  overlay._escHandler = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', overlay._escHandler);

  const errEl = overlay.querySelector('#dbError');
  overlay.querySelector('.db-link-btn').addEventListener('click', () => {
    try {
      linkDatabase(overlay.querySelector('#dbUrl').value, overlay.querySelector('#dbKey').value);
      showToast('Base de datos vinculada. Recargando…', 'success');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      errEl.textContent = err.message || 'No se pudo vincular la base de datos.';
    }
  });
  const unlinkBtn = overlay.querySelector('.db-unlink-btn');
  if (unlinkBtn) {
    unlinkBtn.addEventListener('click', () => {
      unlinkDatabase();
      showToast('Base de datos desvinculada. Recargando…', 'info');
      setTimeout(() => window.location.reload(), 900);
    });
  }
}

function closeDatabaseModal() {
  const overlay = document.querySelector('.db-overlay');
  if (!overlay) return;
  document.removeEventListener('keydown', overlay._escHandler);
  overlay.remove();
}

/* ── Guardadas (marcadores, localStorage por dispositivo) ── */
const BOOKMARKS_STORAGE_KEY = 'bd_bookmarks';

function getBookmarkedIds() {
  const ids = readJsonStorage(BOOKMARKS_STORAGE_KEY, []);
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

function isBookmarked(id) {
  return getBookmarkedIds().includes(String(id));
}

function toggleBookmark(id) {
  const ids = getBookmarkedIds();
  const key = String(id);
  const idx = ids.indexOf(key);
  const nowBookmarked = idx === -1;
  if (nowBookmarked) ids.unshift(key);
  else ids.splice(idx, 1);
  writeJsonStorage(BOOKMARKS_STORAGE_KEY, ids);
  return { nowBookmarked };
}

/* El reveal on scroll se activa solo en todas las páginas (app.js es
   compartido y se carga al final del <body>, con el DOM ya listo). */
document.addEventListener('DOMContentLoaded', initRevealOnScroll);

/* ── Config-not-set notice (used in grids) ── */
function configNoticeHtml() {
  return `
    <div class="config-notice">
      <strong>No se pudo conectar a la base de datos</strong><br><br>
      Revisa <code>js/config.js</code> o vincula tu proyecto Supabase directamente
      desde el navegador (se guarda solo en este equipo).
      <br><button type="button" class="btn btn-primary" id="configNoticeLinkBtn" style="margin-top:10px">Vincular base de datos</button>
    </div>`;
}

// Delegación: el aviso de config se inserta en varias páginas; un solo
// listener permite abrir el modal de vinculación desde cualquiera.
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'configNoticeLinkBtn') openDatabaseModal();
});
