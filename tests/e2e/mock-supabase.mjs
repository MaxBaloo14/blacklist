// Banc d'essai : imite les API Supabase (Auth, PostgREST, Storage) PAR-DESSUS une vraie base PostgreSQL
// qui contient le vrai schéma, la vraie RLS et les vraies fonctions du projet. Sert uniquement aux tests en local.
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";

export const KEYS = { anon: "sb_publishable_e2e", service: "sb_secret_e2e", jwt: "e2e-jwt-secret" };
const pool = new pg.Pool({ host: "127.0.0.1", user: "postgres", password: "e2e", database: process.env.E2E_DB ?? "bl_e2e", max: 12 });

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const sign = (payload) => { const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(payload); return `${h}.${p}.${crypto.createHmac("sha256", KEYS.jwt).update(`${h}.${p}`).digest("base64url")}`; };
function verify(token) {
  const [h, p, s] = String(token).split(".");
  if (!s || crypto.createHmac("sha256", KEYS.jwt).update(`${h}.${p}`).digest("base64url") !== s) return null;
  const pl = JSON.parse(Buffer.from(p, "base64url").toString());
  return pl.exp * 1000 > Date.now() ? pl : null;
}
const refreshTokens = new Map();
const files = new Map();
const signedTokens = new Map();

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD", "access-control-expose-headers": "content-range" };
function json(res, status, body, headers = {}) { const b = JSON.stringify(body); res.writeHead(status, { "content-type": "application/json", ...CORS, ...headers }); res.end(b); }
function empty(res, status, headers = {}) { res.writeHead(status, { ...CORS, ...headers }); res.end(); }
function httpErr(status, code, message, details = null) { return Object.assign(new Error(message), { status, pgrst: { code, message, details, hint: null } }); }

/* ---------------- Auth (GoTrue) ---------------- */
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, created_at: u.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() });
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, iat: now, exp: now + 3600 });
  const refresh_token = crypto.randomUUID(); refreshTokens.set(refresh_token, u.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(u) };
}
async function auth(req, res, url, body) {
  const path = url.pathname.replace("/auth/v1", "");
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const isService = bearer === KEYS.service || req.headers.apikey === KEYS.service;
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const r = await pool.query("select id,email,created_at from auth.users where lower(email)=lower($1) and encrypted_password = crypt($2, encrypted_password)", [body.email, body.password]);
      if (!r.rows[0]) return json(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return json(res, 200, session(r.rows[0]));
    }
    if (grant === "refresh_token") {
      const id = refreshTokens.get(body.refresh_token); if (!id) return json(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      const r = await pool.query("select id,email,created_at from auth.users where id=$1", [id]);
      return json(res, 200, session(r.rows[0]));
    }
  }
  if (path === "/user" && req.method === "GET") {
    const c = verify(bearer); if (!c) return json(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    const r = await pool.query("select id,email,created_at from auth.users where id=$1", [c.sub]);
    return r.rows[0] ? json(res, 200, userJson(r.rows[0])) : json(res, 403, { code: 403, error_code: "user_not_found", msg: "User from sub claim in JWT does not exist" });
  }
  if (path === "/user" && req.method === "PUT") {
    const c = verify(bearer); if (!c) return json(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    if (body.password) await pool.query("update auth.users set encrypted_password = crypt($2, gen_salt('bf')) where id=$1", [c.sub, body.password]);
    const r = await pool.query("select id,email,created_at from auth.users where id=$1", [c.sub]); return json(res, 200, userJson(r.rows[0]));
  }
  if (path === "/logout") return empty(res, 204);
  if (path === "/.well-known/jwks.json") return json(res, 200, { keys: [] });
  if (path === "/settings") return json(res, 200, { external: {}, disable_signup: false, mailer_autoconfirm: true });
  if (path.startsWith("/admin/users")) {
    if (!isService) return json(res, 403, { code: 403, error_code: "not_admin", msg: "User not allowed" });
    const id = path.split("/")[3];
    if (req.method === "POST") {
      try {
        const r = await pool.query("insert into auth.users(id,email,encrypted_password) values (gen_random_uuid(), $1, crypt($2, gen_salt('bf'))) returning id,email,created_at", [body.email, body.password]);
        return json(res, 200, userJson(r.rows[0]));
      } catch { return json(res, 422, { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" }); }
    }
    if (req.method === "GET") { const r = await pool.query("select id,email,created_at from auth.users where id=$1", [id]); return r.rows[0] ? json(res, 200, userJson(r.rows[0])) : json(res, 404, { code: 404, error_code: "user_not_found", msg: "User not found" }); }
    if (req.method === "PUT") { if (body.password) await pool.query("update auth.users set encrypted_password = crypt($2, gen_salt('bf')) where id=$1", [id, body.password]); const r = await pool.query("select id,email,created_at from auth.users where id=$1", [id]); return json(res, 200, userJson(r.rows[0])); }
    if (req.method === "DELETE") { await pool.query("delete from auth.users where id=$1", [id]); return json(res, 200, {}); }
  }
  return json(res, 404, { code: 404, msg: `Auth route non gérée : ${req.method} ${path}` });
}

/* ---------------- PostgREST ---------------- */
const IDENT = /^[a-z_][a-z0-9_]*$/i;
const q = (n) => { if (!IDENT.test(n)) throw httpErr(400, "PGRST100", `Identifiant invalide : ${n}`); return `"${n}"`; };

const colCache = new Map(), fkCache = {};
async function columns(c, table) {
  if (!colCache.has(table)) { const r = await c.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position", [table]); colCache.set(table, r.rows.map((x) => x.column_name)); }
  return colCache.get(table);
}
async function fks() {
  if (!fkCache.rows) {
    const r = await pool.query(`select con.conrelid::regclass::text as child, con.confrelid::regclass::text as parent,
        (select array_agg(a.attname::text order by k.ord) from unnest(con.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum) as ccols,
        (select array_agg(a.attname::text order by k.ord) from unnest(con.confkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=con.confrelid and a.attnum=k.attnum) as pcols,
        exists (select 1 from pg_index i where i.indrelid=con.conrelid and i.indisunique and i.indpred is null and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid=i.indrelid and a.attnum = any(i.indkey)) = (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid=con.conrelid and a.attnum = any(con.conkey))) as child_unique
      from pg_constraint con where con.contype='f' and con.connamespace='public'::regnamespace`);
    fkCache.rows = r.rows.map((x) => ({ ...x, child: x.child.replace(/^public\./, "").replace(/"/g, ""), parent: x.parent.replace(/^public\./, "").replace(/"/g, "") }));
  }
  return fkCache.rows;
}

function parseSelect(str) {
  let i = 0;
  const list = () => {
    const out = [];
    while (i < str.length) {
      while (str[i] === " ") i++;
      let name = "";
      while (i < str.length && !",():!".includes(str[i])) name += str[i++];
      let alias = null;
      if (str[i] === ":") { alias = name; i++; name = ""; while (i < str.length && !",()!".includes(str[i])) name += str[i++]; }
      if (str[i] === "!") { while (i < str.length && !",(".includes(str[i])) i++; }
      let children = null;
      if (str[i] === "(") { i++; children = list(); i++; }
      out.push({ name: name.trim(), alias: alias?.trim() ?? null, children });
      if (str[i] === ",") i++; else break;
    }
    return out;
  };
  return list();
}

async function buildSelect(c, table, items, alias) {
  const parts = [];
  for (const it of items) {
    if (it.name === "*" && !it.children) { for (const col of await columns(c, table)) parts.push(`'${col}', ${alias}.${q(col)}`); continue; }
    if (it.children) {
      const all = await fks();
      const toOne = all.find((f) => f.child === table && f.parent === it.name);
      const toMany = all.find((f) => f.child === it.name && f.parent === table);
      const sub = `s${Math.random().toString(36).slice(2, 7)}`;
      const inner = await buildSelect(c, it.name, it.children, sub);
      const key = it.alias ?? it.name;
      if (toOne) {
        const cn = toOne.ccols.map((cc, k) => `${sub}.${q(toOne.pcols[k])} = ${alias}.${q(cc)}`).join(" and ");
        parts.push(`'${key}', (select json_build_object(${inner}) from ${q(it.name)} ${sub} where ${cn} limit 1)`);
      } else if (toMany) {
        const cn = toMany.ccols.map((cc, k) => `${sub}.${q(cc)} = ${alias}.${q(toMany.pcols[k])}`).join(" and ");
        parts.push(toMany.child_unique
          ? `'${key}', (select json_build_object(${inner}) from ${q(it.name)} ${sub} where ${cn} limit 1)`
          : `'${key}', coalesce((select json_agg(json_build_object(${inner})) from ${q(it.name)} ${sub} where ${cn}), '[]'::json)`);
      } else throw httpErr(400, "PGRST200", `Relation introuvable entre ${table} et ${it.name}`);
      continue;
    }
    parts.push(`'${it.alias ?? it.name}', ${alias}.${q(it.name)}`);
  }
  return parts.join(", ");
}

function parseValList(v) {
  const inner = v.replace(/^\(/, "").replace(/\)$/, ""); const out = []; let cur = "", quoted = false;
  for (const ch of inner) { if (ch === '"') quoted = !quoted; else if (ch === "," && !quoted) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out.filter((x, i, a) => !(a.length === 1 && x === ""));
}
function cond(col, opv, params, alias) {
  let neg = false, rest = opv;
  if (rest.startsWith("not.")) { neg = true; rest = rest.slice(4); }
  const dot = rest.indexOf("."); const op = rest.slice(0, dot), val = rest.slice(dot + 1);
  const L = `${alias}.${q(col)}`; let sql;
  const p = (v) => { params.push(v); return `$${params.length}`; };
  switch (op) {
    case "eq": sql = `${L}::text = ${p(val)}`; break; case "neq": sql = `${L}::text <> ${p(val)}`; break;
    case "gt": sql = `${L} > ${p(val)}`; break; case "gte": sql = `${L} >= ${p(val)}`; break;
    case "lt": sql = `${L} < ${p(val)}`; break; case "lte": sql = `${L} <= ${p(val)}`; break;
    case "like": sql = `${L}::text like ${p(val.replace(/\*/g, "%"))}`; break; case "ilike": sql = `${L}::text ilike ${p(val.replace(/\*/g, "%"))}`; break;
    case "is": sql = val === "null" ? `${L} is null` : val === "true" ? `${L} is true` : `${L} is false`; break;
    case "in": sql = `${L}::text = any(${p(parseValList(val))})`; break;
    default: throw httpErr(400, "PGRST100", `Opérateur non géré : ${op}`);
  }
  return neg ? `not (${sql})` : sql;
}
function splitTop(s) { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; }
function orExpr(inner, params, alias, joiner) {
  return "(" + splitTop(inner).map((part) => {
    const m = part.match(/^(and|or)\((.*)\)$/); if (m) return orExpr(m[2], params, alias, m[1]);
    const dot = part.indexOf("."); return cond(part.slice(0, dot), part.slice(dot + 1), params, alias);
  }).join(` ${joiner} `) + ")";
}
function where(url, params, alias) {
  const w = [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or" || k === "and") { w.push(orExpr(v.replace(/^\(/, "").replace(/\)$/, ""), params, alias, k)); continue; }
    w.push(cond(k, v, params, alias));
  }
  return w.length ? " where " + w.join(" and ") : "";
}
function orderLimit(url, alias) {
  let s = "";
  const o = url.searchParams.get("order");
  if (o) s += " order by " + o.split(",").map((x) => { const [c, ...m] = x.split("."); return `${alias}.${q(c)} ${m.includes("desc") ? "desc" : "asc"}${m.includes("nullsfirst") ? " nulls first" : m.includes("nullslast") ? " nulls last" : ""}`; }).join(", ");
  if (url.searchParams.get("limit")) s += ` limit ${Number(url.searchParams.get("limit"))}`;
  if (url.searchParams.get("offset")) s += ` offset ${Number(url.searchParams.get("offset"))}`;
  return s;
}

const statusFor = (e, role) => {
  if (e.status) return e.status;
  switch (e.code) { case "42501": return role === "anon" ? 401 : 403; case "23505": case "23503": return 409; case "42883": case "42P01": return 404; default: return 400; }
};

async function withRole(role, claims, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub ?? ""]);
    await c.query(`set local role ${role}`);
    const r = await fn(c); await c.query("commit"); return r;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}

function whoami(req) {
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "") || req.headers.apikey;
  if (bearer === KEYS.service) return { role: "service_role", claims: { role: "service_role" } };
  if (bearer === KEYS.anon || !bearer) return { role: "anon", claims: { role: "anon" } };
  const c = verify(bearer);
  if (!c) throw httpErr(401, "PGRST301", "JWT invalide ou expiré");
  return { role: "authenticated", claims: { role: "authenticated", sub: c.sub, email: c.email } };
}

async function rest(req, res, url, body) {
  let role = "anon";
  try {
    const who = whoami(req); role = who.role;
    const rel = url.pathname.replace("/rest/v1/", "");
    const prefer = req.headers.prefer ?? "";
    const wantRep = prefer.includes("return=representation");
    const wantCount = /count=exact/.test(prefer);
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    const out = await withRole(role, who.claims, async (c) => {
      if (rel.startsWith("rpc/")) {
        const fn = rel.slice(4);
        const meta = await c.query("select prorettype::regtype::text as t, proretset, proargnames, (select array_agg(format_type(x, null) order by o) from unnest(proargtypes::oid[]) with ordinality as u(x, o)) as argtypes from pg_proc where pronamespace='public'::regnamespace and proname=$1 limit 1", [fn]);
        if (!meta.rows[0]) throw httpErr(404, "PGRST202", `Could not find the function public.${fn}`);
        const src = req.method === "GET" ? Object.fromEntries(url.searchParams) : (body ?? {});
        const keys = Object.keys(src); const params = keys.map((k) => (src[k] !== null && typeof src[k] === "object" && !(Array.isArray(src[k]) && String(meta.rows[0].argtypes?.[(meta.rows[0].proargnames ?? []).indexOf(k)] ?? "").endsWith("[]")) ? JSON.stringify(src[k]) : src[k]));
        const r = await c.query(`select * from public.${q(fn)}(${keys.map((k, i) => `${q(k)} => $${i + 1}`).join(", ")})`, params);
        if (meta.rows[0].t === "void") return { status: 204 };
        if (meta.rows[0].proretset) return { status: 200, body: r.rows };
        return { status: 200, body: r.rows[0] ? r.rows[0][fn] : null };
      }
      const table = rel; const sel = url.searchParams.get("select");
      const items = parseSelect(sel && sel.length ? sel : "*");
      if (req.method === "GET" || req.method === "HEAD") {
        const params = []; const w = where(url, params, "t0");
        const inner = await buildSelect(c, table, items, "t0");
        let total = null;
        if (wantCount) total = Number((await c.query(`select count(*) from ${q(table)} t0${w}`, params)).rows[0].count);
        if (req.method === "HEAD") return { status: 200, headers: { "content-range": `*/${total ?? 0}` } };
        const r = await c.query(`select json_build_object(${inner}) as j from ${q(table)} t0${w}${orderLimit(url, "t0")}`, params);
        const rows = r.rows.map((x) => x.j);
        if (single) { if (rows.length !== 1) throw httpErr(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${rows.length} rows`); return { status: 200, body: rows[0] }; }
        return { status: 200, body: rows, headers: wantCount ? { "content-range": rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}` } : {} };
      }
      const returning = (rows) => (!wantRep ? { status: req.method === "POST" ? 201 : 204 } : { status: req.method === "POST" ? 201 : 200, body: single ? rows[0] : rows });
      if (req.method === "POST") {
        const arr = Array.isArray(body) ? body : [body]; const cols = [...new Set(arr.flatMap((o) => Object.keys(o)))];
        const r = await c.query(`insert into ${q(table)} (${cols.map(q).join(",")}) select ${cols.map(q).join(",")} from json_populate_recordset(null::${q(table)}, $1::json) returning *`, [JSON.stringify(arr)]);
        return returning(r.rows);
      }
      if (req.method === "PATCH") {
        const cols = Object.keys(body); const params = []; const w = where(url, params, "t");
        params.push(JSON.stringify(body));
        const r = await c.query(`update ${q(table)} t set ${cols.map((k) => `${q(k)} = s.${q(k)}`).join(", ")} from json_populate_record(null::${q(table)}, $${params.length}::json) s${w} returning t.*`, params);
        return returning(r.rows);
      }
      if (req.method === "DELETE") { const params = []; const w = where(url, params, "t"); const r = await c.query(`delete from ${q(table)} t${w} returning t.*`, params); return returning(r.rows); }
      throw httpErr(405, "PGRST117", "Méthode non gérée");
    });
    if (out.status === 204 || out.body === undefined) return empty(res, out.status, out.headers);
    return json(res, out.status, out.body, out.headers);
  } catch (e) {
    const pgrst = e.pgrst ?? { code: e.code ?? "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null };
    return json(res, statusFor(e, role), pgrst);
  }
}

/* ---------------- Storage ---------------- */
async function bucketInfo(bucket) { return (await pool.query("select * from storage.buckets where id=$1", [bucket])).rows[0]; }
async function canInsert(role, claims, bucket, name) {
  try { await withRole(role, claims, async (c) => { await c.query("insert into storage.objects(bucket_id,name) values ($1,$2)", [bucket, name]); throw Object.assign(new Error("ok"), { ok: true }); }); }
  catch (e) { return !!e.ok; }
  return true;
}
// Le client Supabase envoie un File en multipart/form-data : on en extrait le fichier et son type, comme le vrai Storage.
function unwrap(req, raw) {
  const ct = req.headers["content-type"] ?? "";
  const m = ct.match(/multipart\/form-data;\s*boundary=(.+)$/);
  if (!m) return { type: ct.split(";")[0], body: raw };
  const sep = Buffer.from("--" + m[1]); let pos = raw.indexOf(sep);
  while (pos !== -1) {
    const next = raw.indexOf(sep, pos + sep.length); if (next === -1) break;
    const part = raw.subarray(pos + sep.length + 2, next - 2); const hEnd = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, hEnd).toString();
    if (/filename=/.test(head)) return { type: (head.match(/content-type:\s*([^\r\n]+)/i)?.[1] ?? "application/octet-stream").trim(), body: part.subarray(hEnd + 4) };
    pos = next;
  }
  return { type: "application/octet-stream", body: raw };
}
async function storage(req, res, url, raw0) {
  const { type: upType, body: raw } = unwrap(req, raw0);
  const path = url.pathname.replace("/storage/v1", "");
  const send = (s, b) => json(res, s, b);
  let m;
  if ((m = path.match(/^\/object\/public\/([^/]+)\/(.+)$/))) {
    const f = files.get(`${m[1]}/${decodeURIComponent(m[2])}`); if (!f) return send(404, { statusCode: "404", error: "not_found", message: "Object not found" });
    res.writeHead(200, { "content-type": f.type, "content-length": f.body.length, "access-control-allow-origin": "*" }); return res.end(f.body);
  }
  try {
    const { role, claims } = whoami(req);
    if ((m = path.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/))) {
      const bucket = m[1], name = decodeURIComponent(m[2]);
      if (req.method === "POST") {
        if (!(await canInsert(role, claims, bucket, name))) return send(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
        const token = crypto.randomUUID(); signedTokens.set(token, { bucket, name });
        return send(200, { url: `/object/upload/sign/${bucket}/${name}?token=${token}`, token });
      }
      if (req.method === "PUT") {
        const tok = signedTokens.get(url.searchParams.get("token")); if (!tok || tok.bucket !== bucket || tok.name !== name) return send(403, { statusCode: "403", error: "Unauthorized", message: "Invalid token" });
        const info = await bucketInfo(bucket); const type = upType;
        if (info.file_size_limit && raw.length > Number(info.file_size_limit)) return send(413, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
        if (info.allowed_mime_types && !info.allowed_mime_types.includes(type)) return send(415, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${type} is not supported` });
        files.set(`${bucket}/${name}`, { type, body: raw }); signedTokens.delete(url.searchParams.get("token"));
        await pool.query("insert into storage.objects(bucket_id,name) values ($1,$2)", [bucket, name]);
        return send(200, { Key: `${bucket}/${name}` });
      }
    }
    if ((m = path.match(/^\/object\/([^/]+)\/(.+)$/)) && req.method === "POST") {
      const bucket = m[1], name = decodeURIComponent(m[2]); const info = await bucketInfo(bucket); const type = upType;
      if (info?.allowed_mime_types && !info.allowed_mime_types.includes(type)) return send(415, { statusCode: "415", error: "invalid_mime_type", message: "mime type not supported" });
      if (!(await canInsert(role, claims, bucket, name))) return send(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      files.set(`${bucket}/${name}`, { type, body: raw }); await pool.query("insert into storage.objects(bucket_id,name) values ($1,$2)", [bucket, name]);
      return send(200, { Key: `${bucket}/${name}` });
    }
    if ((m = path.match(/^\/object\/([^/]+)$/)) && req.method === "DELETE") {
      for (const p of JSON.parse(raw.toString() || "{}").prefixes ?? []) { files.delete(`${m[1]}/${p}`); await pool.query("delete from storage.objects where bucket_id=$1 and name=$2", [m[1], p]); }
      return send(200, []);
    }
  } catch (e) { return send(e.status ?? 500, { message: e.message }); }
  return send(404, { message: `Storage route non gérée : ${req.method} ${path}` });
}

/* ---------------- Serveur ---------------- */
export function startMock(port = 54321) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") return empty(res, 204);
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const chunks = []; for await (const ch of req) chunks.push(ch); const raw = Buffer.concat(chunks);
      let body = null; if (raw.length && (req.headers["content-type"] ?? "").includes("json")) { try { body = JSON.parse(raw.toString()); } catch { body = null; } }
      if (process.env.MOCK_LOG) console.log(req.method, url.pathname + url.search);
      if (url.pathname.startsWith("/__vehicle_img/")) {   // images de test pour la liste des véhicules (mise en page uniquement)
        const slug = decodeURIComponent(url.pathname.split("/").pop()); let h = 0; for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        const sharp = (await import("sharp")).default;
        const png = await sharp({ create: { width: 640, height: 400, channels: 3, background: { r: 40 + (h % 80), g: 50 + ((h >> 8) % 60), b: 60 + ((h >> 16) % 90) } } })
          .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect x="120" y="190" width="400" height="90" rx="40" fill="#e8e8e8" opacity=".9"/><rect x="190" y="130" width="260" height="80" rx="34" fill="#f4f4f4"/><circle cx="210" cy="285" r="38" fill="#111"/><circle cx="430" cy="285" r="38" fill="#111"/></svg>`) }]).png().toBuffer();
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length }); return res.end(png);
      }
      if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url, body ?? {});
      if (url.pathname.startsWith("/rest/v1/")) return await rest(req, res, url, body);
      if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url, raw);
      json(res, 404, { message: "not found" });
    } catch (e) { console.error("[mock]", e); json(res, 500, { message: String(e) }); }
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
if (process.argv[1]?.endsWith("mock-supabase.mjs")) startMock().then(() => console.log("mock Supabase sur :54321"));
