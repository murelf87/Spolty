"""Prueba de extremo a extremo de Spotly con la nube (lo lanza run-e2e.sh).

Dos personas en dos navegadores con micrófono simulado de Chromium, contra un Supabase local con la migración real:
  1. Ana entra con su correo y publica un Spot solo con voz y título.
  2. Beto lo ve en Inicio, lo escucha (cuenta una vista), le da me gusta y responde con su voz.
  3. Beto abre el perfil de Ana, la sigue y le manda un mensaje de voz privado.
  4. Ana ve la respuesta en los comentarios, su seguidor nuevo y el chat con la nota de Beto, y la escucha.
Uso: python3 -I e2e_cloud.py <url_app> <url_supabase> <keys.json> <carpeta_capturas>
"""
import json, sys, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

APP, SUPA, KEYS, OUT = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3], Path(sys.argv[4])
OUT.mkdir(parents=True, exist_ok=True)
keys = json.load(open(KEYS))
PASSWORD = "Spotly-e2e-1"
results, errors = [], []


def http(method, path, body=None, token=None):
    req = urllib.request.Request(SUPA + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "apikey": keys["anonKey"], "Authorization": f"Bearer {token or keys['anonKey']}"})
    with urllib.request.urlopen(req) as r:
        text = r.read()
        return json.loads(text) if text else None


def step(name, ok, extra=""):
    results.append({"paso": name, "ok": bool(ok), "detalle": extra})
    print(("OK   " if ok else "FALLA"), name, extra, flush=True)


people = {}
for email, user, name in [("ana@spotly.test", "ana_s", "Ana"), ("beto@spotly.test", "beto", "Beto")]:
    s = http("POST", "/auth/v1/signup", {"email": email, "password": PASSWORD, "data": {"username": user, "full_name": name, "onboarded": True}})
    http("PATCH", f"/rest/v1/profiles?id=eq.{s['user']['id']}", {"city": "Sevilla"}, s["access_token"])
    people[name] = {"email": email, "id": s["user"]["id"], "token": s["access_token"]}


def login(page, email):
    page.goto(APP, wait_until="load")
    page.get_by_role("button", name="Iniciar sesión").first.wait_for(timeout=45000)
    page.get_by_role("button", name="Iniciar sesión").first.click()
    page.fill("#email", email)
    page.fill("#pass", PASSWORD)
    page.press("#pass", "Enter")
    page.locator('nav[aria-label="Navegación principal"]').wait_for(timeout=30000)
    page.wait_for_timeout(2500)


def attempt(name, fn):
    """Cada paso devuelve None/True si va bien; False o un texto (lo que se encontró) si no, o lanza una excepción."""
    try:
        r = fn()
        step(name, r is None or r is True, "" if r in (None, True) else f"encontrado: {r}")
    except Exception as e:  # noqa: BLE001 - se registra y se sigue con el resto
        step(name, False, str(e).splitlines()[0][:220])


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])

    def new_page(tag):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, permissions=["microphone", "camera"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {str(e)[:300]}"))
        page.on("console", lambda m: errors.append(f"[{tag}] console: {m.text[:300]}") if m.type == "error" and "realtime" not in m.text.lower() and "websocket" not in m.text.lower() else None)
        return page

    shot = lambda page, n: page.screenshot(path=str(OUT / f"{n}.png"))

    # ── 1. Ana publica un Spot de voz ──
    pa = new_page("Ana")
    attempt("Ana entra con su correo", lambda: login(pa, people["Ana"]["email"]))
    shot(pa, "01-ana-inicio")

    def publish():
        pa.click('button[aria-label="Crear Spot"]')
        pa.get_by_text("Solo voz", exact=True).first.click()
        mic = pa.locator('button[aria-label="Mantener pulsado para grabar audio"]')
        mic.wait_for(timeout=10000)
        box = mic.bounding_box()
        pa.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pa.mouse.down(); pa.wait_for_timeout(2800); pa.mouse.up()
        pa.locator('button[aria-label="Usar este audio"]:not([disabled])').wait_for(timeout=10000)
        shot(pa, "02-ana-grabado")
        pa.click('button[aria-label="Usar este audio"]')
        pa.fill('input[placeholder^="Ej.: Concierto"]', "Concierto sorpresa en la Alameda")
        pa.get_by_role("button", name="PUBLICAR SPOT").click()
        pa.get_by_text("¡Publicado!").wait_for(timeout=30000)
        shot(pa, "03-ana-publicado")
        pa.get_by_role("button", name="Ver mi Spot").click()
        pa.wait_for_timeout(1500)
    attempt("Ana publica un Spot solo con voz y título", publish)
    attempt("el Spot está en la nube con su autora", lambda: (lambda rows: (len(rows) == 1 and rows[0]["author_name"] == "Ana" and rows[0]["duration_ms"] >= 800) or rows)(http("GET", "/rest/v1/spots_public?select=id,title,author_name,duration_ms&title=eq.Concierto%20sorpresa%20en%20la%20Alameda", token=people["Beto"]["token"])))
    attempt("Ana ve su Spot arriba en Inicio", lambda: pa.locator('section[aria-label="Spot de Ana"]').first.wait_for(timeout=15000))
    shot(pa, "04-ana-feed")

    # ── 2. Beto lo ve, lo escucha, le da me gusta y responde ──
    pb = new_page("Beto")
    attempt("Beto entra con su correo", lambda: login(pb, people["Beto"]["email"]))
    card = pb.locator('section[aria-label="Spot de Ana"]').first
    attempt("Beto ve el Spot de Ana en Inicio", lambda: card.wait_for(timeout=20000))
    card.scroll_into_view_if_needed()
    pb.wait_for_timeout(800)
    shot(pb, "05-beto-ve-el-spot")

    def listen():
        card.locator('button[aria-label="Escuchar el audio de Ana"]').click()
        card.locator('button[aria-label="Pausar el audio de Ana"]').wait_for(timeout=4000)  # suena de verdad
        pb.wait_for_timeout(3500)  # hasta el final del audio
        return card.locator('button[aria-label="Escuchar el audio de Ana"]').count() == 1 or "no terminó"
    attempt("Beto escucha el audio real de Ana", listen)

    def like():
        card.locator('button[aria-label^="Me gusta"]').click()
        pb.wait_for_timeout(1500)
        likes = http("GET", "/rest/v1/spots_public?select=likes&title=eq.Concierto%20sorpresa%20en%20la%20Alameda", token=people["Ana"]["token"])
        return (card.locator('button[aria-label="Me gusta (1)"]').count() == 1 and likes[0]["likes"] == 1) or likes
    attempt("Beto le da me gusta (1)", like)

    def reply():
        card.locator('button[aria-label^="Responder con tu voz"]').click()
        pb.click('button[aria-label="Grabar con el micrófono"]')
        pb.wait_for_timeout(2400)
        shot(pb, "06-beto-grabando-respuesta")
        pb.click('button[aria-label="Enviar respuesta de voz"]')
        pb.get_by_text("Respuesta enviada").wait_for(timeout=20000)
        pb.get_by_role("button", name="Listo").click()
        pb.wait_for_timeout(2500)
    attempt("Beto responde con su voz", reply)
    def own_reply_plays():
        card.locator(".spot-card-media").click()
        pb.get_by_role("button", name="Ver comentarios de voz (1)").click()
        pb.locator('article[aria-label^="Voz de Beto"] button[aria-label="Escuchar la voz de Beto"]').first.click()
        pb.locator('button[aria-label="Pausar la voz de Beto"]').first.wait_for(timeout=4000)
        shot(pb, "06b-beto-escucha-su-respuesta")
        pb.get_by_role("button", name="Cerrar comentarios").click()
        pb.get_by_role("button", name="Volver").first.click()
        pb.wait_for_timeout(600)
    attempt("Beto escucha su propia respuesta al momento", own_reply_plays)
    attempt("la respuesta está en la nube", lambda: (lambda rows: len(rows) == 1 and rows[0]["author_name"] == "Beto" or rows)(http("GET", "/rest/v1/voice_notes_public?select=id,author_name,thread_id&thread_id=like.spot:*", token=people["Ana"]["token"])))

    def follow_and_message():
        card.locator('button[aria-label="Ver el perfil de Ana"]').click()
        pb.get_by_text("@ana_s").first.wait_for(timeout=15000)
        shot(pb, "07-beto-perfil-de-ana")
        pb.get_by_role("button", name="Seguir", exact=True).first.click()
        pb.get_by_role("button", name="Siguiendo", exact=True).first.wait_for(timeout=10000)
        pb.get_by_role("button", name="Mensaje de voz").first.click()
        pb.click('button[aria-label="Grabar con el micrófono"]')
        pb.wait_for_timeout(2400)
        pb.click('button[aria-label="Enviar mensaje de voz"]')
        pb.get_by_text("Mensaje enviado").wait_for(timeout=20000)
        shot(pb, "08-beto-mensaje-enviado")
        pb.get_by_role("button", name="Listo").click()
        pb.wait_for_timeout(2500)
    attempt("Beto sigue a Ana y le manda un mensaje de voz", follow_and_message)
    attempt("el seguimiento y el chat están en la nube", lambda: (lambda prof, chats: prof[0]["followers"] == 1 and len(chats) == 1 or (prof, chats))(
        http("GET", f"/rest/v1/profiles_public?select=followers&id=eq.{people['Ana']['id']}", token=people["Ana"]["token"]),
        http("GET", "/rest/v1/my_chats?select=id,last_at", token=people["Ana"]["token"])))

    # ── 3. Ana recibe todo ──
    def ana_sees_reply():
        pa.reload(wait_until="load")
        pa.locator('nav[aria-label="Navegación principal"]').wait_for(timeout=30000)
        own = pa.locator('section[aria-label="Spot de Ana"]').first
        own.wait_for(timeout=20000)
        own.scroll_into_view_if_needed(); pa.wait_for_timeout(800)
        count = own.locator('button[aria-label^="Responder con tu voz"]').get_attribute("aria-label")
        shot(pa, "09-ana-feed-con-respuesta")
        own.locator(".spot-card-media").click()
        pa.get_by_role("button", name="Ver comentarios de voz (1)").wait_for(timeout=15000)
        pa.get_by_role("button", name="Ver comentarios de voz (1)").click()
        pa.locator('article[aria-label^="Voz de Beto"]').first.wait_for(timeout=15000)
        shot(pa, "10-ana-comentarios")
        pa.locator('article[aria-label^="Voz de Beto"] button[aria-label="Escuchar la voz de Beto"]').first.click()
        pa.locator('button[aria-label="Pausar la voz de Beto"]').first.wait_for(timeout=4000)  # suena de verdad
        pa.wait_for_timeout(800)
        pa.get_by_role("button", name="Cerrar comentarios").click()
        pa.get_by_role("button", name="Volver").first.click()
        return count == "Responder con tu voz (1 respuestas)" or count
    attempt("Ana ve y escucha la respuesta de Beto", ana_sees_reply)

    def ana_profile():
        pa.locator('nav[aria-label="Navegación principal"] button:has-text("Perfil")').click()
        pa.wait_for_timeout(2500)
        shot(pa, "11-ana-perfil")
        followers = pa.locator('button:has(small:text-is("Seguidores"))').first.inner_text().split()
        return followers[0] == "1" or followers
    attempt("Ana tiene 1 seguidor en su perfil", ana_profile)

    def ana_views():
        pa.locator('button:has(small:text("Spots"))').first.click()
        pa.wait_for_timeout(1200)
        shot(pa, "12-ana-vistas")
        import re
        txt = pa.locator('[role="dialog"]').last.inner_text()
        m = re.search(r"(\d+)\s*vistas", txt)
        pa.keyboard.press("Escape")
        return (m is not None and m.group(1) == "1") or txt[:200]
    attempt("su Spot cuenta la vista de Beto", ana_views)

    def ana_chat():
        pa.goto(APP, wait_until="load")
        pa.locator('nav[aria-label="Navegación principal"]').wait_for(timeout=30000)
        pa.wait_for_timeout(1500)
        pa.locator('nav[aria-label="Navegación principal"] button:has-text("Chats")').click()
        pa.get_by_role("button", name="Beto").first.wait_for(timeout=20000)
        shot(pa, "13-ana-chats")
        pa.get_by_role("button", name="Beto").first.click()
        pa.locator('button[aria-label^="Reproducir la nota de voz de Beto"]').first.wait_for(timeout=20000)
        pa.locator('button[aria-label^="Reproducir la nota de voz de Beto"]').first.click()
        pa.locator('button[aria-label^="Pausar la nota de voz de Beto"]').first.wait_for(timeout=4000)  # suena de verdad
        pa.wait_for_timeout(700)
        shot(pa, "14-ana-chat-con-beto")
    attempt("Ana recibe el mensaje privado de Beto y lo escucha", ana_chat)

    browser.close()

ok = sum(1 for r in results if r["ok"])
(OUT / "informe.json").write_text(json.dumps({"pasos": results, "errores_consola": errors}, ensure_ascii=False, indent=2))
print(f"\n{ok}/{len(results)} pasos correctos · {len(errors)} errores de consola")
for e in errors[:15]:
    print("  ", e)
sys.exit(0 if ok == len(results) else 1)
