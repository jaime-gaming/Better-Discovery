// ============================================================
// Better Discovery – Sandbox local
// ------------------------------------------------------------
// Sirve el sitio (desde la raíz del repo) + un mock de Supabase
// (REST + auth) en el mismo origen, para probar TODO sin backend.
//
// Uso:
//   node sandbox/server.js            (puerto 8078)
//   PORT=9000 node sandbox/server.js  (puerto personalizado)
//
// La página abierta en el navegador apunta al backend del propio
// sandbox (js/config.js se sirve reescrito con
// SUPABASE_URL = window.location.origin), así que el flujo es
// idéntico al real: listados, búsqueda, likes, comentarios,
// subida, login y perfil.
//
// Los datos se persisten en sandbox/data/data.json.
// Pulsa "reiniciar" en la barra del sandbox (o GET /__reset)
// para volver a los datos de demostración.
// ============================================================
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DEMOS = require('./demos.js');

const PORT = Number(process.env.PORT || 8078);
const HOST = process.env.HOST || '0.0.0.0';
const SITE = path.resolve(__dirname, '..'); // raíz del repo
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

/* ───────────────────────── Datos ───────────────────────── */

const uuid = () => crypto.randomUUID();
const DEMO_USERS = {
  // Ana viene con Discovery+ activo para que la demo muestre todas las
  // funciones premium desde el primer minuto.
  'ana@demo.com': {
    password: 'demo1234',
    user: {
      id: 'u-ana',
      email: 'ana@demo.com',
      user_metadata: {
        discovery_plus: true,
        discovery_plus_since: new Date(Date.now() - 3 * 86400e3).toISOString(),
      },
    },
  },
  'luis@demo.com': { password: 'demo1234', user: { id: 'u-luis', email: 'luis@demo.com', user_metadata: {} } },
  // Moderador de la demo: desbloquea mod.html (edición de creaciones + tickets).
  'mod@demo.com': { password: 'demo1234', user: { id: 'u-mod', email: 'mod@demo.com', user_metadata: {} } },
};

function seed() {
  const now = Date.now();
  const snippets = DEMOS.map((d, i) => ({
    id: uuid(),
    title: d.title,
    description: d.description,
    author: d.author,
    tag: d.tag,
    html_content: d.html,
    likes: d.likes,
    created_at: new Date(now - d.hoursAgo * 3600e3 - (i % 7) * 600e3).toISOString(),
  }));
  const comments = [];
  const seedComments = [
    [0, 'Ana', 'Subí una versión con sonidos. ¡A jugar!'],
    [0, 'Luis', 'Los controles táctiles funcionan genial en el móvil.'],
    [1, 'Marta', 'Mi favorito. Las partículas me relajan.'],
    [2, 'Carlos', '¿Se podría añadir guardar en PNG?'],
    [3, 'Ana', 'Usé la paleta 4 en un proyecto real. Gracias!'],
    [5, 'Ana', 'Racha de 5 seguidas… hasta que fallé la última jaja'],
    [8, 'Luis', 'Me sacó de quicio la última tarjeta. Repetiré.'],
    [10, 'Marta', 'El botón de copiar CSS es lo mejor.'],
  ];
  for (const [idx, author, content] of seedComments) {
    comments.push({
      id: uuid(),
      snippet_id: snippets[idx].id,
      author,
      content,
      created_at: new Date(now - (seedComments.length - idx) * 4200e3).toISOString(),
    });
  }
  // Ana llega con una suscripción Discovery+ ACTIVA (canjeada por el
  // moderador hace 3 días, vigente hasta dentro de 27) para que la demo
  // muestre el plan premium desde el primer minuto.
  const subscriptions = [{
    id: 'sub-ana-seed',
    user_email: 'ana@demo.com',
    plan: 'discovery_plus',
    price_cents: 399,
    status: 'active',
    redeem_code: 'BDP-SEED-ANAA',
    activated_at: new Date(now - 3 * 86400e3).toISOString(),
    activated_by: 'mod@demo.com',
    expires_at: new Date(now + 27 * 86400e3).toISOString(),
    created_at: new Date(now - 3 * 86400e3).toISOString(),
  }];

  return {
    snippets,
    comments,
    support_tickets: [],
    support_messages: [],
    subscriptions,
    audit_log: [],
    dp_codes: [],
    users: JSON.parse(JSON.stringify(DEMO_USERS)),
    tokens: {},
  };
}

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (raw && Array.isArray(raw.snippets)) return raw;
  } catch { /* primera ejecución */ }
  return seed();
}

let db = loadDb();
// Tablas nuevas: asegurarlas si el data.json es de una versión anterior.
if (!Array.isArray(db.support_tickets)) db.support_tickets = [];
if (!Array.isArray(db.support_messages)) db.support_messages = [];
if (!Array.isArray(db.subscriptions)) db.subscriptions = [];
if (!Array.isArray(db.audit_log)) db.audit_log = [];
if (!Array.isArray(db.dp_codes)) db.dp_codes = [];

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('No se pudo persistir data.json:', err.message);
  }
}

/* ─────────────────── HTTP helpers ─────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...headers,
  });
  res.end(data);
}

function parseQuery(reqUrl) {
  const i = reqUrl.indexOf('?');
  return new URLSearchParams(i === -1 ? '' : reqUrl.slice(i + 1));
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 8 * 1024 * 1024) req.destroy(); });
    req.on('end', () => resolve(body));
  });
}

/* ─────────────────── Registro de peticiones (debug) ─────────────────── */

const reqLog = [];
function logReq(method, url) {
  reqLog.push({ method, url });
  if (reqLog.length > 120) reqLog.shift();
}

/* ─────────────────── Mock REST ─────────────────── */

async function handleRest(req, res, urlPath) {
  logReq(req.method, req.url);
  const qs = parseQuery(req.url);
  const table = urlPath.replace('/rest/v1/', '');
  const accept = req.headers['accept'] || '';
  const prefer = req.headers['prefer'] || '';

  if (table === 'snippets') {
    if (req.method === 'GET') {
      let rows = [...db.snippets];
      const idEq = qs.get('id');
      if (idEq && idEq.startsWith('eq.')) rows = rows.filter(r => r.id === idEq.slice(3));
      const authEq = qs.get('author');
      if (authEq && authEq.startsWith('eq.')) rows = rows.filter(r => r.author === authEq.slice(3));
      const tagEq = qs.get('tag');
      if (tagEq && tagEq.startsWith('eq.')) rows = rows.filter(r => r.tag === tagEq.slice(3));
      // PostgREST .in(column, [...]) → parámetro NOMBRE=columna con valor in.(v1,v2)
      for (const [key, val] of qs.entries()) {
        const m = val.match(/^in\.\((.*)\)$/);
        if (m) {
          const vals = m[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          rows = rows.filter(r => vals.includes(String(r[key])));
        }
      }
      const orF = qs.get('or');
      if (orF) {
        const inner = orF.slice(orF.indexOf('(') + 1, orF.lastIndexOf(')'));
        const parts = inner.split(',').map(p => p.trim());
        // or=(a,b) ⇒ a OR b (cualquier cláusula que coincida)
        rows = rows.filter(r => parts.some(p => {
          const m = p.match(/^(title|description)\.ilike\.%(.*)%$/);
          if (!m) return false;
          return String(r[m[1]] || '').toLowerCase().includes(m[2].toLowerCase());
        }));
      }
      const order = qs.get('order');
      if (order) {
        const m = order.match(/^(created_at|likes|title)(\.(asc|desc))?(\.nullslast)?/);
        if (m) {
          const col = m[1];
          const dir = (m[3] || 'asc') === 'desc' ? -1 : 1;
          rows.sort((a, b) => {
            const av = a[col], bv = b[col];
            if (av == null && bv == null) return 0;
            if (av == null) return 1;   // nulls last
            if (bv == null) return -1;
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
          });
        }
      }
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 1) return sendJson(res, 200, rows[0]);
        return sendJson(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned.' });
      }
      let start = 0, end = rows.length - 1;
      const range = qs.get('range');
      if (range) {
        const [a, b] = range.split(',').map(Number);
        start = a; end = b;
      } else if (qs.get('offset') !== null || qs.get('limit') !== null) {
        start = qs.get('offset') === null ? 0 : Number(qs.get('offset'));
        end = qs.get('limit') === null ? rows.length - 1 : start + Number(qs.get('limit')) - 1;
      }
      const page = rows.slice(start, end + 1);
      const headers = {};
      if (/count=exact/.test(prefer)) {
        headers['Content-Range'] = page.length === 0 ? `*/${rows.length}` : `0-${Math.min(end, rows.length - 1)}/${rows.length}`;
      }
      return sendJson(res, 200, page, headers);
    }

    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const nowIso = new Date().toISOString();
      const created = arr.map(r => ({
        id: uuid(),
        title: String(r.title || 'Sin título').slice(0, 200),
        description: String(r.description || '').slice(0, 1000),
        author: String(r.author || 'Anónimo').slice(0, 80),
        tag: r.tag || null,
        html_content: String(r.html_content || ''),
        likes: 0,
        created_at: nowIso,
      }));
      db.snippets.unshift(...created);
      persist();
      if (/return=representation/.test(prefer) && accept.includes('vnd.pgrst.object')) {
        const out = {};
        const sel = (qs.get('select') || '*').split(',').map(s => s.trim());
        for (const f of sel === ['*'] ? Object.keys(created[0]) : sel) out[f] = created[0][f];
        return sendJson(res, 201, out);
      }
      if (/return=representation/.test(prefer)) return sendJson(res, 201, created);
      return sendJson(res, 201, null);
    }

    if (req.method === 'PATCH') {
      const raw = await readBody(req);
      let patch;
      try { patch = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      const m = qs.get('id');
      const idVal = m && m.startsWith('eq.') ? m.slice(3) : null;
      const target = db.snippets.find(s => s.id === idVal);
      if (!target) return sendJson(res, 204, null);
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id' || k === 'created_at') continue;
        target[k] = v;
      }
      persist();
      return sendJson(res, 204, null);
    }

    if (req.method === 'DELETE') {
      const m = qs.get('id');
      if (m && m.startsWith('eq.')) {
        const sid = m.slice(3);
        db.snippets = db.snippets.filter(s => s.id !== sid);
        // higiene de datos: también se borran sus comentarios
        db.comments = db.comments.filter(c => c.snippet_id !== sid);
        persist();
      }
      return sendJson(res, 204, null);
    }
  }

  if (table === 'comments') {
    if (req.method === 'GET') {
      const sid = qs.get('snippet_id');
      let rows;
      if (!sid) rows = [];
      else if (sid.startsWith('eq.')) rows = db.comments.filter(c => c.snippet_id === sid.slice(3));
      else {
        const m = sid.match(/^in\.\((.*)\)$/);
        const vals = m ? m[1].split(',').map(s => s.trim()) : [sid];
        rows = db.comments.filter(c => vals.includes(c.snippet_id));
      }
      rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 1) return sendJson(res, 200, rows[0]);
        return sendJson(res, 406, { code: 'PGRST116', message: 'JSON object requested.' });
      }
      return sendJson(res, 200, rows);
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const created = arr.map(r => ({
        id: uuid(),
        snippet_id: r.snippet_id,
        author: String(r.author || 'Anónimo').slice(0, 80),
        content: String(r.content || '').slice(0, 2000),
        created_at: new Date().toISOString(),
      })).filter(c => db.snippets.some(s => s.id === c.snippet_id));
      db.comments.push(...created);
      persist();
      if (/return=representation/.test(prefer)) return sendJson(res, 201, created);
      return sendJson(res, 201, null);
    }
  }

  if (table === 'support_tickets') {
    if (req.method === 'GET') {
      let rows = [...db.support_tickets];
      const idEq = qs.get('id');
      if (idEq && idEq.startsWith('eq.')) rows = rows.filter(r => r.id === idEq.slice(3));
      const emailEq = qs.get('user_email');
      if (emailEq && emailEq.startsWith('eq.')) rows = rows.filter(r => String(r.user_email).toLowerCase() === emailEq.slice(3).toLowerCase());
      const statusEq = qs.get('status');
      if (statusEq && statusEq.startsWith('eq.')) rows = rows.filter(r => r.status === statusEq.slice(3));
      const order = qs.get('order');
      if (order) {
        const m = order.match(/^(created_at|status)(\.(asc|desc))?$/);
        if (m) {
          const col = m[1];
          const dir = (m[3] || 'asc') === 'desc' ? -1 : 1;
          rows.sort((a, b) => a[col] < b[col] ? -dir : a[col] > b[col] ? dir : 0);
        }
      }
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 1) return sendJson(res, 200, rows[0]);
        return sendJson(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned.' });
      }
      return sendJson(res, 200, rows);
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const created = arr.map(r => ({
        id: uuid(),
        user_email: String(r.user_email || '').slice(0, 120),
        subject: String(r.subject || '').slice(0, 120),
        status: r.status === 'closed' ? 'closed' : 'open',
        created_at: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
        closed_at: null,
        closed_by: null,
      }));
      db.support_tickets.push(...created);
      persist();
      if (/return=representation/.test(prefer)) {
        if (accept.includes('vnd.pgrst.object')) return sendJson(res, 201, created[0]);
        return sendJson(res, 201, created);
      }
      return sendJson(res, 201, null);
    }
    if (req.method === 'PATCH') {
      const raw = await readBody(req);
      let patch;
      try { patch = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      const m = qs.get('id');
      const idVal = m && m.startsWith('eq.') ? m.slice(3) : null;
      const target = db.support_tickets.find(t => t.id === idVal);
      if (!target) return sendJson(res, 204, null);
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id' || k === 'created_at') continue;
        target[k] = v;
      }
      persist();
      return sendJson(res, 204, null);
    }
  }

  if (table === 'support_messages') {
    if (req.method === 'GET') {
      let rows = [...db.support_messages];
      const tidEq = qs.get('ticket_id');
      if (tidEq && tidEq.startsWith('eq.')) rows = rows.filter(r => r.ticket_id === tidEq.slice(3));
      rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return sendJson(res, 200, rows);
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const created = arr.map(r => ({
        id: uuid(),
        ticket_id: r.ticket_id,
        email: String(r.email || '').slice(0, 120),
        message: String(r.message || '').slice(0, 1000),
        created_at: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
      })).filter(c => db.support_tickets.some(t => t.id === c.ticket_id));
      db.support_messages.push(...created);
      persist();
      if (/return=representation/.test(prefer)) return sendJson(res, 201, created);
      return sendJson(res, 201, null);
    }
  }

  if (table === 'subscriptions') {
    if (req.method === 'GET') {
      let rows = [...db.subscriptions];
      const idEq = qs.get('id');
      if (idEq && idEq.startsWith('eq.')) rows = rows.filter(r => r.id === idEq.slice(3));
      const emailEq = qs.get('user_email');
      if (emailEq && emailEq.startsWith('eq.')) rows = rows.filter(r => String(r.user_email).toLowerCase() === emailEq.slice(3).toLowerCase());
      const codeEq = qs.get('redeem_code');
      if (codeEq && codeEq.startsWith('eq.')) rows = rows.filter(r => String(r.redeem_code || '').toUpperCase() === codeEq.slice(3).trim().toUpperCase());
      const statusEq = qs.get('status');
      if (statusEq && statusEq.startsWith('eq.')) rows = rows.filter(r => r.status === statusEq.slice(3));
      const order = qs.get('order');
      if (order) {
        const m = order.match(/^created_at(\.(asc|desc))?$/);
        if (m) {
          const dir = (m[2] || 'asc') === 'desc' ? -1 : 1;
          rows.sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -dir : (a.created_at || '') > (b.created_at || '') ? dir : 0);
        }
      }
      let limit = Infinity;
      const limitQ = qs.get('limit');
      if (limitQ !== null && !Number.isNaN(Number(limitQ))) limit = Number(limitQ);
      rows = rows.slice(0, limit);
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 1) return sendJson(res, 200, rows[0]);
        return sendJson(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned.' });
      }
      return sendJson(res, 200, rows);
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const created = arr.map(r => ({
        id: uuid(),
        user_email: String(r.user_email || '').slice(0, 120),
        plan: String(r.plan || 'discovery_plus').slice(0, 40),
        price_cents: Number.isFinite(Number(r.price_cents)) ? Number(r.price_cents) : 399,
        status: r.status === 'active' ? 'active' : (r.status === 'cancelled' ? 'cancelled' : 'pending'),
        redeem_code: String(r.redeem_code || '').slice(0, 32),
        activated_at: null,
        activated_by: null,
        expires_at: null,
        created_at: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
      }));
      db.subscriptions.push(...created);
      persist();
      if (/return=representation/.test(prefer)) {
        if (accept.includes('vnd.pgrst.object')) return sendJson(res, 201, created[0]);
        return sendJson(res, 201, created);
      }
      return sendJson(res, 201, null);
    }
    if (req.method === 'PATCH') {
      const raw = await readBody(req);
      let patch;
      try { patch = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      const m = qs.get('id');
      const idVal = m && m.startsWith('eq.') ? m.slice(3) : null;
      const target = db.subscriptions.find(s => s.id === idVal);
      if (!target) return sendJson(res, 204, null);
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id' || k === 'created_at') continue;
        target[k] = v;
      }
      persist();
      return sendJson(res, 204, null);
    }
  }

  if (table === 'audit_log') {
    if (req.method === 'GET') {
      const rows = [...db.audit_log].sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);
      return sendJson(res, 200, rows.slice(-200));
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const created = arr.map(r => ({
        id: uuid(),
        event: String(r.event || 'unknown').slice(0, 60),
        details: (r.details && typeof r.details === 'object') ? r.details : {},
        actor_email: String(r.actor_email || '').slice(0, 120) || null,
        created_at: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
      }));
      db.audit_log.push(...created);
      if (db.audit_log.length > 500) db.audit_log = db.audit_log.slice(-500);
      persist();
      if (/return=representation/.test(prefer)) return sendJson(res, 201, created);
      return sendJson(res, 201, null);
    }
  }

  if (table === 'dp_codes') {
    if (req.method === 'GET') {
      let rows = [...db.dp_codes];
      const codeEq = qs.get('code');
      if (codeEq && codeEq.startsWith('eq.')) rows = rows.filter(r => String(r.code).toUpperCase() === codeEq.slice(3).trim().toUpperCase());
      const statusEq = qs.get('status');
      if (statusEq && statusEq.startsWith('eq.')) rows = rows.filter(r => r.status === statusEq.slice(3));
      const order = qs.get('order');
      if (order) {
        const m = order.match(/^created_at(\.(asc|desc))?$/);
        if (m) {
          const dir = (m[2] || 'asc') === 'desc' ? -1 : 1;
          rows.sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -dir : (a.created_at || '') > (b.created_at || '') ? dir : 0);
        }
      }
      let limit = Infinity;
      const limitQ = qs.get('limit');
      if (limitQ !== null && !Number.isNaN(Number(limitQ))) limit = Number(limitQ);
      rows = rows.slice(0, limit);
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 1) return sendJson(res, 200, rows[0]);
        return sendJson(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned.' });
      }
      return sendJson(res, 200, rows);
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      let arr;
      try { arr = JSON.parse(raw || '[]'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      if (!Array.isArray(arr)) arr = [arr];
      const created = [];
      for (const r of arr) {
        const code = String(r.code || '').trim().toUpperCase();
        if (!code) return sendJson(res, 400, { code: 'PGRST204', message: 'code is required' });
        if (db.dp_codes.some(c => c.code === code)) {
          return sendJson(res, 409, { code: '23505', message: `duplicate key value violates unique constraint on "code" (${code})` });
        }
        created.push({
          id: uuid(),
          code,
          status: r.status === 'used' ? 'used' : 'available',
          note: r.note === null || r.note === undefined ? null : String(r.note).slice(0, 120),
          created_by: String(r.created_by || 'moderador').slice(0, 120),
          created_at: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
          used_by: null,
          used_at: null,
          subscription_id: null,
        });
      }
      db.dp_codes.push(...created);
      persist();
      if (/return=representation/.test(prefer)) {
        if (accept.includes('vnd.pgrst.object')) return sendJson(res, 201, created[0]);
        return sendJson(res, 201, created);
      }
      return sendJson(res, 201, null);
    }
    if (req.method === 'PATCH') {
      const raw = await readBody(req);
      let patch;
      try { patch = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { code: 'PGRST204', message: 'Invalid JSON' }); }
      const m = qs.get('id');
      const idVal = m && m.startsWith('eq.') ? m.slice(3) : null;
      const target = db.dp_codes.find(c => c.id === idVal);
      if (!target) return sendJson(res, 204, null);
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id' || k === 'created_at' || k === 'code') continue;
        target[k] = v;
      }
      persist();
      return sendJson(res, 204, null);
    }
  }

  return sendJson(res, 404, { code: 'PGRST205', message: `Could not find the table '${table}' in the schema cache.` });
}

/* ─────────────────── Mock Auth ─────────────────── */

async function handleAuth(req, res, urlPath) {
  logReq(req.method, req.url);
  const p = urlPath.replace('/auth/v1', '');
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');

  if (req.method === 'GET' && p === '/session') {
    const email = db.tokens[token];
    if (!email || !db.users[email]) return sendJson(res, 401, { error: 'invalid_request', error_description: 'No session found' });
    return sendJson(res, 200, {
      access_token: token,
      refresh_token: 'sandbox-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: db.users[email].user,
    });
  }

  if (req.method === 'GET' && p === '/user') {
    const email = db.tokens[token];
    if (!email || !db.users[email]) return sendJson(res, 401, { error: 'invalid_request' });
    return sendJson(res, 200, db.users[email].user);
  }

  if (req.method === 'POST' && p === '/token') {
    const qs = parseQuery(req.url);
    const raw = await readBody(req);
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch { /* ignore */ }
    if (qs.get('grant_type') === 'password') {
      const u = db.users[String(data.email || '').toLowerCase()];
      if (!u || u.password !== data.password) {
        return sendJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      const t = 'sandbox-' + uuid();
      db.tokens[t] = String(data.email).toLowerCase();
      persist();
      return sendJson(res, 200, {
        access_token: t,
        refresh_token: 'sandbox-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: u.user,
      });
    }
    return sendJson(res, 400, { error: 'unsupported_grant_type' });
  }

  if (req.method === 'POST' && p === '/signup') {
    const raw = await readBody(req);
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch { /* ignore */ }
    const email = String(data.email || '').toLowerCase();
    if (!email) return sendJson(res, 422, { error: 'invalid_input', error_description: 'Email is required.' });
    if (db.users[email]) {
      return sendJson(res, 422, { error: 'invalid_input', error_description: 'User is already registered' });
    }
    const user = { id: 'u-' + uuid().slice(0, 8), email };
    db.users[email] = { password: String(data.password || ''), user };
    const t = 'sandbox-' + uuid();
    db.tokens[t] = email; // en el sandbox el alta confirma el email al instante
    persist();
    return sendJson(res, 200, {
      id: user.id, email: user.email,
      access_token: t, refresh_token: 'sandbox-refresh',
      expires_in: 3600, user,
    });
  }

  if ((req.method === 'PATCH' || req.method === 'PUT') && p === '/user') {
    const raw = await readBody(req);
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch { /* ignore */ }
    const email = db.tokens[token];
    if (!email || !db.users[email]) return sendJson(res, 401, { error: 'invalid_request' });
    const patch = (data.data && typeof data.data === 'object') ? data.data : data;
    const user = db.users[email].user;
    if (patch.user_metadata && typeof patch.user_metadata === 'object') {
      user.user_metadata = Object.assign({}, user.user_metadata, patch.user_metadata);
    } else if (Object.keys(patch).length) {
      // sin wrapper de data: se interpreta como user_metadata
      user.user_metadata = Object.assign({}, user.user_metadata, patch);
    }
    if (typeof patch.email === 'string') user.email = patch.email;
    persist();
    return sendJson(res, 200, user);
  }

  if (req.method === 'POST' && p === '/logout') {
    delete db.tokens[token];
    persist();
    return sendJson(res, 204, null);
  }

  return sendJson(res, 404, { error: 'not_found', error_description: p });
}

/* ─────────────────── Estáticos + reescrituras ─────────────────── */

const BANNER = '<div style="position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(30,27,75,.96);border:1px solid #6366f1;color:#c7d2fe;font:600 12px/1.5 -apple-system,system-ui,sans-serif;padding:7px 16px;border-radius:999px;box-shadow:0 8px 30px rgba(0,0,0,.55);white-space:nowrap;max-width:96vw;overflow:hidden;text-overflow:ellipsis">🧪 <b>Sandbox de demostración</b> · datos locales · login: ana@demo.com / demo1234 · <button onclick="fetch(\'/__reset\').then(function(){location.reload();})" style="background:none;border:none;color:#818cf8;cursor:pointer;font:inherit;font-weight:700">reiniciar datos</button></div>';

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/') rel = '/index.html';
  const full = path.normalize(path.join(SITE, rel));
  if (full !== SITE && !full.startsWith(SITE + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  // nunca servir contenido interno del sandbox
  if (full.startsWith(path.join(__dirname))) {
    res.writeHead(403); return res.end('Forbidden');
  }
  if (full.startsWith(path.join(SITE, '.git'))) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found: ' + urlPath); }
    const ext = path.extname(full).toLowerCase();

    fs.readFile(full, (err2, buf) => {
      if (err2) { res.writeHead(500); return res.end(); }

      if (urlPath === '/js/config.js' || urlPath.endsWith('/js/config.js')) {
        // Apunta el cliente Supabase al backend del propio sandbox y
        // añade el moderador de demo SOLO en memoria (el archivo del
        // repo, que es el que se lanza, no contiene datos de prueba).
        let text = buf.toString('utf8')
          .replace(/const SUPABASE_URL = '[^']*';/,
            "const SUPABASE_URL = window.location.origin; // [SANDBOX] backend local")
          .replace(/const MODERATOR_EMAILS = \[/,
            "const MODERATOR_EMAILS = ['mod@demo.com', // [SANDBOX] moderador de demo (inyectado en memoria)")
          .replace(/const IS_CONFIGURED =[\s\S]*?;/,
            'const IS_CONFIGURED = !!SUPABASE_URL && !!SUPABASE_KEY;');
        return finish(res, Buffer.from(text, 'utf8'), '.js');
      }

      if (ext === '.html') {
        let text = buf.toString('utf8');
        // Barra informativa del sandbox. (El SDK sigue cargándose del CDN
        // fijado con SRI, igual que en producción.)
        text = text.replace(/<body>/i, '<body>\n' + BANNER);
        return finish(res, Buffer.from(text, 'utf8'), '.html');
      }

      finish(res, buf, ext);
    });
  });

  function finish(res, data, ext) {
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  }
}

/* ─────────────────── Servidor ─────────────────── */

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400); return res.end('Bad request');
  }

  if (req.method === 'GET' && urlPath === '/__reset') {
    db = seed();
    persist();
    return sendJson(res, 200, { ok: true, snippets: db.snippets.length });
  }
  if (req.method === 'GET' && urlPath === '/__health') {
    return sendJson(res, 200, { ok: true, snippets: db.snippets.length, comments: db.comments.length });
  }
  if (req.method === 'GET' && urlPath === '/__requests') {
    return sendJson(res, 200, reqLog);
  }
  if (req.method === 'GET' && urlPath === '/__reset-requests') {
    reqLog.length = 0;
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'GET' && urlPath === '/__audit') {
    return sendJson(res, 200, [...db.audit_log].sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1));
  }
  if (urlPath.startsWith('/rest/v1/')) return handleRest(req, res, urlPath).catch(err => {
    console.error('REST error:', err);
    sendJson(res, 500, { code: 'SANDBOX', message: err.message });
  });
  if (urlPath.startsWith('/auth/v1')) return handleAuth(req, res, urlPath).catch(err => {
    console.error('Auth error:', err);
    sendJson(res, 500, { code: 'SANDBOX', message: err.message });
  });

  return serveStatic(req, res, urlPath);
});

server.listen(PORT, HOST, () => {
  console.log('🧪 Better Discovery — sandbox local');
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   Snippets: ${db.snippets.length} · Comentarios: ${db.comments.length} · Usuarios demo: ana@demo.com (DP), luis@demo.com, mod@demo.com (moderador) (pass: demo1234)`);
  console.log(`   Datos persistidos en ${DATA_FILE}`);
});
