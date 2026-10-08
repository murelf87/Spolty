/**
 * Pruebas de src/lib/cloud/api.ts contra un Supabase local (PostgREST real + fake-supabase.mjs con las políticas
 * RLS reales). Lo lanza supabase/tests/run-api-tests.sh. Recorre lo que hace la app entre dos o tres personas:
 * perfil, publicar, feed, vistas, me gusta, voces encadenadas, seguidores, chats privados, grupos, bloqueos,
 * denuncias, Incógnito y borrar la cuenta.
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as api from "../../src/lib/cloud/api";

const keys = JSON.parse(readFileSync(process.env.KEYS_FILE ?? "keys.json", "utf8")) as { url: string; anonKey: string; serviceKey: string };
let passed = 0;
const failures: string[] = [];
async function check(label: string, fn: () => Promise<boolean | void> | boolean | void) {
  try {
    const r = await fn();
    if (r === false) throw new Error("condición falsa");
    passed++; console.log(`ok  ${label}`);
  } catch (e) { failures.push(label); console.log(`FALLA  ${label}: ${(e as Error).message}`); }
}
async function rejects(label: string, code: string, fn: () => Promise<unknown>) {
  await check(label, async () => {
    try { await fn(); } catch (e) {
      const got = e instanceof api.CloudError ? e.code : (e as Error).message;
      if (got !== code && !(e as Error).message.includes(code)) throw new Error(`esperaba ${code}, llegó ${got}: ${(e as Error).message}`);
      return;
    }
    throw new Error(`debía fallar con ${code}`);
  });
}
const newClient = () => createClient(keys.url, keys.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
async function person(email: string, username?: string) {
  const c = newClient();
  const { data, error } = await c.auth.signUp({ email, password: "Spotly-test-1", options: { data: username ? { username } : { full_name: email.split("@")[0] } } });
  if (error || !data.user) throw new Error(`alta ${email}: ${error?.message}`);
  return { c: c as unknown as SupabaseClient, id: data.user.id };
}
/** Un audio «webm» de verdad no hace falta: el servidor solo mira el tipo y el tamaño. */
const audio = (n = 2048) => new Blob([new Uint8Array(n).fill(7)], { type: "audio/webm;codecs=opus" });
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])], { type: "image/jpeg" });

const ana = await person("ana@spotly.test", "ana_s");
const beto = await person("beto@spotly.test", "beto");
const carla = await person("carla@spotly.test");

await check("la migración está aplicada (probe = ready)", async () => (await api.probe(ana.c)) === "ready");
await check("perfil creado al registrarse con su usuario", async () => (await api.fetchProfile(ana.c, ana.id))?.username === "ana_s");
await check("Apple/Google: usuario provisional", async () => /^u[0-9a-f]{11}$/.test((await api.fetchProfile(carla.c, carla.id))?.username ?? ""));
await check("nombre de usuario ocupado / libre", async () => !(await api.usernameAvailable(beto.c, "ana_s")) && (await api.usernameAvailable(beto.c, "nadie_aun")));
await check("ensureProfile no duplica", async () => { await api.ensureProfile(ana.c); return (await api.fetchProfile(ana.c, ana.id))?.username === "ana_s"; });

// Perfil: nombre, ciudad, foto y portada
await check("actualizar nombre y ciudad", async () => { await api.updateProfile(ana.c, ana.id, { display_name: "Ana", city: "Sevilla" }); const p = await api.fetchProfile(beto.c, ana.id); return p?.display_name === "Ana" && p.city === "Sevilla"; });
await check("subir foto de perfil y usarla", async () => {
  const path = await api.uploadProfileImage(ana.c, ana.id, "avatar", jpeg());
  await api.updateProfile(ana.c, ana.id, { avatar_path: path, cover: "preset:aurora" });
  const url = api.publicUrl(beto.c, (await api.fetchProfile(beto.c, ana.id))!.avatar_path);
  const r = await fetch(url!);
  return r.ok && r.headers.get("content-type") === "image/jpeg";
});
await rejects("no subir a la carpeta de otra persona", "upload_failed", () => api.upload(beto.c, "perfiles", `${ana.id}/x.jpg`, jpeg(), "image/jpeg"));
await rejects("usuario repetido al editar", "username_taken", () => api.updateProfile(beto.c, beto.id, { username: "ana_s" }));
await api.updateProfile(beto.c, beto.id, { city: "Sevilla", display_name: "Beto" });

// Publicar y ver en el feed
let spotId = "";
let spotAudio = "";
await check("publicar un Spot con voz y foto", async () => {
  const r = await api.publishSpot(ana.c, ana.id, { title: "Concierto en la Alameda", city: "Sevilla", zone: "Alameda", topic: "Música", visibility: "public", locationHidden: false, anon: false, happeningNow: true, repliesAllowed: true, audio: audio(), audioMime: "audio/webm;codecs=opus", durationMs: 4200, peaks: [0.1, 0.8, 0.4], media: jpeg(), mediaKind: "photo" });
  spotId = r.id; spotAudio = r.audioPath;
  return r.audioPath.startsWith(`voces/${ana.id}/`) && !!r.mediaPath?.startsWith(`media/${ana.id}/`);
});
await check("otra persona lo ve en el feed, con autor y foto", async () => { const f = await api.fetchFeed(beto.c, {}); const s = f.find((x) => x.id === spotId); return !!s && s.author_name === "Ana" && s.media_kind === "photo" && s.peaks?.length === 3; });
await check("el audio del Spot se puede reproducir", async () => { const r = await fetch(api.publicUrl(beto.c, spotAudio)!); return r.ok && r.headers.get("content-type") === "audio/webm" && (await r.arrayBuffer()).byteLength === 2048; });
await check("feed por ciudad", async () => (await api.fetchFeed(beto.c, { city: "Sevilla" })).some((s) => s.id === spotId) && !(await api.fetchFeed(beto.c, { city: "Bilbao" })).length);
await check("tus Spots (perfil)", async () => (await api.fetchMySpots(ana.c)).map((s) => s.id).includes(spotId) && !(await api.fetchMySpots(beto.c)).length);
await check("vistas: una por persona y día; el autor no cuenta", async () => (await api.recordView(beto.c, spotId)) && !(await api.recordView(beto.c, spotId)) && !(await api.recordView(ana.c, spotId)) && (await api.fetchSpot(ana.c, spotId))?.views === 1);
await check("me gusta en un Spot", async () => { await api.setSpotLike(beto.c, beto.id, spotId, true); await api.setSpotLike(beto.c, beto.id, spotId, true); const s = await api.fetchSpot(beto.c, spotId); return s?.likes === 1 && s.liked; });
await check("quitar el me gusta", async () => { await api.setSpotLike(beto.c, beto.id, spotId, false); return (await api.fetchSpot(beto.c, spotId))?.likes === 0; });
await check("guardar para luego (privado)", async () => { await api.setSaved(beto.c, beto.id, spotId, true); const saved = await api.fetchSaved(beto.c, beto.id); const other = await api.fetchSaved(carla.c, carla.id); return saved[0]?.id === spotId && saved[0]!.saved && !other.length && !(await api.fetchSpot(carla.c, spotId))?.saved; });
await check("quitar de guardados", async () => { await api.setSaved(beto.c, beto.id, spotId, false); return !(await api.fetchSaved(beto.c, beto.id)).length; });

// Voces encadenadas
let v1 = "";
await check("responder al Spot con tu voz", async () => { const r = await api.postNote(beto.c, beto.id, { threadId: `spot:${spotId}`, blob: audio(1500), mime: "audio/webm", durationMs: 2100, peaks: [0.3, 0.6] }); v1 = r.id; return r.audioPath.startsWith(`voces/${beto.id}/`); });
await check("la autora oye la respuesta con nombre", async () => { const t = await api.fetchThread(ana.c, `spot:${spotId}`); return t.length === 1 && t[0]!.author_name === "Beto" && !t[0]!.mine; });
await check("respuesta a una respuesta, al segundo exacto", async () => { await api.postNote(ana.c, ana.id, { threadId: `spot:${spotId}`, parentId: v1, replyAtMs: 1300, blob: audio(900), mime: "audio/webm", durationMs: 1800, peaks: [0.5] }); const t = await api.fetchThread(beto.c, `spot:${spotId}`); return t.length === 2 && t[1]!.parent_id === v1 && t[1]!.reply_at_ms === 1300; });
await check("contador de respuestas del Spot", async () => (await api.fetchSpot(carla.c, spotId))?.replies === 2);
await check("me gusta en una voz", async () => { await api.setNoteLike(ana.c, ana.id, v1, true); const n = (await api.fetchThread(ana.c, `spot:${spotId}`)).find((x) => x.id === v1); return n?.likes === 1 && n.liked; });
await rejects("no responder a una voz de otro hilo", "parent_not_in_thread", () => api.postNote(carla.c, carla.id, { threadId: "hot:h1", parentId: v1, blob: audio(), mime: "audio/webm", durationMs: 1000, peaks: [] }));
await check("voces en hilos de lugares, grupos y eventos", async () => { await api.postNote(carla.c, carla.id, { threadId: "group:Música en directo", blob: audio(), mime: "audio/webm", durationMs: 1000, peaks: [] }); return (await api.fetchThread(beto.c, "group:Música en directo")).length === 1; });
await check("borrar tu voz", async () => { const t = await api.fetchThread(beto.c, `spot:${spotId}`); const mine = t.find((x) => x.mine)!; await api.deleteNote(beto.c, mine.id, mine.audio_path); return (await api.fetchThread(beto.c, `spot:${spotId}`)).length === 1; });
await rejects("no borrar la voz de otro", "not_allowed", async () => { const t = await api.fetchThread(carla.c, `spot:${spotId}`); await api.deleteNote(carla.c, t[0]!.id); });

// Presentación y muro
await check("presentación de voz propia", async () => { await api.postNote(ana.c, ana.id, { threadId: `presentacion:${ana.id}`, blob: audio(), mime: "audio/webm", durationMs: 3000, peaks: [] }); return (await api.fetchThread(beto.c, `presentacion:${ana.id}`)).length === 1; });
await rejects("no grabar la presentación de otro", "not_your_thread", () => api.postNote(beto.c, beto.id, { threadId: `presentacion:${ana.id}`, blob: audio(), mime: "audio/webm", durationMs: 3000, peaks: [] }));
await check("dejar una voz en el muro de alguien y que la borre su dueña", async () => { const r = await api.postNote(beto.c, beto.id, { threadId: `muro:${ana.id}`, blob: audio(), mime: "audio/webm", durationMs: 1200, peaks: [] }); await api.deleteNote(ana.c, r.id); return (await api.fetchThread(ana.c, `muro:${ana.id}`)).length === 0; });
await check("soporte: solo lo oye quien lo envía", async () => { await api.postNote(carla.c, carla.id, { threadId: `soporte:${carla.id}`, blob: audio(), mime: "audio/webm", durationMs: 1200, peaks: [] }); return (await api.fetchThread(carla.c, `soporte:${carla.id}`)).length === 1 && (await api.fetchThread(beto.c, `soporte:${carla.id}`)).length === 0; });

// Historias de 24 h
await check("publicar una historia con foto y verla", async () => { const r = await api.publishStory(beto.c, beto.id, { city: "Sevilla", audio: audio(), audioMime: "audio/webm", durationMs: 3200, peaks: [0.4], photo: jpeg() }); const l = await api.fetchStories(ana.c); const st = l.find((x) => x.id === r.id); return !!st && st.author_username === "beto" && !!st.media_path && !st.mine && (await api.fetchStories(beto.c)).some((x) => x.id === r.id && x.mine); });
await check("historia sobre un fondo de Spotly y borrarla", async () => { const r = await api.publishStory(beto.c, beto.id, { city: "Sevilla", audio: audio(), audioMime: "audio/webm", durationMs: 2000, peaks: [], background: "preset:aurora" }); const st = (await api.fetchStories(ana.c)).find((x) => x.id === r.id); await api.deleteStory(beto.c, r.id, [r.audioPath]); return st?.background === "preset:aurora" && !(await api.fetchStories(ana.c)).some((x) => x.id === r.id); });

// Seguidores
await check("seguir y ver seguidores / seguidos", async () => { await api.setFollow(beto.c, beto.id, ana.id, true); const followers = await api.fetchPeople(ana.c, ana.id, "followers"); const following = await api.fetchPeople(beto.c, beto.id, "following"); return followers[0]?.id === beto.id && following[0]?.id === ana.id && (await api.isFollowing(beto.c, beto.id, ana.id)) && (await api.fetchFollowingIds(beto.c, beto.id)).includes(ana.id); });
await check("contadores del perfil", async () => { const p = await api.fetchProfile(carla.c, ana.id); return p?.followers === 1 && p.spots === 1; });
await check("Spot «solo seguidores»: lo ven sus seguidores", async () => {
  const r = await api.publishSpot(ana.c, ana.id, { title: "Para quien me sigue", city: "Sevilla", zone: "", topic: "Planes", visibility: "followers", locationHidden: true, anon: false, happeningNow: false, repliesAllowed: true, audio: audio(), audioMime: "audio/webm", durationMs: 1500, peaks: [] });
  return (await api.fetchFeed(beto.c, { authorIds: [ana.id] })).some((s) => s.id === r.id) && !(await api.fetchFeed(carla.c, {})).some((s) => s.id === r.id);
});
await check("feed «Suscrito» (de quien sigues)", async () => { const f = await api.fetchFeed(beto.c, { authorIds: await api.fetchFollowingIds(beto.c, beto.id) }); return f.length === 2 && f.every((s) => s.author_id === ana.id); });
await check("feed «España» (lo más escuchado)", async () => (await api.fetchFeed(beto.c, { trending: true }))[0]?.id === spotId);

// Chats
let chat = "";
await check("abrir chat 1 a 1 (y reutilizarlo)", async () => { chat = await api.openDirectChat(beto.c, ana.id); return (await api.openDirectChat(ana.c, beto.id)) === chat; });
await check("nota de voz privada en el chat", async () => { const r = await api.postNote(beto.c, beto.id, { threadId: `chat:${chat}`, blob: audio(1111), mime: "audio/webm", durationMs: 1500, peaks: [0.2] }); return r.audioPath.startsWith(`chats/${chat}/${beto.id}/`); });
await check("la otra persona la oye con URL firmada", async () => { const t = await api.fetchThread(ana.c, `chat:${chat}`); const urls = await api.signMany(ana.c, t.map((n) => n.audio_path)); const r = await fetch(urls.get(t[0]!.audio_path)!); return t.length === 1 && r.ok && (await r.arrayBuffer()).byteLength === 1111; });
await check("un tercero no ve ni firma el chat", async () => { const t = await api.fetchThread(carla.c, `chat:${chat}`); const ana_t = await api.fetchThread(ana.c, `chat:${chat}`); const urls = await api.signMany(carla.c, ana_t.map((n) => n.audio_path)); return t.length === 0 && urls.size === 0; });
await rejects("un tercero no habla en el chat", "upload_failed", () => api.postNote(carla.c, carla.id, { threadId: `chat:${chat}`, blob: audio(), mime: "audio/webm", durationMs: 1500, peaks: [] }));
await check("mis chats con su miembro", async () => { const list = await api.fetchChats(ana.c); return list.length === 1 && list[0]!.members[0]?.id === beto.id && !!list[0]!.last_at; });
let group = "";
await check("grupo de voz donde habla todo el mundo", async () => { group = await api.createGroupChat(ana.c, "Comunidad Triana", [beto.id, carla.id]); await api.postNote(carla.c, carla.id, { threadId: `chat:${group}`, blob: audio(), mime: "audio/webm", durationMs: 1500, peaks: [] }); return (await api.fetchThread(beto.c, `chat:${group}`)).length === 1 && (await api.fetchChats(carla.c)).some((c) => c.id === group && c.is_group); });
await check("salir del grupo", async () => { await api.leaveChat(carla.c, carla.id, group); return !(await api.fetchChats(carla.c)).some((c) => c.id === group); });

// Incógnito (de pago: lo concede el servidor)
await check("sin Incógnito activo", async () => !(await api.hasIncognito(ana.c)));
await rejects("anónimo sin Incógnito", "incognito_required", () => api.publishSpot(ana.c, ana.id, { title: "Cotilleo", city: "Sevilla", zone: "", topic: "", visibility: "public", locationHidden: false, anon: true, happeningNow: true, repliesAllowed: true, audio: audio(), audioMime: "audio/webm", durationMs: 1500, peaks: [] }));
await check("con Incógnito, nadie sabe quién publica (ni por la ruta del audio)", async () => {
  const svc = createClient(keys.url, keys.serviceKey, { auth: { persistSession: false }, db: { schema: "test_api" as "public" } });
  const { error } = await svc.rpc("grant_incognito", { p_user: ana.id, p_minutes: 60 });
  if (error) throw new Error(error.message);
  if (!(await api.hasIncognito(ana.c))) return false;
  const r = await api.publishSpot(ana.c, ana.id, { title: "Cotilleo anónimo", city: "Sevilla", zone: "", topic: "", visibility: "public", locationHidden: false, anon: true, happeningNow: true, repliesAllowed: true, audio: audio(), audioMime: "audio/webm", durationMs: 1500, peaks: [], media: jpeg(), mediaKind: "photo" });
  const s = (await api.fetchFeed(beto.c, {})).find((x) => x.id === r.id);
  return !!s && s.author_id === null && s.author_name === null && s.audio_path.startsWith("voces/anon/") && !!s.media_path?.startsWith("media/anon/") && (await api.fetchMySpots(ana.c)).some((x) => x.id === r.id && x.mine);
});
await rejects("anónimo «solo seguidores» no se permite", "anon_followers", () => api.publishSpot(ana.c, ana.id, { title: "Anónimo para seguidores", city: "Sevilla", zone: "", topic: "", visibility: "followers", locationHidden: false, anon: true, happeningNow: true, repliesAllowed: true, audio: audio(), audioMime: "audio/webm", durationMs: 1500, peaks: [] }));
await check("voz anónima en el grupo", async () => { await api.postNote(ana.c, ana.id, { threadId: `chat:${group}`, anon: true, blob: audio(), mime: "audio/webm", durationMs: 1500, peaks: [] }); const n = (await api.fetchThread(beto.c, `chat:${group}`)).find((x) => x.anon); return !!n && n.author_id === null && n.audio_path.startsWith(`chats/${group}/anon/`); });

// Bloqueos y denuncias
await check("bloquear: desaparece en los dos sentidos y se deja de seguir", async () => { await api.setFollow(carla.c, carla.id, ana.id, true); await api.block(ana.c, ana.id, carla.id, true); return !(await api.fetchFeed(carla.c, {})).some((s) => s.author_id === ana.id) && !(await api.isFollowing(carla.c, carla.id, ana.id)) && (await api.fetchBlocked(ana.c, ana.id))[0]?.id === carla.id; });
await rejects("sin chat con quien te ha bloqueado", "blocked", () => api.openDirectChat(carla.c, ana.id));
await rejects("sin voces en su Spot", "blocked", () => api.postNote(carla.c, carla.id, { threadId: `spot:${spotId}`, blob: audio(), mime: "audio/webm", durationMs: 1500, peaks: [] }));
await check("desbloquear", async () => { await api.block(ana.c, ana.id, carla.id, false); return (await api.fetchFeed(carla.c, {})).some((s) => s.author_id === ana.id); });
await check("denunciar (una vez por contenido)", async () => { await api.report(beto.c, beto.id, "spot", spotId, "Spam o engaño"); await api.report(beto.c, beto.id, "spot", spotId, "Spam o engaño"); return true; });

// Descubrir gente, enlaces y derecho de acceso
await check("personas de tu ciudad", async () => { const l = await api.discoverPeople(carla.c, { city: "Sevilla", exclude: carla.id }); return l.some((p) => p.id === ana.id) && l.some((p) => p.id === beto.id) && !l.some((p) => p.id === carla.id); });
await check("buscar personas por nombre o usuario", async () => (await api.searchPeople(carla.c, "ana")).some((p) => p.id === ana.id) && (await api.searchPeople(carla.c, "@BETO")).some((p) => p.id === beto.id) && !(await api.searchPeople(carla.c, "zzz%,()")).length);
await check("buscar Spots por título o lugar (con texto hablado)", async () => (await api.searchSpots(carla.c, "¿alameda?")).length >= 1 && !(await api.searchSpots(carla.c, "x")).length);
await check("perfil por su usuario (enlaces ?perfil=)", async () => (await api.fetchProfileByUsername(carla.c, "ANA_S"))?.id === ana.id && !(await api.fetchProfileByUsername(carla.c, "nadie_aun")));
await check("tus denuncias con su estado", async () => { const r = await api.fetchMyReports(beto.c, beto.id); return r.length === 1 && r[0]!.status === "review" && !(await api.fetchMyReports(ana.c, ana.id)).length; });
await check("descargar tus datos", async () => { const d = await api.exportMyData(beto.c, beto.id); return d.profile?.username === "beto" && d.voice_notes.length > 0 && d.following.some((p) => p.id === ana.id) && d.chats.length >= 1 && Array.isArray(d.reports); });

// Borrar Spot y cuenta
await check("borrar tu Spot (y su audio)", async () => { const s = (await api.fetchMySpots(ana.c)).find((x) => x.id === spotId)!; await api.deleteSpot(ana.c, spotId, [s.audio_path, s.media_path]); const r = await fetch(api.publicUrl(ana.c, s.audio_path)!); return !(await api.fetchFeed(beto.c, {})).some((x) => x.id === spotId) && !r.ok; });
await check("borrar tu cuenta: perfil, voces y archivos fuera", async () => {
  const before = await api.fetchProfile(beto.c, carla.id);
  const r = await api.deleteMyAccount(carla.c, carla.id);
  return !!before && r === "deleted" && !(await api.fetchProfile(beto.c, carla.id)) && (await api.fetchThread(beto.c, "group:Música en directo")).length === 0;
});

console.log(`\n${passed} correctas, ${failures.length} fallidas`);
if (failures.length) { console.log("Fallan:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("SPOTLY_API_TESTS_OK");
