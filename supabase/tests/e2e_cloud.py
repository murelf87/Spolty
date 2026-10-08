"""Prueba de extremo a extremo de Spotly con la nube (lo lanza run-e2e.sh).

Dos personas en dos navegadores con micrófono simulado de Chromium, contra un Supabase local con la migración real:
  1. Ana entra con su correo y publica un Spot solo con voz y título.
  2. Beto lo ve en Inicio, lo escucha (cuenta una vista), le da me gusta y responde con su voz.
  3. Beto abre el perfil de Ana, la sigue y le manda un mensaje de voz privado.
  4. Ana ve la respuesta en los mensajes de voz del Spot, su seguidor nuevo y el chat con la nota de Beto, y la escucha.
  5. Ana crea una comunidad y un evento con su voz; Beto se une, escucha la presentación, se apunta y oye el flyer.
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


open_pages = []
fails = [0]


def attempt(name, fn):
    """Cada paso devuelve None/True si va bien; False o un texto (lo que se encontró) si no, o lanza una excepción.
    Si falla, guarda una captura de cada navegador abierto para ver qué había en pantalla."""
    try:
        r = fn()
        ok = r is None or r is True
        step(name, ok, "" if ok else f"encontrado: {r}")
    except Exception as e:  # noqa: BLE001 - se registra y se sigue con el resto
        ok = False
        step(name, False, str(e).splitlines()[0][:220])
    if not ok:
        fails[0] += 1
        for i, pg in enumerate(open_pages):
            try: pg.screenshot(path=str(OUT / f"fallo-{fails[0]:02d}-{i}.png"))
            except Exception: pass  # noqa: BLE001


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])

    def new_page(tag):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, permissions=["microphone", "camera"])
        page = ctx.new_page()
        open_pages.append(page)
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
        # «Voz» abre los mensajes de voz del Spot con el panel pegado al audio original, ya grabando.
        card.locator('button[aria-label="Responder con tu voz"]').click()
        dlg = pb.locator('[role="dialog"][aria-label="Mensajes de voz"]').last
        pb.locator('button[aria-label="Parar y escuchar antes de enviar"]').wait_for(timeout=10000)  # se abre grabando
        pb.wait_for_timeout(2400)
        shot(pb, "06-beto-grabando-respuesta")
        dlg.locator('button[aria-label="Enviar voz"]').click()
        # subida terminada: el play de su voz deja de estar en espera, y lleva «En respuesta a este audio»
        dlg.locator('article[aria-label^="Voz de Beto"] button[aria-label="Escuchar la voz de Beto"]:not([disabled])').first.wait_for(timeout=20000)
        ok = dlg.locator('article[aria-label^="Voz de Beto"]').first.get_by_text("En respuesta a este audio").count() == 1
        dlg.get_by_role("button", name="Cerrar mensajes de voz").click()
        pb.wait_for_timeout(1500)
        return ok or "sin marca de respuesta"
    attempt("Beto responde con su voz", reply)
    def own_reply_plays():
        card.locator(".spot-card-media").click()
        pb.locator('div.fixed.inset-x-0.bottom-0 button[aria-label="Escuchar los mensajes de voz (1)"]').click()
        pb.locator('article[aria-label^="Voz de Beto"] button[aria-label="Escuchar la voz de Beto"]').first.click()
        pb.locator('button[aria-label="Pausar la voz de Beto"]').first.wait_for(timeout=4000)
        shot(pb, "06b-beto-escucha-su-respuesta")
        pb.get_by_role("button", name="Cerrar mensajes de voz").click()
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
        pb.locator('button[aria-label="Parar y escuchar antes de enviar"]').wait_for(timeout=10000)  # se abre grabando
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
        count = own.locator('button[aria-label^="Escuchar los mensajes de voz"]').get_attribute("aria-label")
        shot(pa, "09-ana-feed-con-respuesta")
        own.locator(".spot-card-media").click()
        footer = pa.locator('div.fixed.inset-x-0.bottom-0 button[aria-label="Escuchar los mensajes de voz (1)"]')
        footer.wait_for(timeout=15000)
        footer.click()
        pa.locator('article[aria-label^="Voz de Beto"]').first.wait_for(timeout=15000)
        shot(pa, "10-ana-mensajes-de-voz")
        pa.locator('article[aria-label^="Voz de Beto"] button[aria-label="Escuchar la voz de Beto"]').first.click()
        pa.locator('button[aria-label="Pausar la voz de Beto"]').first.wait_for(timeout=4000)  # suena de verdad
        pa.wait_for_timeout(800)
        pa.get_by_role("button", name="Cerrar mensajes de voz").click()
        pa.get_by_role("button", name="Volver").first.click()
        return count == "Escuchar los mensajes de voz (1)" or count
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

    # ── 4. Comunidades y eventos compartidos ──
    def open_profile_item(page, label):
        page.goto(APP, wait_until="load")
        page.locator('nav[aria-label="Navegación principal"]').wait_for(timeout=30000)
        page.wait_for_timeout(1200)
        page.locator('nav[aria-label="Navegación principal"] button:has-text("Perfil")').click()
        page.wait_for_timeout(1500)
        item = page.get_by_role("button", name=label, exact=True).first
        item.scroll_into_view_if_needed()
        item.click()
        page.wait_for_timeout(1200)

    def record_tile(page, label):
        page.locator(f'button[aria-label="{label}"]').click()
        page.wait_for_timeout(2300)
        page.locator('button[aria-label="Parar la grabación"]').click(force=True)  # late (animación): sin esperar a que esté quieto
        page.locator('button[aria-label="Escuchar tu mensaje"]').wait_for(timeout=8000)

    def ana_creates_community():
        open_profile_item(pa, "Comunidades")
        pa.get_by_role("button", name="Crear comunidad con tu voz").click()
        pa.fill("#comunidad-nombre", "Runners de Triana")
        pa.get_by_role("button", name="Planes").click()
        record_tile(pa, "Grabar presentación")
        pa.get_by_role("button", name="Crear comunidad").last.click()
        pa.get_by_text("Conversación del grupo").wait_for(timeout=20000)
        pa.wait_for_timeout(1500)
        shot(pa, "15-ana-comunidad")
    attempt("Ana crea una comunidad con su voz", ana_creates_community)
    attempt("la comunidad y su presentación están en la nube", lambda: (lambda rows: (len(rows) == 1 and rows[0]["members"] == 1 and len(http("GET", f"/rest/v1/voice_notes_public?select=id&thread_id=eq.group:{rows[0]['id']}", token=people["Beto"]["token"])) == 1) or rows)(http("GET", "/rest/v1/communities_public?select=id,name,members&name=eq.Runners%20de%20Triana", token=people["Beto"]["token"])))

    def beto_joins_and_listens():
        open_profile_item(pb, "Comunidades")
        pb.get_by_role("button", name="Runners de Triana").first.click()
        pb.get_by_role("button", name="Unirme").click()
        pb.get_by_role("button", name="Miembro ✓ · Salir").wait_for(timeout=15000)
        pb.locator('article[aria-label^="Voz de Ana"] button[aria-label="Escuchar la voz de Ana"]').first.click()
        pb.locator('button[aria-label="Pausar la voz de Ana"]').first.wait_for(timeout=6000)  # suena de verdad
        pb.get_by_role("button", name="Miembros").click()
        pb.get_by_text("@ana_s").first.wait_for(timeout=10000)
        shot(pb, "16-beto-en-la-comunidad")
        return pb.get_by_text("@beto").count() >= 1 or "sin Beto en miembros"
    attempt("Beto se une, escucha la presentación y ve a los miembros", beto_joins_and_listens)

    def ana_creates_event():
        open_profile_item(pa, "Eventos")
        pa.get_by_role("button", name="Crear evento con tu voz").click()
        record_tile(pa, "Grabar audio-flyer")
        pa.fill("#evento-titulo", "Quedada de guitarras")
        pa.fill("#evento-donde", "Alameda de Hércules")
        pa.get_by_role("button", name="Publicar evento").click()
        pa.get_by_text("Preguntas y voces de quien va").wait_for(timeout=20000)
        shot(pa, "17-ana-evento")
    attempt("Ana publica un evento con su audio-flyer", ana_creates_event)

    def beto_attends():
        open_profile_item(pb, "Eventos")
        for tab in ["Hoy", "Fin de semana", "Próximos"]:
            pb.get_by_role("button", name=tab, exact=True).click()
            pb.wait_for_timeout(500)
            if pb.locator("article:has-text('Quedada de guitarras')").count():
                break
        card = pb.locator("article:has-text('Quedada de guitarras')").first
        card.get_by_role("button", name="Asistiré").click()
        card.get_by_role("button", name="Ya asistes").wait_for(timeout=15000)
        card.locator("button:has-text('Quedada de guitarras')").click()
        pb.locator('button[aria-label="Escuchar la voz de Ana"]').first.click()
        pb.locator('button[aria-label="Pausar la voz de Ana"]').first.wait_for(timeout=6000)  # el audio-flyer suena
        shot(pb, "18-beto-va-al-evento")
        rows = http("GET", "/rest/v1/events_public?select=going&title=eq.Quedada%20de%20guitarras", token=people["Ana"]["token"])
        return (len(rows) == 1 and rows[0]["going"] == 1) or rows
    attempt("Beto se apunta al evento y escucha el audio-flyer", beto_attends)

    def ana_notifications():
        pa.goto(APP, wait_until="load")
        pa.locator('nav[aria-label="Navegación principal"]').wait_for(timeout=30000)
        bell = pa.locator('button[aria-label="Notificaciones (hay nuevas)"]').first
        bell.wait_for(timeout=20000)  # el punto rojo solo sale si hay avisos nuevos de verdad
        bell.click()
        pa.get_by_text("ha empezado a seguirte").first.wait_for(timeout=20000)
        pa.wait_for_timeout(800)
        shot(pa, "19-ana-notificaciones")
        text = pa.locator("main").last.inner_text()
        ok = "ha respondido con su voz a «Concierto sorpresa en la Alameda»" in text and "te ha enviado una nota de voz" in text
        return ok or text[:300]
    attempt("Ana ve sus avisos reales: seguidor, respuesta y mensaje", ana_notifications)

    browser.close()

ok = sum(1 for r in results if r["ok"])
(OUT / "informe.json").write_text(json.dumps({"pasos": results, "errores_consola": errors}, ensure_ascii=False, indent=2))
print(f"\n{ok}/{len(results)} pasos correctos · {len(errors)} errores de consola")
for e in errors[:15]:
    print("  ", e)
sys.exit(0 if ok == len(results) else 1)
