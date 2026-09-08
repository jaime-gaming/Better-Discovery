-- ============================================================
-- Better Discovery – Esquema Supabase (producción, endurecido)
-- ============================================================
-- Ejecuta este archivo UNA VEZ en el editor SQL de tu proyecto
-- (Dashboard → SQL Editor → New query → pegar → Run).
--
-- Es idempotente: puedes ejecutarlo varias veces sin efectos
-- secundarios (crea las tablas que falten, añade las columnas y
-- constraints que falten, y redefine funciones, triggers y
-- políticas RLS).
--
-- Tablas:
--   snippets, comments            → galería
--   support_tickets,
--   support_messages              → tickets de soporte con chat
--   subscriptions                 → suscripciones Discovery+
--   dp_codes                      → códigos creados por moderadores
--   audit_log                     → registro de auditoría
--   moderators                    → emails de moderadores (la BD
--                                   valida el acceso; mantenlo igual
--                                   que MODERATOR_EMAILS en js/config.js)
--
-- Capas de protección (de fuera a dentro):
--   1. RLS: cada usuario solo lee/escribe sus propias filas; los
--      moderadores, todo. Sin RLS la clave anon (pública) podría
--      leer y borrar toda la base: aquí está activada.
--   2. Constraints de integridad: largos máximos y valores permitidos
--      (estado de suscripciones, códigos…) que ningún cliente puede
--      saltarse.
--   3. Triggers anti-manipulación: los clientes no pueden inflar
--      likes, falsear created_at/created_by, falsear emails de
--      moderador en el chat de soporte, auto-activarse Discovery+
--      ni saltarse el límite de 1/5 MB.
--   4. Función atómica `redeem_dp_code()`: el canje de códigos se
--      resuelve en el servidor (sin lecturas previas del cliente),
--      así los códigos disponibles NO son legibles por los usuarios
--      y un código no se puede canjear dos veces a la vez.
--
-- La clave `anon` es pública por diseño: la seguridad la dan estas
-- capas, no la clave. La `service_role` key NUNCA debe ir en el
-- código del sitio.
-- ============================================================

create extension if not exists pgcrypto;

/* ─────────────── 1) Galería ─────────────── */

create table if not exists snippets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  author text not null default 'Anónimo',
  tag text,
  html_content text not null default '',
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  snippet_id uuid not null references snippets(id) on delete cascade,
  author text not null default 'Anónimo',
  content text not null default '',
  created_at timestamptz not null default now()
);

-- (si tu tabla snippets es antigua y le faltara likes, esta línea la añade)
alter table snippets add column if not exists likes integer not null default 0;
alter table snippets add column if not exists tag text;

create index if not exists snippets_created_at_idx on snippets (created_at desc);
create index if not exists comments_snippet_id_idx on comments (snippet_id);

-- Identidad del autor real (para RLS de edición/eliminación propia).
-- Las filas nuevas la rellenan solas (auth.uid()); las filas antiguas
-- quedan NULL y solo las gestiona un moderador.
alter table snippets add column if not exists created_by uuid;
alter table snippets alter column created_by set default auth.uid();
create index if not exists snippets_created_by_idx on snippets (created_by);

/* ─────────────── 2) Soporte ─────────────── */

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  subject text not null,
  status text not null default 'open', -- open | closed
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text
);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_email_idx on support_tickets (user_email);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id);

/* ─────────────── 3) Suscripciones Discovery+ ─────────────── */
-- Flujo: el usuario se suscribe (3,99 €/mes) → fila `pending` con
-- `redeem_code` → un moderador la canjea → `active` con `expires_at`
-- (+30 días). También se crean filas `active` al canjear códigos
-- (siempre a través de la función redeem_dp_code o un moderador).

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  plan text not null default 'discovery_plus',
  price_cents integer not null default 399,
  status text not null default 'pending', -- pending | active | cancelled
  redeem_code text not null,
  activated_at timestamptz,
  activated_by text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Si tu proyecto usaba la tabla `subscriptions` del sitio anterior
-- (con menos columnas), estas líneas la completan sin tocar lo que
-- ya exista:
alter table subscriptions add column if not exists plan text not null default 'discovery_plus';
alter table subscriptions add column if not exists price_cents integer not null default 399;
alter table subscriptions add column if not exists status text not null default 'pending';
alter table subscriptions add column if not exists redeem_code text;
alter table subscriptions add column if not exists activated_at timestamptz;
alter table subscriptions add column if not exists activated_by text;
alter table subscriptions add column if not exists expires_at timestamptz;
alter table subscriptions add column if not exists created_at timestamptz not null default now();

create index if not exists subscriptions_email_idx on subscriptions (user_email);
create index if not exists subscriptions_redeem_code_idx on subscriptions (redeem_code);

/* ─────────────── 4) Códigos de Discovery+ ─────────────── */
-- Los crea un moderador (panel mod.html). El canje (usuario o
-- moderador) pasa SIEMPRE por la función redeem_dp_code(), que lo
-- hace atómico en el servidor.

create table if not exists dp_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'available', -- available | used
  note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  used_by text,
  used_at timestamptz,
  subscription_id uuid
);

create index if not exists dp_codes_code_idx on dp_codes (code);

/* ─────────────── 5) Registro de auditoría ─────────────── */
-- La app escribe aquí de mejor esfuerzo. Un usuario solo puede
-- registrar eventos a su propio nombre (no puede falsear acciones
-- de moderador).

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  details jsonb not null default '{}',
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_event_idx on audit_log (event);
create index if not exists audit_log_created_at_idx on audit_log (created_at desc);

/* ─────────────── 6) Moderadores ─────────────── */
-- Tabla de referencia de moderadores (el panel mod.html también usa
-- MODERATOR_EMAILS de js/config.js para la interfaz; esta tabla es la
-- que valida el ACCESO en la base de datos). Mantién ambas listas
-- iguales.

create table if not exists moderators (
  email text primary key
);

-- Tus moderadores (ajústalos si cambian). Es idempotente.
insert into moderators (email) values
  ('jaimegamingpro@gmail.com'),
  ('jaimeferrerasg@safa-grial.es')
on conflict (email) do nothing;

/* ─────────────── 7) Funciones auxiliares ─────────────── */

-- ¿La cuenta de la petición actual es moderador?
-- (El email viaja en el JWT que emite Supabase Auth.)
create or replace function public.is_better_discovery_mod()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from moderators m
    where m.email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

-- Helper: email de la cuenta actual (vacío si no hay sesión)
create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '')
$$;

-- ¿Un email concreto (parametro) está en la lista de moderadores?
create or replace function public.is_mod_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from moderators m
    where lower(m.email) = lower(coalesce(p_email, ''))
  );
$$;

-- ¿El email actual tiene Discovery+ vigente ahora mismo?
create or replace function public.has_active_discovery_plus(p_email text default null)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from subscriptions s
    where lower(s.user_email) = lower(coalesce(p_email, public.current_user_email()))
      and s.status = 'active'
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

/* ─────────────── 8) Canje atómico de códigos (RPC) ───────────────
   Única puerta de entrada para canjear códigos. Ventajas frente a
   "leer y actualizar desde el cliente":
   - Los códigos disponibles no son legibles por usuarios (RLS):
     no se pueden enumerar ni robar.
   - El canje es atómico (row locks): dos canjes simultáneos del
     mismo código, uno solo funciona.
   - Un usuario solo puede canjear para SU email; un moderador,
     para el email que indique. */
create or replace function public.redeem_dp_code(
  p_code text,
  p_user_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_me text := coalesce(auth.jwt() ->> 'email', '');
  v_code record;
  v_latest record;
  v_now timestamptz := now();
  v_plus30 timestamptz := now() + interval '30 days';
  v_sub record;
  v_extended boolean := false;
  v_created boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para canjear un código.';
  end if;

  v_email := coalesce(p_user_email, v_me);
  if v_email is null or not v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Indica un email válido.';
  end if;
  v_email := lower(trim(v_email));

  -- El usuario solo puede canjear para su propio email; un
  -- moderador puede aplicarlo a cualquier usuario.
  if v_email is distinct from lower(v_me)
     and not public.is_better_discovery_mod() then
    raise exception 'Solo puedes canjear un código para tu propio email.';
  end if;

  select * into v_code from dp_codes
  where code = upper(trim(coalesce(p_code, '')))
  for update;
  if not found then
    raise exception 'Código no encontrado.';
  end if;
  if v_code.status <> 'available' then
    raise exception 'Este código ya fue canjeado.';
  end if;

  select * into v_latest from subscriptions
  where lower(user_email) = v_email
  order by created_at desc
  limit 1
  for update;

  if found and v_latest.status = 'pending' then
    update subscriptions
       set status = 'active',
           activated_at = v_now,
           activated_by = coalesce(v_code.created_by, 'moderador'),
           expires_at = v_plus30
     where id = v_latest.id
    returning * into v_sub;
  elsif found and v_latest.status = 'active' and v_latest.expires_at > v_now then
    update subscriptions
       set expires_at = greatest(v_now, v_latest.expires_at) + interval '30 days'
     where id = v_latest.id
    returning * into v_sub;
    v_extended := true;
  else
    insert into subscriptions (user_email, plan, price_cents, status,
                               redeem_code, activated_at, activated_by, expires_at)
    values (v_email, 'discovery_plus', 399, 'active',
            upper(trim(p_code)), v_now,
            coalesce(v_code.created_by, 'moderador'), v_plus30)
    returning * into v_sub;
    v_created := true;
  end if;

  update dp_codes
     set status = 'used', used_by = v_email, used_at = v_now,
         subscription_id = v_sub.id
   where id = v_code.id;

  insert into audit_log (event, details, actor_email) values
    ('dp.code_redeemed',
     jsonb_build_object('code', v_code.code, 'for', v_email, 'by', v_me),
     v_me);

  return jsonb_build_object('sub', to_jsonb(v_sub),
                            'extended', v_extended,
                            'created', v_created);
end;
$$;

/* ─────────────── 9) Triggers anti-manipulación ───────────────
   Solo actúan sobre escrituras de CLIENTE (auth.uid() no nulo).
   Las escrituras del dashboard/SQL Editor (sin sesión) quedan
   libres, para poder administrar la base a mano. */

create or replace function public.bd_client_guard()
returns trigger
language plpgsql
as $$
declare
  v_me text := coalesce(auth.jwt() ->> 'email', '');
  v_limit int;
begin
  if auth.uid() is null then
    return coalesce(NEW, OLD);  -- escritura de administración: sin límites
  end if;

  if tg_table_name = 'snippets' then
    if tg_op = 'INSERT' then
      -- El autor es la cuenta que sube (no se puede falsear);
      -- likes empiezan en 0 y la fecha es la real.
      NEW.created_by := auth.uid();
      NEW.likes := 0;
      NEW.created_at := now();
      -- Límite de tamaño: 5 MB con Discovery+ vigente, 1 MB en free.
      v_limit := case
        when public.has_active_discovery_plus(v_me) then 5 * 1024 * 1024
        else 1024 * 1024
      end;
      if coalesce(length(NEW.html_content), 0) > v_limit then
        raise exception 'El HTML supera el límite de % bytes.', v_limit;
      end if;
    else
      -- Editar: la fecha y el autor no se tocan; los likes solo
      -- suben o bajan 1 (no se pueden inflar a mano).
      NEW.created_at := OLD.created_at;
      NEW.created_by := OLD.created_by;
      if NEW.likes is distinct from OLD.likes
         and abs(NEW.likes - OLD.likes) > 1 then
        NEW.likes := OLD.likes;
      end if;
      if coalesce(length(NEW.html_content), 0) > coalesce(length(OLD.html_content), 0) then
        v_limit := case
          when public.has_active_discovery_plus(v_me) then 5 * 1024 * 1024
          else 1024 * 1024
        end;
        if coalesce(length(NEW.html_content), 0) > v_limit then
          raise exception 'El HTML supera el límite de % bytes.', v_limit;
        end if;
      end if;
    end if;
  elsif tg_table_name = 'comments' then
    NEW.created_at := now();
  elsif tg_table_name = 'support_tickets' then
    if tg_op = 'INSERT' then
      NEW.created_at := now();
      NEW.status := 'open';
      NEW.closed_at := null;
      NEW.closed_by := null;
    end if;
  elsif tg_table_name = 'support_messages' then
    NEW.created_at := now();
    -- En el chat, un usuario solo firma con SU email (no puede
    -- falsear la firma de un moderador).
    if not public.is_better_discovery_mod() and
       lower(NEW.email) <> lower(v_me) then
      raise exception 'Solo puedes escribir con tu propio email.';
    end if;
  elsif tg_table_name = 'subscriptions' then
    if tg_op = 'INSERT' then
      NEW.created_at := now();
      -- Una sola suscripción vigente o solicitud pendiente por email.
      if exists (
        select 1 from subscriptions s
        where lower(s.user_email) = lower(NEW.user_email)
          and (s.status = 'pending'
               or (s.status = 'active'
                   and (s.expires_at is null or s.expires_at > now())))
      ) then
        raise exception 'Ya tienes una suscripción activa o una solicitud pendiente.';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists bd_guard_snippets on snippets;
create trigger bd_guard_snippets
  before insert or update on snippets
  for each row execute function public.bd_client_guard();

drop trigger if exists bd_guard_comments on comments;
create trigger bd_guard_comments
  before insert on comments
  for each row execute function public.bd_client_guard();

drop trigger if exists bd_guard_tickets on support_tickets;
create trigger bd_guard_tickets
  before insert or update on support_tickets
  for each row execute function public.bd_client_guard();

drop trigger if exists bd_guard_messages on support_messages;
create trigger bd_guard_messages
  before insert on support_messages
  for each row execute function public.bd_client_guard();

drop trigger if exists bd_guard_subscriptions on subscriptions;
create trigger bd_guard_subscriptions
  before insert on subscriptions
  for each row execute function public.bd_client_guard();

/* ─────────────── 10) Constraints de integridad ───────────────
   Largos máximos y valores permitidos. Si una tabla antigua tiene
   datos que los violan, la constraint se omite (no rompe el script). */

do $$
begin
  alter table snippets
    add constraint bd_snippets_title_len    check (char_length(title) between 1 and 120),
    add constraint bd_snippets_desc_len     check (char_length(description) <= 500),
    add constraint bd_snippets_author_len   check (char_length(author) <= 60),
    add constraint bd_snippets_tag_len      check (char_length(coalesce(tag, '')) <= 40),
    add constraint bd_snippets_likes_min    check (likes >= 0),
    add constraint bd_snippets_html_max     check (char_length(html_content) <= 5 * 1024 * 1024);
exception when others then null; -- ya existe o hay datos legacy que la violan
end $$;

do $$
begin
  alter table comments
    add constraint bd_comments_author_len   check (char_length(author) <= 60),
    add constraint bd_comments_content_len  check (char_length(content) between 1 and 1000);
exception when others then null;
end $$;

do $$
begin
  alter table support_tickets
    add constraint bd_tickets_email_len     check (char_length(user_email) between 3 and 200),
    add constraint bd_tickets_subject_len   check (char_length(subject) between 1 and 120),
    add constraint bd_tickets_status_val    check (status in ('open', 'closed'));
exception when others then null;
end $$;

do $$
begin
  alter table support_messages
    add constraint bd_messages_email_len    check (char_length(email) between 3 and 200),
    add constraint bd_messages_msg_len      check (char_length(message) between 1 and 1000);
exception when others then null;
end $$;

do $$
begin
  alter table subscriptions
    add constraint bd_subs_email_len        check (char_length(user_email) between 3 and 200),
    add constraint bd_subs_plan_len         check (char_length(plan) <= 40),
    add constraint bd_subs_code_len         check (char_length(coalesce(redeem_code, '')) <= 64),
    add constraint bd_subs_status_val       check (status in ('pending', 'active', 'cancelled'));
exception when others then null;
end $$;

do $$
begin
  alter table dp_codes
    add constraint bd_codes_code_len        check (char_length(code) between 4 and 64),
    add constraint bd_codes_status_val      check (status in ('available', 'used')),
    add constraint bd_codes_by_len          check (char_length(created_by) <= 200);
exception when others then null;
end $$;

do $$
begin
  alter table audit_log
    add constraint bd_audit_event_len       check (char_length(event) between 1 and 100),
    add constraint bd_audit_actor_len       check (char_length(coalesce(actor_email, '')) <= 200);
exception when others then null;
end $$;

/* ─────────────── 11) RLS ─────────────── */
-- IMPORTANTE: cada tabla necesita Row Level Security. Sin RLS, la
-- clave anon (pública) podría leer/escribir todo.

alter table snippets          enable row level security;
alter table comments          enable row level security;
alter table support_tickets   enable row level security;
alter table support_messages  enable row level security;
alter table subscriptions     enable row level security;
alter table dp_codes          enable row level security;
alter table audit_log         enable row level security;
alter table moderators        enable row level security;
-- moderators: SIN políticas → nadie desde el cliente puede leerla ni
-- escribirla (solo desde el dashboard/SQL).

-- Galería: lectura pública; sube cualquier cuenta; solo el autor o
-- un moderador puede editar/borrar. Al subir, el autor SIEMPRE es la
-- cuenta que sube (no se puede registrar una creación "ajena").
drop policy if exists "bd_snippets_select" on snippets;
create policy "bd_snippets_select" on snippets for select using (true);
drop policy if exists "bd_snippets_insert" on snippets;
create policy "bd_snippets_insert" on snippets for insert to authenticated
  with check (public.is_better_discovery_mod() or created_by = auth.uid());
drop policy if exists "bd_snippets_update" on snippets;
create policy "bd_snippets_update" on snippets for update to authenticated
  using (created_by = auth.uid() or public.is_better_discovery_mod());
drop policy if exists "bd_snippets_delete" on snippets;
create policy "bd_snippets_delete" on snippets for delete to authenticated
  using (created_by = auth.uid() or public.is_better_discovery_mod());

drop policy if exists "bd_comments_select" on comments;
create policy "bd_comments_select" on comments for select using (true);
drop policy if exists "bd_comments_insert" on comments;
create policy "bd_comments_insert" on comments for insert to authenticated with check (true);

-- Soporte: cada usuario ve/gestiona SUS tickets; un moderador, todos.
drop policy if exists "bd_tickets_select" on support_tickets;
create policy "bd_tickets_select" on support_tickets for select to authenticated
  using (lower(user_email) = lower(public.current_user_email()) or public.is_better_discovery_mod());
drop policy if exists "bd_tickets_insert" on support_tickets;
create policy "bd_tickets_insert" on support_tickets for insert to authenticated
  with check (lower(user_email) = lower(public.current_user_email()) and status = 'open');
drop policy if exists "bd_tickets_update" on support_tickets;
create policy "bd_tickets_update" on support_tickets for update to authenticated
  using (lower(user_email) = lower(public.current_user_email()) or public.is_better_discovery_mod())
  with check (
    public.is_better_discovery_mod()
    or (lower(user_email) = lower(public.current_user_email()) and status in ('open', 'closed'))
  );

drop policy if exists "bd_messages_select" on support_messages;
create policy "bd_messages_select" on support_messages for select to authenticated
  using (exists (
    select 1 from support_tickets t
    where t.id = ticket_id
      and (lower(t.user_email) = lower(public.current_user_email()) or public.is_better_discovery_mod())
  ));
drop policy if exists "bd_messages_insert" on support_messages;
create policy "bd_messages_insert" on support_messages for insert to authenticated
  with check (exists (
    select 1 from support_tickets t
    where t.id = ticket_id
      and (lower(t.user_email) = lower(public.current_user_email()) or public.is_better_discovery_mod())
  ));

-- Suscripciones: cada usuario ve SOLO las suyas. Su solicitud la
-- inserta él mismo, SIEMPRE como 'pending' (un usuario jamás puede
-- insertarse un 'active': solo un moderador activa, canjeando).
-- Cancelar: el usuario solo puede pasar la suya a 'cancelled'.
drop policy if exists "bd_subscriptions_select" on subscriptions;
create policy "bd_subscriptions_select" on subscriptions for select to authenticated
  using (lower(user_email) = lower(public.current_user_email()) or public.is_better_discovery_mod());
drop policy if exists "bd_subscriptions_insert" on subscriptions;
create policy "bd_subscriptions_insert" on subscriptions for insert to authenticated
  with check (
    public.is_better_discovery_mod()
    or (lower(user_email) = lower(public.current_user_email()) and status = 'pending')
  );
drop policy if exists "bd_subscriptions_update" on subscriptions;
create policy "bd_subscriptions_update" on subscriptions for update to authenticated
  using (lower(user_email) = lower(public.current_user_email()) or public.is_better_discovery_mod())
  with check (
    public.is_better_discovery_mod()
    or (lower(user_email) = lower(public.current_user_email()) and status = 'cancelled')
  );

-- Códigos: solo un moderador puede crearlos o ver la lista completa.
-- Un usuario solo ve los códigos que ÉL canjeó (para su historial);
-- los disponibles son invisibles para el cliente (no se pueden
-- enumerar). El canje en sí pasa por redeem_dp_code().
drop policy if exists "bd_dp_codes_select" on dp_codes;
create policy "bd_dp_codes_select" on dp_codes for select to authenticated
  using (
    public.is_better_discovery_mod()
    or (status = 'used' and lower(used_by) = lower(public.current_user_email()))
  );
drop policy if exists "bd_dp_codes_insert" on dp_codes;
create policy "bd_dp_codes_insert" on dp_codes for insert to authenticated
  with check (public.is_better_discovery_mod());
drop policy if exists "bd_dp_codes_update" on dp_codes;
create policy "bd_dp_codes_update" on dp_codes for update to authenticated
  using (public.is_better_discovery_mod());

-- Auditoría: se escribe al actuar; un usuario solo a su propio
-- nombre (no puede falsear acciones de moderador). No se lee desde
-- el cliente (se consulta desde el dashboard de Supabase).
drop policy if exists "bd_audit_insert" on audit_log;
create policy "bd_audit_insert" on audit_log for insert to authenticated
  with check (actor_email is null or lower(actor_email) = lower(public.current_user_email()));
