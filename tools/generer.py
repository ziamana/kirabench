#!/usr/bin/env python3
"""
Génère tout le site KiraBench à partir de data/kirabench.json :
  index.html                  accueil : quoi installer pour ta carte, dernière vidéo + créations des IA, tableau en mots simples
  results.html                tableau complet (tri, filtre)
  models/<id>/index.html      une page par modèle (résultats d'abord, fiche technique ensuite)
  benchmarks/<id>/index.html  une page par épreuve (consigne, vérifications, résultats, verdict, créations)
  benchmarks/index.html, compare.html, chess/opus-vs-astra/
  data/public.json            ce que lisent les pages en JS (compare) : seulement ce qui est publié

PUBLICATION PAR ÉPISODE : tout élément qui porte "ep": N (modèle, course, mesure de vitesse, verdict, conseil, tier list)
n'apparaît que si la vidéo de l'épisode N a "publie": true dans "videos". Sans "ep" : toujours visible.
Pour sortir un épisode : mettre "publie": true, "url" et "date" sur sa vidéo, puis relancer ce script.
Aperçu local de tout (NE PAS publier le résultat) : python3 tools/generer.py --apercu

Ajouter une course = tools/importer_pi.py puis une entrée dans "runs" (avec "ep" et "lab").
"""
import html, json, os, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(SITE, "data/kirabench.json")))
APERCU = "--apercu" in sys.argv
PUB = {v["ep"] for v in D.get("videos", []) if v.get("publie") and "ep" in v}
vis = lambda x: APERCU or x.get("ep") is None or x["ep"] in PUB

MODELS = [m for m in D["models"] if vis(m)]
M = {m["id"]: m for m in MODELS}
B = {b["id"]: b for b in D["benchmarks"]}
R = {r["id"]: r for r in D["rigs"]}
RUNS = [r for r in D["runs"] if vis(r) and r["model"] in M]
SPEED = [s for s in D["speed"] if vis(s) and s["model"] in M]
VIDEOS = sorted([v for v in D.get("videos", []) if vis(v) and v.get("publie", True)], key=lambda v: (v.get("date", ""), v.get("ep", 0)), reverse=True)
quoi = lambda v: v.get("label") or f'Episode {v["ep"]}'  # vidéo hors série (actu) : "label", sinon numéro d'épisode
VERDICTS = [v for v in D.get("verdicts", []) if vis(v) and all(x in M for x in v["ranking"])]
TIERS = D.get("tiers") if D.get("tiers") and vis(D["tiers"]) else None
e = lambda s: html.escape(str(s), quote=True)


def duree(s):
    s = round(s)
    if s >= 3600:
        return f"{s // 3600} h {s % 3600 // 60:02d}"
    return f"{s // 60} min {s % 60:02d} s" if s >= 60 else f"{s} s"


def passe(run):
    v = list(run["checks"].values())
    return sum(1 for x in v if x), len(v)


def nombre(x):
    return f"{x:,}".replace(",", " ") if isinstance(x, int) else str(x)


def ecrit(s):
    return s.get("write", s.get("tg128"))


def lit(s):
    return s.get("read", s.get("pp512"))


def tier(mid):
    if not TIERS:
        return None
    return next((t for t in "SABCD" if mid in TIERS.get(t, [])), None)


def principale(mid, bid):
    """Course retenue pour un modèle et une épreuve : la plus récente faite dans la limite de 20 min."""
    rs = [r for r in RUNS if r["model"] == mid and r["benchmark"] == bid and not r.get("nolimit")]
    return max(rs, key=lambda r: r["ep"]) if rs else None


def sans_limite(mid, bid):
    rs = [r for r in RUNS if r["model"] == mid and r["benchmark"] == bid and r.get("nolimit")]
    return max(rs, key=lambda r: r["ep"]) if rs else None


def vitesse(mid):
    ss = [s for s in SPEED if s["model"] == mid]
    return max(ss, key=lambda s: s["ep"]) if ss else None


def resume(mid):
    rs = [x for x in (principale(mid, b["id"]) for b in D["benchmarks"]) if x]
    ok = sum(passe(r)[0] for r in rs); n = sum(passe(r)[1] for r in rs)
    return {"runs": rs, "ok": ok, "n": n, "rien": [B[r["benchmark"]]["title"].split(" (")[0] for r in rs if r.get("timeout")], "speed": vitesse(mid)}


def ordre_modeles():
    def cle(m):
        r = resume(m["id"]); t = tier(m["id"])
        return ("SABCD".index(t) if t else 9, -(r["ok"] / r["n"] if r["n"] else 0), -(ecrit(r["speed"]) if r["speed"] else 0))
    return sorted(MODELS, key=cle)


def place(s):
    return "The card only" if s["placement"] == "card" else "Card + system RAM"


def page(titre, desc, racine, corps, actif="", titre_complet=None):
    # même menu, même ordre et mêmes classes sur toutes les pages (la classe va sur le lien, jamais sur un span autour)
    nav = lambda h, t, k, cls="": f'<a{f" class=\"{cls}\"" if cls else ""} href="{racine}{h}"{" aria-current=\"page\"" if actif == k else ""}>{t}</a>'
    accueil = racine or "./"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre_complet or titre + " · KiraBench")}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#0f1311">
<link rel="icon" href="{racine}favicon.svg" type="image/svg+xml">
<link rel="icon" href="{racine}favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="{racine}apple-touch-icon.png">
<link rel="preload" href="{racine}assets/fonts/red-hat-text.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{racine}assets/style.css">
</head>
<body>
<header class="top"><div class="wrap">
  <a class="mark" href="{accueil}" aria-label="KiraBench home"><span class="k" data-kira="neutre" data-pad="0"></span><b>KiraBench</b></a>
  <nav aria-label="Main">{nav("results.html", "Results", "results")}{nav("benchmarks/", "Benchmarks", "benchmarks")}<a href="{accueil}#videos">Videos</a>{nav("compare.html", "Compare", "compare", "hide-s")}<a class="hide-s" href="{accueil}#alerts">Alerts</a></nav>
</div></header>
<main class="wrap">
{corps}
</main>
<footer><div class="wrap">
  <span>KiraBench. Kira is an AI host; every test runs on real hardware. Model names and logos belong to their owners.</span>
  <nav aria-label="Footer"><a href="{racine}results.html">Results</a><a href="{racine}privacy.html">Privacy</a><a href="{racine}legal.html">Legal notice</a></nav>
</div></footer>
<script src="{racine}assets/palette.js"></script>
<script src="{racine}assets/kira.js"></script>
<script src="{racine}assets/site.js"></script>
<script src="{racine}assets/lab.js"></script>
</body>
</html>
"""


def ecrire(chemin, contenu):
    p = os.path.join(SITE, chemin)
    os.makedirs(os.path.dirname(p) or SITE, exist_ok=True)
    open(p, "w").write(contenu)


def logo(m, racine, cls="mlogo"):
    if m.get("logo"):
        return f'<img class="{cls}" src="{racine}{e(m["logo"])}" alt="" width="56" height="56">'
    lettres = "".join(w[0] for w in m["name"].split()[:2]).upper()
    return f'<span class="{cls} mono-logo" aria-hidden="true">{e(lettres)}</span>'


def apercu(run, racine, titre):
    src = f'{racine}lab/{run["lab"]}/index.html'
    return f"""<div class="lab" data-lab>
  <div class="labbar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="labtitle">{e(titre)}</span>
    <div class="seg" role="group" aria-label="Screen size">
      <button type="button" data-w="desktop" aria-pressed="true">Desktop</button><button type="button" data-w="phone" aria-pressed="false">Phone</button>
    </div>
    <a class="labopen" href="{src}" target="_blank" rel="noopener">Open full page</a>
  </div>
  <div class="labview"><iframe title="{e(titre)}, made by the model" src="{src}" sandbox="allow-scripts allow-forms" loading="lazy"></iframe></div>
</div>"""


def detail(r):
    b = B[r["benchmark"]]
    return {"title": b["title"] + (" (no time limit)" if r.get("nolimit") else ""), "items": [{"label": c["label"], "ok": bool(r["checks"][c["id"]])} for c in b["checks"] if c["id"] in r["checks"]], "notes": r.get("notes", [])}


def chk(runs, mots=False):
    """Score avec l'infobulle de détail (même format que assets/site.js). mots=True : « 13 of 15 »."""
    ok = sum(passe(r)[0] for r in runs); n = sum(passe(r)[1] for r in runs)
    d = [detail(r) for r in runs]
    txt = f"{ok} of {n}" if mots else f"{ok}/{n}"
    return f'<span class="chk" tabindex="0" role="button" aria-label="{ok} of {n} checks passed, show details" data-checks="{e(json.dumps(d))}">{txt}</span>'


def checks_html(run):
    b = B[run["benchmark"]]
    li = "".join(f'<li class="{"ok" if run["checks"].get(c["id"]) else "ko"}"><span class="mark2" aria-hidden="true">{"✓" if run["checks"].get(c["id"]) else "✗"}</span>{e(c["label"])}<span class="sr-only">{": passed" if run["checks"].get(c["id"]) else ": failed"}</span></li>' for c in b["checks"] if c["id"] in run["checks"])
    notes = "".join(f"<p class=\"note\">{e(n)}</p>" for n in run.get("notes", []))
    return f'<ul class="checks">{li}</ul>{notes}'


def reglage(s):
    return f'{s["context"] // 1024}k context, episode {s["ep"]}'


# ---------------------------------------------------------------- accueil
FLECHE = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'


def bloc_installer():
    tailles = ["8", "12", "16", "24"]
    noms = {"8": "8 GB", "12": "12 GB", "16": "16 GB", "24": "24 GB+"}
    conseils = {}
    for a in D.get("advice", []):
        if vis(a):
            if a["vram"] not in conseils or a.get("ep", 0) >= conseils[a["vram"]].get("ep", 0):
                conseils[a["vram"]] = a
    radios = "".join(f'<input type="radio" name="vram" id="vram-{t}" value="{t}"{" checked" if t == "12" else ""}><label for="vram-{t}">{noms[t]}</label>' for t in tailles)
    panneaux = ""
    for t in tailles:
        a = conseils.get(t)
        if not a:
            corps = '<p class="estimate">Coming soon. We have only measured on a 12 GB card so far.</p>'
        elif a["kind"] == "measured":
            cartes = ""
            for p in a["picks"]:
                m = M.get(p["model"])
                if not m:
                    continue
                r = resume(m["id"]); s = r["speed"]; tr = tier(m["id"])
                faits = []
                if s:
                    faits.append(f'<li>Writes <b>{e(ecrit(s))}</b> tokens per second</li>')
                if r["n"]:
                    faits.append(f'<li>Passed <b>{chk(r["runs"], True)}</b> checks</li>')
                faits.append(f'<li>{e(p["needs"])}</li>')
                cartes += f"""<article class="pc">
  <h3>{e(p["use"])}</h3>
  <a class="pm" href="models/{m["id"]}/">{logo(m, "", "mlogo sm")}<span><b>{e(m["name"])}</b>{f'<small>Kira\'s tier: {tr}</small>' if tr else ""}</span>{FLECHE}</a>
  <p>{e(p["why"])}</p>
  <ul class="facts">{"".join(faits)}</ul>
</article>"""
            extra = ""
            if a.get("skip"):
                extra += f'<p class="skip"><b>Skip:</b> {e(a["skip"][len("Skip "):] if a["skip"].startswith("Skip ") else a["skip"])}</p>'
            if a.get("conclusion"):
                extra += f'<p class="concl">{e(a["conclusion"])}</p>'
            corps = f'<p class="badge ok">Measured on our RTX 2060 12 GB with 32 GB of system RAM</p><div class="picks n{min(len(a["picks"]), 4)}">{cartes}</div>{extra}'
        else:
            txt = a["text"]
            corps = f"""<p class="badge est">Estimate, not measured</p>
<div class="estimate">{"".join(f"<p>{e(x)}</p>" for x in txt)}</div>
<p class="soon">Real results for this size: coming soon. <a href="#alerts">Get an alert when they are in</a>.</p>"""
        panneaux += f'<div class="vpanel" data-v="{t}" role="region" aria-label="{noms[t]} of GPU memory">{corps}</div>'
    return f"""<section class="install" id="install">
  <div class="intro">
    <div class="kira" data-kira="neutre" data-pad="1"></div>
    <h1>What should you run on your GPU?</h1>
    <p class="lead">I'm Kira. Every local AI model gets the same three jobs on a real RTX 2060 12 GB with 32 GB of system RAM. You see what it built, how fast it writes, and where it failed.</p>
  </div>
  <fieldset class="vram"><legend>How much memory does your graphics card have?</legend><div class="seg2">{radios}</div></fieldset>
  {panneaux}
</section>"""


def carte_video(v, grande=False):
    url = v.get("url") or "#"
    img = f'<img src="{e(v["thumb"])}" alt="" width="960" height="540"{"" if grande else " loading=\"lazy\""}>' if v.get("thumb") else f'<span class="nothumb">{e(quoi(v))}</span>'
    date = v.get("date", "")
    return url, img, date


def bloc_videos():
    if not VIDEOS:
        return ""
    v = VIDEOS[0]; url, img, date = carte_video(v, True)
    page_ep = f'<a class="btn ghost" href="{e(v["page"])}/">Replay the game move by move</a>' if v.get("page") else ""
    modeles = [M[x] for x in v.get("models", []) if x in M]
    lignes = f'<p class="vm">Models: {", ".join(f"<a href=\"models/{m["id"]}/\">{e(m["name"])}</a>" for m in modeles)}</p>' if modeles else ""
    autres = "".join(f"""<li><a href="{e(x.get("url") or "#")}" rel="noopener">{carte_video(x)[1]}<span><b>{e(x["title"])}</b><small>{e(quoi(x))}{" · " + e(x["date"]) if x.get("date") else ""}</small></span></a></li>""" for x in VIDEOS[1:])
    return f"""<div class="vid">
  <a class="vthumb" href="{e(url)}" rel="noopener" aria-label="Watch on YouTube: {e(v["title"])}">{img}<span class="vplay">{LECTURE}</span></a>
  <div class="vtext">
    <p class="vep">{e(quoi(v))}{" · " + e(date) if date else ""}</p>
    <h3>{e(v["title"])}</h3>
    {lignes}
    <div class="actions"><a class="btn pri" href="{e(url)}" rel="noopener">Watch on YouTube</a>{page_ep}</div>
  </div>
</div>
{f'<h3 class="sub3">Earlier episodes</h3><ul class="vlist">{autres}</ul>' if autres else ""}"""


def tuile(m, b):
    r = principale(m["id"], b["id"]); nl = sans_limite(m["id"], b["id"])
    if not r and not nl:
        return ""
    montre = r if r and r.get("lab") else nl
    lien_m = f'models/{m["id"]}/#{b["id"]}'
    if not montre:   # rien écrit, même pas en bonus
        return (2, 0, f"""<figure class="tile empty"><div class="shot"><span>No file<br>after 20 minutes</span></div>
<figcaption><a href="{lien_m}"><b>{e(m["name"])}</b></a><span class="res">Passed 0 of {passe(r)[1]}</span></figcaption></figure>""")
    ok, n = passe(montre)
    if montre.get("nolimit"):
        res = f'No file in 20 min. No time limit: {duree(montre["seconds"])}, passed {ok} of {n}'
    else:
        res = f'Passed {ok} of {n} · {duree(montre["seconds"])}'
    note = (montre.get("notes") or [""])[0]
    if note.startswith("Bonus run with no time limit"):
        note = note.split(". ", 1)[1] if ". " in note else ""
    note = note.split(". ")[0].rstrip(".") + "." if note else ""
    img = f'assets/img/{montre["lab"].replace("/", "-")}.jpg'
    a_img = os.path.exists(os.path.join(SITE, img))
    vignette = f'<img src="{img}" alt="" width="480" height="300" loading="lazy">' if a_img else f'<span>{e(b["title"])}</span>'
    return (1 if montre.get("nolimit") else 0, -ok / n, f"""<figure class="tile">
<a class="shot" href="lab/{montre["lab"]}/index.html" target="_blank" rel="noopener" aria-label="Open {e(b["title"].lower())} by {e(m["name"])} (new tab)">{vignette}<span class="open">Open {"and play" if b["kind"] in ("game", "animation") else "the site"}</span></a>
<figcaption><a href="{lien_m}"><b>{e(m["name"])}</b></a><span class="res">{e(res)}</span>{f'<span class="say">{e(note)}</span>' if note else ""}</figcaption></figure>""")


def bloc_galerie():
    ordre = ["car-crash", "snake-game", "bakery-site"]
    noms = {"car-crash": "Car crash", "snake-game": "Snake", "bakery-site": "Bakery website"}
    bs = [B[x] for x in ordre if x in B] + [b for b in D["benchmarks"] if b["id"] not in ordre]
    radios = "".join(f'<input type="radio" name="gal" id="gal-{b["id"]}"{" checked" if i == 0 else ""}><label for="gal-{b["id"]}">{e(noms.get(b["id"], b["title"]))}</label>' for i, b in enumerate(bs))
    panneaux = ""
    for b in bs:
        t = sorted([x for x in (tuile(m, b) for m in MODELS) if x], key=lambda x: (x[0], x[1]))
        if not t:
            continue
        panneaux += f"""<div class="gpanel" data-g="{b["id"]}" role="region" aria-label="{e(b["title"])}">
  <p class="gp">Same prompt for every model: <q>{e(b["prompt"].split(". ")[0].rstrip("."))}.</q> <a href="benchmarks/{b["id"]}/">The full test</a> · <a href="compare.html?b={b["id"]}">Compare side by side</a></p>
  <div class="tiles">{"".join(x[2] for x in t)}</div>
</div>"""
    return f"""<h2 class="h2b" id="gallery">What the models built</h2>
<p class="sub">The real files each model wrote from one prompt, with no help. Open one to play it in your browser.</p>
<div class="gal"><div class="seg2" role="group" aria-label="Test">{radios}</div>{panneaux}</div>"""


def tableau_simple(racine=""):
    lignes = ""
    for m in ordre_modeles():
        r = resume(m["id"]); s = r["speed"]; tr = tier(m["id"])
        if not s and not r["n"]:
            continue
        ou = f'{place(s)}<small>{e(s["quant"])}, {nombre(s["file_gb"])} GB file</small>' if s else "Not measured"
        vit = f'Writes <b>{e(ecrit(s))}</b> tokens/s<small>at {s["context"] // 1024}k context</small>' if s else "Not measured"
        tests = ", ".join(B[x["benchmark"]]["title"].split(" (")[0].lower() for x in r["runs"])
        rien = f'<small class="warn">No file in 20 min: {e(", ".join(x.lower() for x in r["rien"]))}</small>' if r["rien"] else f'<small>{e(tests.capitalize())}</small>'
        res = f'Passed <b>{chk(r["runs"], True)}</b> checks{rien}' if r["n"] else "Not tested yet"
        lignes += f"""<tr><th scope="row"><a href="{racine}models/{m["id"]}/">{logo(m, racine, "mlogo xs")}{e(m["name"])}</a></th>
<td data-l="Runs from">{ou}</td><td data-l="Speed">{vit}</td><td data-l="Tests">{res}</td>{f'<td data-l="Kira&#39;s tier" class="tier"><span class="t t{tr}">{tr}</span></td>' if TIERS else ""}</tr>"""
    eps = sorted({s["ep"] for s in SPEED})
    vieux = [x for x in eps if x <= 4]; neufs = [x for x in eps if x > 4]
    note = "One run per test, 20 minutes each, on the same card. "
    if vieux:
        note += f"Speeds from episode{'s' if len(vieux) > 1 else ''} {' and '.join(map(str, vieux))}: 64k context, measured with llama-bench. "
    if neufs:
        note += f"Episode{'s' if len(neufs) > 1 else ''} {' and '.join(map(str, neufs))}: 88k to 128k context, settings tuned for each model, so those speeds are a little higher. "
    if TIERS:
        note += "Tiers are Kira's opinion from what each model built, not a computed score."
    return f"""<div class="tablewrap plain"><table class="simple"><thead><tr><th scope="col">Model</th><th scope="col">Runs from</th><th scope="col">Speed</th><th scope="col">Tests</th>{'<th scope="col">Kira&#39;s tier</th>' if TIERS else ""}</tr></thead>
<tbody>{lignes}</tbody></table></div>
<p class="notes">{e(note.strip())}</p>"""


def page_accueil():
    maj = max(r["date"] for r in RUNS)
    corps = f"""{bloc_installer()}
<section id="videos">
  <h2>Latest video</h2>
  {bloc_videos()}
  {bloc_galerie()}
</section>
<section id="table">
  <h2>Every model on our 12 GB card</h2>
  <p class="sub">In plain words. Hover or tap a score to see each check. Last run: {e(maj)}.</p>
  {tableau_simple()}
  <a class="more" href="results.html">Full table with reading speed and memory used {FLECHE}</a>
</section>
<section id="method">
  <h2>How Kira tests</h2>
  <dl class="man">
    <dt>One real card</dt>
    <dd>A <strong>second-hand RTX 2060 12 GB</strong>, with 32 GB of system RAM. Nothing rented in the cloud, and every result says which card it ran on.</dd>
    <dt>Same jobs for everyone</dt>
    <dd>Each model drives the Pi coding agent: <strong>one prompt, no help, 20 minutes</strong>. Then a script checks the result in a real browser. No model grades another model.</dd>
    <dt>Failures shown</dt>
    <dd>Too slow, broken game, nothing written in 20 minutes: <strong>it goes on the site too</strong>, with the files it wrote.</dd>
  </dl>
</section>
<section id="alerts">
  <div class="alert">
    <div class="kira" data-kira="verdict" data-pad="2"></div>
    <div>
      <h2>Know when a new model wins on your GPU</h2>
      <p class="sub" style="margin:0">One short email when a tested model takes the top spot for your memory size. Nothing else unless you tick the box.</p>
      <form class="signup" novalidate>
        <div class="row">
          <input type="email" name="email" required placeholder="you@example.com" autocomplete="email" aria-label="Email address">
          <select name="vram" aria-label="Your GPU memory">
            <option value="" selected disabled>Your GPU memory</option>
            <option value="6">6 GB</option><option value="8">8 GB</option><option value="10">10 GB</option><option value="12">12 GB</option>
            <option value="16">16 GB</option><option value="20">20 GB</option><option value="24">24 GB or more</option>
          </select>
          <button class="btn pri" type="submit">Alert me</button>
        </div>
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="check"><input type="checkbox" name="news"> Also send me the weekly KiraBench newsletter (new videos and tests).</label>
        <p class="fine">Unsubscribe in one click from any email. See the <a href="privacy.html">privacy policy</a>.</p>
        <p class="msg" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</section>"""
    ecrire("index.html", page("", "Which local AI model should you run on your GPU? Real tests on an RTX 2060 12 GB with 32 GB of RAM: what each model built, how fast it writes, failures included.", "", corps,
                              titre_complet="KiraBench · What local AI model should you run on your GPU?"))


# ---------------------------------------------------------------- tableau complet
def page_resultats():
    lignes = ""
    for m in ordre_modeles():
        r = resume(m["id"])
        for s in sorted([s for s in SPEED if s["model"] == m["id"]], key=lambda s: -s["ep"]):
            courant = s is r["speed"]
            sc = f'{chk(r["runs"], True)}' if courant and r["n"] else '<span class="dim">see latest row</span>'
            pct = round(100 * r["ok"] / r["n"]) if courant and r["n"] else -1
            lignes += f"""<tr data-p="{s["placement"]}"><th scope="row"><a href="models/{m["id"]}/">{e(m["name"])}</a></th>
<td data-l="Runs from" data-v="{0 if s["placement"] == "card" else 1}">{place(s)}</td><td data-l="File" data-v="{s["file_gb"]}">{e(s["quant"])}, {nombre(s["file_gb"])} GB</td>
<td data-l="Context" class="num" data-v="{s["context"]}">{s["context"] // 1024}k</td>
<td data-l="Card memory used" class="num" data-v="{s["vram_gb"] if s.get("vram_gb") is not None else -1}">{f'{s["vram_gb"]} GB' if s.get("vram_gb") is not None else '<span class="dim">not measured</span>'}</td>
<td data-l="Reads" class="num" data-v="{lit(s)}">{nombre(lit(s))} tokens/s</td><td data-l="Writes" class="num" data-v="{ecrit(s)}"><b>{ecrit(s)}</b> tokens/s</td>
<td data-l="Checks passed" class="num" data-v="{pct}">{sc}</td><td data-l="Episode" class="num" data-v="{s["ep"]}">{s["ep"]}</td></tr>"""
    rig = R["rtx2060-12g"]
    corps = f"""<section class="hero2">
  <h1>Every model, measured on our card</h1>
  <p class="sub">Click a column to sort. <b>Reads</b> is how fast the model takes in your prompt, <b>writes</b> is how fast it answers, in tokens per second (a token is about three quarters of a word). <b>Card + system RAM</b> means the model is bigger than the card's memory and part of it runs from the computer's RAM.</p>
  <dl class="rig"><div><dt>Graphics card</dt><dd>{e(rig["gpu"])}</dd></div><div><dt>Processor</dt><dd>{e(rig["cpu"])}</dd></div><div><dt>System RAM</dt><dd>{e(rig["ram"])}</dd></div></dl>
</section>
<section>
  <div class="filters" role="group" aria-label="Filter models"><button type="button" data-f="all" aria-pressed="true">All models</button><button type="button" data-f="card" aria-pressed="false">The card only</button><button type="button" data-f="card+ram" aria-pressed="false">Card + system RAM</button></div>
  <div class="tablewrap"><table class="full" data-sortable><thead><tr><th scope="col">Model</th><th scope="col">Runs from</th><th scope="col">File</th><th scope="col" class="num">Context</th><th scope="col" class="num">Card memory used</th><th scope="col" class="num">Reads</th><th scope="col" class="num">Writes</th><th scope="col" class="num">Checks passed</th><th scope="col" class="num">Episode</th></tr></thead>
  <tbody id="results">{lignes}</tbody></table></div>
  <p class="notes">Episodes 3 and 4: llama.cpp 8172e65, llama-bench (reads 512 tokens, writes 128), 3 runs, 64k context. Later episodes: llama-server with settings tuned for each model (q8 cache, n-gram prediction), reading a 17k-token prompt, at 88k to 128k context; card memory was not recorded there. A model tested in two episodes has two rows; its checks count the latest run of each test.</p>
</section>"""
    ecrire("results.html", page("Results", "Every local AI model tested by Kira on an RTX 2060 12 GB: reading and writing speed, memory used, and checks passed.", "", corps, "results"))


# ---------------------------------------------------------------- pages modèles
def page_modele(m):
    racine = "../../"
    s_list = sorted([s for s in SPEED if s["model"] == m["id"]], key=lambda s: -s["ep"])
    base = M.get(m.get("base")) if m.get("base") else None
    faits = [("Creator", e(m["creator"])), ("Based on", f'<a href="{racine}models/{base["id"]}/">{e(base["name"])}</a>' if base else "Original model")]
    if m.get("license"):
        faits.append(("License", e(m["license"])))
    faits += [("Parameters", e(m["params"])), ("Weights", f'<a href="{e(m["hf"])}" rel="noopener">Hugging Face</a>')]
    rig = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in faits)
    videos = [v for v in VIDEOS if m["id"] in v.get("models", []) and v.get("url")]
    boutons = "".join(f'<a class="btn ghost" href="{e(v["url"])}" rel="noopener">{LECTURE}Episode {v["ep"]}: {e(v["title"])}</a>' for v in videos)
    vitesse_l = "".join(f"""<tr><th scope="row">Episode {s["ep"]}</th><td data-l="Runs from">{place(s)}</td><td data-l="File">{e(s["quant"])}, {nombre(s["file_gb"])} GB</td><td data-l="Context" class="num">{s["context"] // 1024}k</td>
<td data-l="Card memory used" class="num">{f'{s["vram_gb"]} GB' if s.get("vram_gb") is not None else '<span class="dim">not measured</span>'}</td><td data-l="Reads" class="num">{nombre(lit(s))} tokens/s</td><td data-l="Writes" class="num"><b>{ecrit(s)}</b> tokens/s</td></tr>""" for s in s_list)
    epreuves = ""
    vus = set()
    for b in D["benchmarks"]:
        rs = [r for r in RUNS if r["model"] == m["id"] and r["benchmark"] == b["id"]]
        rs.sort(key=lambda r: (r.get("nolimit", False), -r["ep"]))
        for r in rs:
            ancre = b["id"] if b["id"] not in vus else (r.get("lab", "").split("/")[-1] or f'{b["id"]}-ep{r["ep"]}')
            vus.add(b["id"])
            ok, n = passe(r)
            quoi = "with no time limit" if r.get("nolimit") else f"episode {r['ep']}"
            if r.get("timeout"):
                meta = f'{chk([r], True)} checks · no file written in 20 minutes'
            else:
                meta = f'Passed {chk([r], True)} checks · built in {duree(r["seconds"])} · {len(r["files"])} file{"s" if len(r["files"]) > 1 else ""}'
            log = f'{racine}logs/{r["lab"]}.json' if r.get("lab") and os.path.exists(os.path.join(SITE, "logs", r["lab"] + ".json")) else ""
            epreuves += f"""<section class="run" id="{e(ancre)}">
  <h3><a href="{racine}benchmarks/{b["id"]}/">{e(b["title"])}</a> <span class="dim small">{e(quoi)}</span></h3>
  <p class="meta">{meta}</p>
  {checks_html(r)}
  {apercu(r, racine, m["name"] + " · " + b["title"]) if r.get("lab") else ""}
  {f'<details class="log" data-log="{log}"><summary>What the agent did, step by step</summary><div class="logbody"><p class="dim">Loading…</p></div></details>' if log else ""}
  {f'<p class="more"><a href="{racine}compare.html?b={b["id"]}">Compare with the other models on this test</a></p>' if r.get("lab") else ""}
</section>"""
    pas_fait = [b for b in D["benchmarks"] if not any(r["benchmark"] == b["id"] for r in RUNS if r["model"] == m["id"])]
    if pas_fait:
        epreuves += f'<p class="dim">Not tested yet: {e(", ".join(b["title"] for b in pas_fait))}.</p>'
    claims = "".join(f'<li>{e(c["text"])} <span class="who">({e(c["who"])})</span></li>' for c in m.get("claims", [])) or "<li>No special claims: this is the base model.</li>"
    comm = "".join(f'<li><a href="{e(c["url"])}" rel="noopener">{e(c["title"])}</a> <span class="who">{e(c["source"])}</span></li>' for c in m.get("community", []))
    tr = tier(m["id"])
    corps = f"""<section class="hero2">
  <div class="mhead">{logo(m, racine)}<div><h1>{e(m["name"])}</h1>{f'<p class="dim small">Kira\'s tier on a 12 GB card: <span class="t t{tr}">{tr}</span></p>' if tr else ""}</div></div>
  <p class="sub">{e(m["about"])}</p>
  <dl class="man verdict"><dt>Pick it if</dt><dd>{e(m["pick_if"])}</dd><dt>Watch out</dt><dd>{e(m["watch_out"])}</dd></dl>
  {f'<div class="actions">{boutons}</div>' if boutons else ""}
</section>
<section>
  <h2>What it built</h2>
  {epreuves}
</section>
<section>
  <h2>Speed on our card</h2>
  <p class="sub small">Reads = how fast it takes in your prompt, writes = how fast it answers, in tokens per second.</p>
  <div class="tablewrap"><table class="full"><thead><tr><th scope="col">Settings</th><th scope="col">Runs from</th><th scope="col">File</th><th scope="col" class="num">Context</th><th scope="col" class="num">Card memory used</th><th scope="col" class="num">Reads</th><th scope="col" class="num">Writes</th></tr></thead><tbody>{vitesse_l}</tbody></table></div>
  <p class="notes">{e(" ".join(sorted({f"Episode {s['ep']}: {s['engine']}." for s in s_list})))}</p>
</section>
<section class="split">
  <div><h2>About the model</h2><dl class="rig col">{rig}</dl></div>
  <div><h2>What it claims</h2><ul class="plain">{claims}</ul>
  {f'<h2 style="margin-top:28px">What others say</h2><ul class="plain">{comm}</ul>' if comm else ""}</div>
</section>"""
    ecrire(f"models/{m['id']}/index.html",
           page(m["name"], f'{m["name"]} tested on a real RTX 2060 12 GB: what it built, every check it passed or failed, and how fast it runs.', racine, corps))


# ---------------------------------------------------------------- pages épreuves
def page_epreuve(b):
    racine = "../../"
    runs = [r for r in RUNS if r["benchmark"] == b["id"]]
    tete = "".join(f'<th scope="col" class="num">{e(c["label"])}</th>' for c in b["checks"])
    lignes = ""
    for r in sorted(runs, key=lambda r: (r.get("timeout", False), -passe(r)[0], r["seconds"])):
        m = M[r["model"]]
        cel = "".join(f'<td class="num {"okc" if r["checks"].get(c["id"]) else "koc"}">{"✓" if r["checks"].get(c["id"]) else "✗"}</td>' for c in b["checks"])
        quand = "no time limit" if r.get("nolimit") else f"ep. {r['ep']}"
        temps = "no file in 20 min" if r.get("timeout") else duree(r["seconds"])
        lignes += f'<tr><td><a href="{racine}models/{m["id"]}/#{b["id"]}">{e(m["name"])}</a> <span class="dim small">{quand}</span></td>{cel}<td class="num">{chk([r])}</td><td class="num">{temps}</td></tr>'
    vs = [x for x in VERDICTS if x["benchmark"] == b["id"]]
    verdict = ""
    if vs:
        blocs = "".join(f"""<h3>{e(v.get("title", ""))}</h3>
<dl class="man">{"".join(f'<dt>{"tie" if v.get("tie") else "#" + str(i + 1)}</dt><dd><a href="{racine}models/{m}/#{b["id"]}">{e(M[m]["name"])}</a></dd>' for i, m in enumerate(v["ranking"]))}</dl>
<p>{e(v.get("why", ""))}</p>""" for v in vs)
        verdict = f"""<section><h2>Our verdict</h2>
{blocs}
<p class="dim">Then you are the second judge: open each one below and say which you would ship in the comments of the video.</p></section>"""
    galerie = "".join(f'<section class="run"><h3><a href="{racine}models/{r["model"]}/#{b["id"]}">{e(M[r["model"]]["name"])}</a> <span class="dim small">{"no time limit" if r.get("nolimit") else "episode " + str(r["ep"])}</span></h3>{apercu(r, racine, M[r["model"]]["name"] + " · " + b["title"])}</section>' for r in runs if r.get("lab"))
    corps = f"""<section class="hero2">
  <h1>{e(b["title"])}</h1>
  <p class="sub">{e(b["harness"])}. Every model gets exactly this prompt:</p>
  <pre class="prompt">{e(b["prompt"])}</pre>
</section>
<section>
  <h2>Results</h2>
  <p class="dim small">Automatic checks run in a real browser on what each model built. <a href="{racine}compare.html?b={b["id"]}">Compare them side by side</a>.</p>
  <div class="tablewrap"><table class="checks-t"><thead><tr><th scope="col">Model</th>{tete}<th scope="col" class="num">Checks</th><th scope="col" class="num">Time</th></tr></thead><tbody>{lignes}</tbody></table></div>
</section>
{verdict}
<section><h2>What each model built</h2>{galerie}</section>"""
    ecrire(f"benchmarks/{b['id']}/index.html",
           page(b["title"], f'{b["title"]}: the same prompt given to every local model, the automatic checks and what each one built.', racine, corps))


# ---------------------------------------------------------------- comparaison
def page_compare():
    corps = """<section class="hero2">
  <h1>Compare side by side</h1>
  <p class="sub">Pick a test and the models. Each one is the real file the model wrote, running in your browser.</p>
</section>
<section>
  <div class="cmpctl" id="cmpctl"></div>
  <div class="cmpgrid" id="cmpgrid"></div>
</section>"""
    ecrire("compare.html", page("Compare", "Compare what local AI models built for the same prompt, side by side.", "", corps, "compare"))


def page_index_epreuves():
    racine = "../"
    blocs = ""
    for b in D["benchmarks"]:
        runs = [r for r in RUNS if r["benchmark"] == b["id"] and not r.get("nolimit")]
        top = max((passe(r)[0] for r in runs), default=None)
        meilleurs = [r for r in runs if passe(r)[0] == top] if runs else []
        noms = ", ".join(dict.fromkeys(M[r["model"]]["name"] for r in runs)) or "no model yet"
        nb = len({r["model"] for r in runs})
        blocs += f"""<section class="run">
  <h3><a href="{racine}benchmarks/{b["id"]}/">{e(b["title"])}</a></h3>
  <p class="meta">{nb} model{"s" if nb != 1 else ""} tested · {len(b["checks"])} checks · {e(b["kind"])}</p>
  <p class="dim">{e(b["prompt"][:220])}{"…" if len(b["prompt"]) > 220 else ""}</p>
  <p class="dim small">Tested: {e(noms)}.{(" Most checks passed: " + ", ".join(dict.fromkeys(f'<a href="{racine}models/{r["model"]}/#{b["id"]}">{e(M[r["model"]]["name"])}</a> ({chk([r])})' for r in meilleurs)) + ".") if meilleurs else ""}</p>
  <p class="more"><a href="{racine}benchmarks/{b["id"]}/">Open the test</a> · <a href="{racine}compare.html?b={b["id"]}">Compare side by side</a></p>
</section>"""
    corps = f"""<section class="hero2">
  <h1>Every test, the same for every model</h1>
  <p class="sub">Each test is one prompt given to the model, with no help, then automatic checks in a real browser. Not every model has taken every test yet; new tests are added over time.</p>
</section>
<section>{blocs}</section>
<section>
  <h2>Chess</h2>
  <section class="run">
    <h3><a href="{racine}chess/opus-vs-astra/">Claude Opus 5.5 vs GPT-6 Astra</a></h3>
    <p class="meta">1 game · 80 moves · graded by Stockfish 19 · episode 5</p>
    <p class="dim">Two frontier models play chess in their regular chat apps, no engine, no tools. Astra wins by checkmate; Claude explained every move and still lost a rook it thought was protected.</p>
    <p class="more"><a href="{racine}chess/opus-vs-astra/">Replay the game move by move</a></p>
  </section>
</section>"""
    ecrire("benchmarks/index.html", page("Benchmarks", "Every KiraBench test: the prompt, the checks and which local models passed them.", racine, corps, "benchmarks"))


def donnees_publiques():
    """data/public.json : ce que lit le JS (page Compare), sans rien de ce qui n'est pas encore publié."""
    runs = []
    for r in RUNS:
        x = dict(r)
        if r.get("nolimit"):
            x["label"] = M[r["model"]]["name"] + " (no time limit)"
        elif sum(1 for y in RUNS if y["model"] == r["model"] and y["benchmark"] == r["benchmark"] and not y.get("nolimit")) > 1:
            x["label"] = M[r["model"]]["name"] + f" (ep. {r['ep']})"
        else:
            x["label"] = M[r["model"]]["name"]
        runs.append(x)
    P = {"updated": max(r["date"] for r in RUNS), "rigs": D["rigs"], "benchmarks": D["benchmarks"],
         "models": [{k: m[k] for k in ("id", "name")} for m in MODELS], "runs": runs}
    json.dump(P, open(os.path.join(SITE, "data/public.json"), "w"), ensure_ascii=False, separators=(",", ":"))


def page_echecs():
    """Page de la partie d'échecs de l'ép. 5 (données : data/chess-opus-astra.json, écrit par tools/preparer_echecs.py)."""
    racine = "../../"
    G = json.load(open(os.path.join(SITE, "data/chess-opus-astra.json")))
    mv = G["moves"]
    hk = lambda n, noir: 2 * (n - 1) + (1 if noir else 0)
    stats = {}
    for j in ("opus", "astra"):
        c = [d for d in mv if d["player"] == j]
        g = lambda x: sum(1 for d in c if d["grade"] == x)
        stats[j] = {"best": g("best"), "good": g("good"), "inacc": g("inaccuracy"), "mist": g("mistake"), "blun": g("blunder"),
                    "acpl": round(sum(d["loss"] for d in c) / len(c)), "min": round(sum(d["secs"] for d in c) / 60), "n": len(c),
                    "ill": sum(1 for d in c if d.get("illegal"))}
    so, sa = stats["opus"], stats["astra"]
    lignes = [("Best moves (within 0.1 pawn of Stockfish)", f'{so["best"]} / {so["n"]}', f'{sa["best"]} / {sa["n"]}'), ("Good moves", so["good"], sa["good"]),
              ("Inaccuracies ?!", so["inacc"], sa["inacc"]), ("Mistakes ?", so["mist"], sa["mist"]), ("Blunders ??", so["blun"], sa["blun"]),
              ("Average loss per move (centipawns)", so["acpl"], sa["acpl"]), ("Illegal moves", so["ill"], sa["ill"]),
              ("Total answer time", f'{so["min"]} min', f'{sa["min"]} min'), ("Explained its moves", "every move", "never"), ("Result", "lost", "won by checkmate")]
    table = "".join(f'<tr><td>{e(a)}</td><td class="num">{e(b)}</td><td class="num">{e(c)}</td></tr>' for a, b, c in lignes)
    moments = [(hk(20, 1), "20…Rac8?", "Astra's first slip. Claude misses the chance."), (hk(25, 0), "25.Rc2??", "The rook Claude thought was protected."),
               (hk(26, 0), "26.Qxc2, illegal", "Claude tries to take back through its own knight."), (hk(43, 1), "43…Na4??", "Astra blunders, still winning."),
               (hk(70, 1), "70…e1=Q", "A new queen."), (hk(80, 1), "80…Qb2#", "Checkmate.")]
    chips = "".join(f'<button type="button" data-go="{k}" aria-pressed="false"><b class="mono">{e(t)}</b><span>{e(d)}</span></button>' for k, t, d in moments)
    video = next((v for v in D.get("videos", []) if v.get("page") == "chess/opus-vs-astra"), None)
    bouton = f'<a class="btn pri" href="{e(video["url"])}" rel="noopener">▶ Watch the episode</a>' if video else ""
    donnees = json.dumps(G, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    corps = f"""<section class="hero2">
  <h1>GPT-6 Astra beat Claude Opus 5.5 at chess</h1>
  <p class="sub">One game, 80 moves, played in the regular chat apps: no engine, no tools, no code. Stockfish 19 graded every move. Claude explained every move it played; Astra only ever wrote the move.</p>
  <div class="actions">{bouton}<a class="btn ghost" href="game.pgn" download>Download the PGN</a></div>
</section>
<section data-chess>
  <h2>Replay the game</h2>
  <p class="sub">Click a move, drag the slider or use the arrow keys. Under every move of Claude's: what it wrote before playing it.</p>
  <div class="cz-key" role="group" aria-label="Key moments">{chips}</div>
  <div class="cz">
    <div class="cz-left">
      <div class="cz-boardwrap">
        <div class="cz-eval" aria-hidden="true"><div class="cz-evalfill"></div></div>
        <div class="cz-board" role="grid" aria-label="Chessboard"></div>
      </div>
      <div class="cz-ctl">
        <button type="button" data-step="first" aria-label="Starting position">⏮</button><button type="button" data-step="-1" aria-label="Previous move">◀</button>
        <span class="cz-evaltxt mono" aria-label="Stockfish evaluation">+0.2</span>
        <button type="button" data-step="1" aria-label="Next move">▶</button><button type="button" data-step="last" aria-label="Final position">⏭</button>
      </div>
      <label class="cz-slide"><span class="sr-only">Move</span><input class="cz-range" type="range" min="0" max="160" value="0"><span class="cz-count mono small dim">0 / 160</span></label>
    </div>
    <div class="cz-right">
      <div class="cz-panel" aria-live="polite"></div>
      <div class="cz-moves" aria-label="All moves"></div>
    </div>
  </div>
  <div class="cz-curve" title="Click to jump to a move"></div>
  <p class="small dim">Stockfish's evaluation from White's side after every move (above the line: Claude is better). Dots are blunders. Click to jump.</p>
</section>
<section>
  <h2>The numbers</h2>
  <p class="sub">Claude played slightly worse on average but blundered far less. One blunder on move 25 was enough: it cost a whole rook.</p>
  <div class="tablewrap"><table class="cz-stats"><thead><tr><th scope="col">Stockfish 19, depth 20</th><th scope="col" class="num">Claude Opus 5.5 · White</th><th scope="col" class="num">GPT-6 Astra · Black</th></tr></thead><tbody>{table}</tbody></table></div>
</section>
<section>
  <h2>How it was played</h2>
  <dl class="man">
    <dt>apps</dt><dd><strong>Claude Opus 5.5</strong> on claude.ai, effort high. <strong>GPT-6 Astra</strong> on ChatGPT, effort high. Regular chat apps, no API. A coin toss gave Claude White.</dd>
    <dt>each turn</dt><dd>The model gets the moves so far and the position (FEN), and answers with one line: <span class="mono">MOVE: …</span>. No engine, no tools, no code.</dd>
    <dt>relay</dt><dd>A small AI relay (Claude Haiku 5.5) copied the moves between the two tabs. A referee script (python-chess) checked every move: three illegal moves in a row would lose the game.</dd>
    <dt>grading</dt><dd>Stockfish 19 at depth 20, after the game. Each move is graded by how much evaluation it loses: best up to 0.1 pawn, good up to 0.5, inaccuracy up to 1, mistake up to 2.5, blunder more than 2.5.</dd>
    <dt>notes</dt><dd>Move 40: the relay cut Claude's answer before its move line; the move counted is the one Claude actually wrote (Kc2). Move 63: ChatGPT hit its usage limit and the game resumed the next morning from the same position, so answer times there leave out the night.</dd>
  </dl>
  <p class="small dim" style="margin-top:18px">Chess pieces: Colin M.L. Burnett (cburnett set, CC BY-SA 3.0, via python-chess). Engine: Stockfish (GPLv3). Claude is a trademark of Anthropic, ChatGPT of OpenAI.</p>
</section>
<script>window.KB_CHESS={donnees};</script>
<script src="{racine}assets/chess.js"></script>"""
    pass
    open(os.path.join(SITE, "chess", "opus-vs-astra", "index.html"), "w").write(
        page("Claude Opus 5.5 vs GPT-6 Astra: chess", "Replay the full chess game between Claude Opus 5.5 and GPT-6 Astra, move by move, with Stockfish grades and Claude's own explanations.", racine, corps))


def versionner():
    """Ajoute ?v=<empreinte> aux fichiers CSS/JS de toutes les pages : le navigateur recharge dès qu'un fichier change."""
    import hashlib, re
    emp = {}
    for f in ["assets/style.css", "assets/site.js", "assets/lab.js", "assets/kira.js", "assets/palette.js", "assets/chess.js"]:
        emp[f] = hashlib.sha1(open(os.path.join(SITE, f), "rb").read()).hexdigest()[:8]
    pages = [os.path.join(dp, f) for dp, _, fs in os.walk(SITE) for f in fs if f.endswith(".html") and "/lab/" not in dp and "/.git" not in dp]
    for p in pages:
        s = open(p).read()
        for f, h in emp.items():
            s = re.sub(r'((?:\.\./)*' + re.escape(f) + r')(\?v=[0-9a-f]+)?"', r'\1?v=' + h + '"', s)
        open(p, "w").write(s)
    return len(pages)


if APERCU:
    print("APERÇU : épisodes non publiés inclus. Ne pas commiter ni publier ce résultat ; relancer sans --apercu avant.")
import shutil
for m in D["models"]:
    if m["id"] not in M:   # pas encore publié : pas de page (au cas où un aperçu l'aurait créée)
        shutil.rmtree(os.path.join(SITE, "models", m["id"]), ignore_errors=True)
for m in MODELS:
    page_modele(m)
for b in D["benchmarks"]:
    page_epreuve(b)
page_accueil()
page_resultats()
page_compare()
page_index_epreuves()
page_echecs()
donnees_publiques()
print("versions ajoutées sur", versionner(), "pages")
print(f"épisodes publiés : {sorted(PUB)}{' (aperçu : tout affiché)' if APERCU else ''} ; {len(MODELS)}/{len(D['models'])} modèles, {len(RUNS)}/{len(D['runs'])} courses visibles")
