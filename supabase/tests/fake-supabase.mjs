#!/usr/bin/env node
/**
 * Supabase de pruebas, local y sin dependencias (solo para tests; nunca en producción):
 *  - /auth/v1     GoTrue mínimo: alta con confirmación automática, entrar con contraseña, refrescar, usuario, salir.
 *  - /rest/v1     proxy a un PostgREST real conectado a la base con la migración de Spotly.
 *  - /storage/v1  subir, URL pública, URL firmada (también por lotes), listar y borrar. Cada operación pasa por
 *                 test_api.* con el JWT de quien la pide, así se aplican las políticas RLS reales de storage.objects.
 *  - /realtime    no se emula: la app debe seguir funcionando sin tiempo real (vuelve a pedir los hilos).
 *
 * Variables: FAKE_PORT (54321), PGRST_URL (http://127.0.0.1:3010), JWT_SECRET (el mismo que PostgREST),
 * TEST_PASSWORD (contraseña de las cuentas creadas fuera de este servidor), KEYS_FILE (escribe la anon key en JSON).
 */
import http from "node:http";
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.FAKE_PORT || 54321);
const PGRST = process.env.PGRST_URL || "http://127.0.0.1:3010";
const SECRET = process.env.JWT_SECRET || "spotly-local-test-secret-0123456789abcdef";
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD || "Spotly1234";

const b64u = (v) => Buffer.from(v).toString("base64url");
function sign(payload) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" })), body = b64u(JSON.stringify(payload));
  return `${head}.${body}.${crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
function verify(token) {
  try {
    const [h, p, s] = String(token).split(".");
    const good = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
    if (!s || good.length !== s.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(s))) return null;
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    if (claims.exp && claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
}
const now = () => Math.floor(Date.now() / 1000);
const ANON_KEY = sign({ role: "anon", iss: "spotly-test", iat: 1700000000, exp: 2000000000 });
const SERVICE_KEY = sign({ role: "service_role", iss: "spotly-test", iat: 1700000000, exp: 2000000000 });
if (process.env.KEYS_FILE) writeFileSync(process.env.KEYS_FILE, JSON.stringify({ url: `http://127.0.0.1:${PORT}`, anonKey: ANON_KEY, serviceKey: SERVICE_KEY }));

const BUCKETS = {
  voces: { public: true, max: 10485760, types: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/wav", "audio/x-m4a"] },
  media: { public: true, max: 52428800, types: ["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/webm", "video/quicktime"] },
  perfiles: { public: true, max: 5242880, types: ["image/jpeg", "image/png", "image/webp"] },
  chats: { public: false, max: 10485760, types: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/wav", "audio/x-m4a"] },
};
const files = new Map(); // "cubo/ruta" → { bytes, type }
const passwords = new Map(); // email → contraseña (las cuentas creadas aquí)
const refreshTokens = new Map(); // token → user id
const stats = { uploads: 0, rest: 0 };

async function rpc(fn, args, jwt = SERVICE_KEY, schema = "test_api") {
  const r = await fetch(`${PGRST}/rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Profile": schema, "Accept-Profile": schema, Authorization: `Bearer ${jwt}` }, body: JSON.stringify(args) });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}
const userJson = (row) => ({
  id: row.id, aud: "authenticated", role: "authenticated", email: row.email, phone: "", email_confirmed_at: new Date(0).toISOString(), confirmed_at: new Date(0).toISOString(),
  last_sign_in_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: row.meta ?? {}, identities: [], created_at: new Date(0).toISOString(), updated_at: new Date().toISOString(), is_anonymous: false,
});
function session(user) {
  const iat = now(), exp = iat + 3600;
  const access_token = sign({ aud: "authenticated", exp, iat, sub: user.id, email: user.email, role: "authenticated", app_metadata: user.app_metadata, user_metadata: user.user_metadata, session_id: crypto.randomUUID(), is_anonymous: false });
  const refresh_token = crypto.randomBytes(18).toString("base64url");
  refreshTokens.set(refresh_token, user.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token, user };
}

/* ───────── utilidades HTTP ───────── */
const readBody = (req) => new Promise((resolve, reject) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject); });
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range, x-upsert, cache-control, x-supabase-api-version");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Location, Location, X-Total-Count, Content-Length, Accept-Ranges");
}
const send = (res, status, body, type = "application/json") => { res.statusCode = status; if (body === undefined || body === null) { res.end(); return; } res.setHeader("Content-Type", type); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const bearer = (req) => { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7) : null; };
const json = (buf) => { try { return buf.length ? JSON.parse(buf.toString("utf8")) : {}; } catch { return {}; } };

/** Primer archivo de un multipart/form-data (lo que envía storage-js al subir un Blob). */
function multipartFile(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) return null;
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    const next = buf.indexOf(boundary, pos + boundary.length);
    if (next === -1) break;
    const part = buf.subarray(pos + boundary.length + 2, next - 2); // sin \r\n inicial ni final
    const sep = part.indexOf("\r\n\r\n");
    if (sep !== -1) {
      const head = part.subarray(0, sep).toString("utf8");
      if (/filename=/i.test(head) || /name=""/i.test(head)) {
        const type = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() || "application/octet-stream";
        return { bytes: part.subarray(sep + 4), type };
      }
    }
    pos = next;
  }
  return null;
}
function sendFile(req, res, f) {
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store");
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range) {
    const size = f.bytes.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2] || 0));
    const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    if (start >= size || start > end) { res.setHeader("Content-Range", `bytes */${size}`); return send(res, 416, ""); }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Type", f.type);
    res.setHeader("Content-Length", String(end - start + 1));
    return res.end(req.method === "HEAD" ? undefined : f.bytes.subarray(start, end + 1));
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", f.type);
  res.setHeader("Content-Length", String(f.bytes.length));
  res.end(req.method === "HEAD" ? undefined : f.bytes);
}
const signToken = (key, exp) => crypto.createHmac("sha256", SECRET).update(`${key}|${exp}`).digest("base64url");

/* ───────── Auth ───────── */
async function auth(req, res, path, url) {
  const body = req.method === "GET" ? {} : json(await readBody(req));
  if (path === "/signup" && req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !body.password) return send(res, 422, { code: 422, error_code: "validation_failed", msg: "Signup requires a valid password" });
    const found = await rpc("user_by_email", { p_email: email });
    if (found.ok && found.body?.length) return send(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
    const created = await rpc("create_user", { p_email: email, p_meta: body.data ?? {} });
    if (!created.ok) return send(res, 500, { code: 500, error_code: "unexpected_failure", msg: "Database error saving new user" });
    passwords.set(email, String(body.password));
    return send(res, 200, session(userJson({ id: created.body, email, meta: body.data ?? {} })));
  }
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const email = String(body.email || "").trim().toLowerCase();
      const found = await rpc("user_by_email", { p_email: email });
      const row = found.ok ? found.body?.[0] : null;
      if (!row || String(body.password) !== (passwords.get(email) ?? DEFAULT_PASSWORD)) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials", error: "invalid_grant", error_description: "Invalid login credentials" });
      return send(res, 200, session(userJson(row)));
    }
    if (grant === "refresh_token") {
      const uid = refreshTokens.get(String(body.refresh_token));
      if (!uid) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
      refreshTokens.delete(String(body.refresh_token));
      const found = await rpc("user_by_id", { p_id: uid });
      const row = found.ok ? found.body?.[0] : null;
      if (!row) return send(res, 400, { code: 400, error_code: "user_not_found", msg: "User not found" });
      return send(res, 200, session(userJson(row)));
    }
    return send(res, 400, { code: 400, error_code: "unsupported_grant_type", msg: "Unsupported grant type" });
  }
  if (path === "/user") {
    const claims = verify(bearer(req));
    if (!claims?.sub) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    if (req.method === "PUT") {
      const meta = await rpc("update_user_meta", { p_id: claims.sub, p_meta: body.data ?? {} });
      if (!meta.ok) return send(res, 404, { code: 404, error_code: "user_not_found", msg: "User not found" });
    }
    const found = await rpc("user_by_id", { p_id: claims.sub });
    const row = found.ok ? found.body?.[0] : null;
    if (!row) return send(res, 403, { code: 403, error_code: "user_not_found", msg: "User from sub claim in JWT does not exist" });
    return send(res, 200, userJson(row));
  }
  if (path === "/logout") return send(res, 204, null);
  if (path === "/settings") return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
  return send(res, 404, { code: 404, error_code: "not_found", msg: `No emulado: ${path}` });
}

/* ───────── Storage ───────── */
async function storage(req, res, path, url) {
  const token = bearer(req);
  const claims = token ? verify(token) : null;
  const parts = path.split("/").filter(Boolean); // ["object", ...]
  if (parts[0] !== "object") return send(res, 404, { statusCode: "404", error: "not_found", message: "No emulado" });
  const decode = (p) => p.split("/").map((s) => decodeURIComponent(s)).join("/");

  // GET /object/public/:bucket/*  ·  GET /object/sign/:bucket/*?token=
  if ((req.method === "GET" || req.method === "HEAD") && (parts[1] === "public" || parts[1] === "sign")) {
    const bucket = parts[2], name = decode(parts.slice(3).join("/"));
    const f = files.get(`${bucket}/${name}`);
    if (parts[1] === "public" && !BUCKETS[bucket]?.public) return send(res, 400, { statusCode: "404", error: "not_found", message: "Bucket not found" });
    if (parts[1] === "sign") {
      const exp = Number(url.searchParams.get("exp") || 0), t = url.searchParams.get("token") || "";
      if (exp < now() || t !== signToken(`${bucket}/${name}`, exp)) return send(res, 400, { statusCode: "400", error: "InvalidSignature", message: "Invalid signature" });
    }
    if (!f) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    return sendFile(req, res, f);
  }
  if (!claims || claims.role === "anon") return send(res, 400, { statusCode: "403", error: "Unauthorized", message: "Invalid JWT" });

  // POST /object/sign/:bucket  (lote) · POST /object/sign/:bucket/*  (uno)
  if (req.method === "POST" && parts[1] === "sign") {
    const bucket = parts[2];
    const body = json(await readBody(req));
    const exp = now() + Math.max(1, Math.min(604800, Number(body.expiresIn) || 60));
    const one = async (name) => {
      const can = await rpc("storage_can_read", { p_bucket: bucket, p_name: name }, token);
      if (!can.ok || can.body !== true || !files.has(`${bucket}/${name}`)) return { path: name, signedURL: null, error: "Either the object does not exist or you do not have access to it" };
      return { path: name, signedURL: `/object/sign/${bucket}/${name}?token=${signToken(`${bucket}/${name}`, exp)}&exp=${exp}`, error: null };
    };
    if (parts.length === 3) return send(res, 200, await Promise.all((body.paths || []).map((p) => one(String(p)))));
    const r = await one(decode(parts.slice(3).join("/")));
    return r.error ? send(res, 400, { statusCode: "404", error: "not_found", message: r.error }) : send(res, 200, { signedURL: r.signedURL });
  }
  // POST /object/list/:bucket
  if (req.method === "POST" && parts[1] === "list") {
    const bucket = parts[2];
    const body = json(await readBody(req));
    const prefix = String(body.prefix || "").replace(/\/+$/, "");
    const r = await rpc("storage_list", { p_bucket: bucket, p_prefix: prefix }, token);
    if (!r.ok) return send(res, 400, { statusCode: "400", error: "list_failed", message: JSON.stringify(r.body) });
    return send(res, 200, (r.body || []).slice(Number(body.offset) || 0, (Number(body.offset) || 0) + (Number(body.limit) || 100)).map((o) => ({ name: o.name.slice(prefix.length + 1), id: o.id, created_at: o.created_at, updated_at: o.created_at, last_accessed_at: o.created_at, metadata: { size: files.get(`${bucket}/${o.name}`)?.bytes.length ?? 0 } })));
  }
  // DELETE /object/:bucket  { prefixes: [...] }
  if (req.method === "DELETE" && parts.length === 2) {
    const bucket = parts[1];
    const body = json(await readBody(req));
    const removed = [];
    for (const name of body.prefixes || []) {
      const r = await rpc("storage_delete", { p_bucket: bucket, p_name: String(name) }, token);
      if (r.ok && r.body > 0) { files.delete(`${bucket}/${name}`); removed.push({ name, bucket_id: bucket }); }
    }
    return send(res, 200, removed);
  }
  // POST|PUT /object/:bucket/*  (subir)
  if ((req.method === "POST" || req.method === "PUT") && parts.length >= 3) {
    const bucket = parts[1], name = decode(parts.slice(2).join("/"));
    const cfg = BUCKETS[bucket];
    if (!cfg) return send(res, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
    const raw = await readBody(req);
    const ct = String(req.headers["content-type"] || "");
    const file = ct.startsWith("multipart/form-data") ? multipartFile(raw, ct) : { bytes: raw, type: ct.split(";")[0].trim() || "application/octet-stream" };
    if (!file) return send(res, 400, { statusCode: "400", error: "invalid_body", message: "Sin archivo" });
    const type = file.type.split(";")[0].trim().toLowerCase();
    if (!cfg.types.includes(type)) return send(res, 400, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${type} is not supported` });
    if (file.bytes.length > cfg.max) return send(res, 400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
    if (files.has(`${bucket}/${name}`)) return send(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    const r = await rpc("storage_insert", { p_bucket: bucket, p_name: name }, token);
    if (!r.ok) return send(res, 400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    files.set(`${bucket}/${name}`, { bytes: Buffer.from(file.bytes), type });
    stats.uploads++;
    return send(res, 200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() });
  }
  return send(res, 404, { statusCode: "404", error: "not_found", message: `No emulado: ${req.method} ${path}` });
}

/* ───────── REST (proxy a PostgREST) ───────── */
async function rest(req, res, path, url) {
  stats.rest++;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!["host", "connection", "content-length", "apikey", "origin", "referer"].includes(k) && v !== undefined) headers[k] = Array.isArray(v) ? v.join(", ") : v;
  const token = bearer(req);
  if (token && !verify(token)) return send(res, 401, { code: "PGRST301", message: "JWT expired or invalid" });
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const r = await fetch(`${PGRST}${path}${url.search}`, { method: req.method, headers, body });
  res.statusCode = r.status;
  for (const [k, v] of r.headers) if (!["content-encoding", "transfer-encoding", "connection", "content-length"].includes(k)) res.setHeader(k, v);
  res.end(Buffer.from(await r.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return send(res, 204, null);
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname === "/__health") return send(res, 200, { ok: true, ...stats });
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url.pathname.slice(8), url);
    if (url.pathname.startsWith("/rest/v1")) return await rest(req, res, url.pathname.slice(8) || "/", url);
    if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url.pathname.slice(11), url);
    return send(res, 404, { message: "No emulado" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { message: String(e?.message || e) });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`fake-supabase en http://127.0.0.1:${PORT} → PostgREST ${PGRST}`));
