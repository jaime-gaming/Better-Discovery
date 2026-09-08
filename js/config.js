// ============================================================
// Better Discovery – Configuración
// ============================================================
// Para lanzar el sitio solo tienes que rellenar ESTOS DATOS:
//
//   1. SUPABASE_URL       → URL de tu proyecto Supabase
//   2. SUPABASE_ANON_KEY  → clave anon (o publicable) del proyecto
//   3. MODERATOR_EMAILS   → correos de los moderadores
//
// El resto de la app funciona sin cambios: una vez rellenados,
// la base de datos, el login, Discovery+ (suscripciones y
// códigos) y el panel de moderación quedan operativos.
//
// IMPORTANTE: la clave anon / publicable es pública por diseño
// (va en el navegador). En un sitio estático no existe sitio
// privado para credenciales; la seguridad real la dan las políticas
// RLS de Supabase. Detalles y límites anti-abuso: README.md,
// sección «¿Dónde va la base de datos?» + supabase/schema.sql.
// ============================================================

// ─────────── 1) URL de tu proyecto Supabase ───────────
// Se ve en el dashboard: Project Settings → API → Project URL.
const SUPABASE_URL = 'https://onfgppojanfagdccvrcy.supabase.co';

// ─────────── 2) Clave anon / publicable ───────────
// Project Settings → API → anon public key (o publishable key).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZmdwcG9qYW5mYWdkY2N2cmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NzA5NjMsImV4cCI6MjA5NzQ0Njk2M30.U93p34ZfBnHND0Xozj-9o2DzrAmvypb053P7274f7cg';

// Opcional: clave publicable (formato "sb_publishable_…"). Úsala si
// deshabilitas las claves legacy; la app prefiere la anon y usa esta
// como respaldo.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Uz6Dfl_CKXgF6nByIp50qg_O6rcbVPz';

const SUPABASE_KEY = SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY;

// ─────────── 3) Correos de los moderadores ───────────
// Quienes aparezcan aquí acceden al panel mod.html: canjear
// suscripciones, crear códigos de Discovery+, editar/borrar
// creaciones y gestionar tickets de soporte.
const MODERATOR_EMAILS = [
  'jaimegamingpro@gmail.com',
  'jaimeferrerasg@safa-grial.es',
];

// Detecta automáticamente si las credenciales fueron completadas
const IS_CONFIGURED =
  !!SUPABASE_URL &&
  !!SUPABASE_KEY &&
  !SUPABASE_URL.includes('YOUR_PROJECT') &&
  !SUPABASE_KEY.includes('YOUR_ANON');
