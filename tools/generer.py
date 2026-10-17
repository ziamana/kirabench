#!/usr/bin/env python3
"""
Génère les pages KiraBench à partir de data/kirabench.json :
  models/<id>/index.html      une page par modèle (vitesse, épreuves passées, créations en direct, journal de l'agent)
  benchmarks/<id>/index.html  une page par épreuve (consigne, vérifications, résultats, verdict, créations)
  compare.html                comparaison côte à côte (JS, lit le même fichier)
Ajouter une épreuve ou un modèle = l'ajouter dans data/kirabench.json (+ tools/importer_pi.py), puis relancer ce script.
Un modèle n'a pas besoin d'avoir passé toutes les épreuves.
"""
import html, json, os

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(SITE, "data/kirabench.json")))
M = {m["id"]: m for m in D["models"]}
B = {b["id"]: b for b in D["benchmarks"]}
R = {r["id"]: r for r in D["rigs"]}
e = lambda s: html.escape(str(s), quote=True)


def duree(s):
    return f"{s // 60} min {s % 60:02d} s" if s >= 60 else f"{s} s"


def passe(run):
    v = list(run["checks"].values())
    return sum(1 for x in v if x), len(v)


def page(titre, desc, racine, corps, actif=""):
    # même menu, même ordre et mêmes classes sur toutes les pages (la classe va sur le lien, jamais sur un span autour)
    nav = lambda h, t, k, cls="": f'<a{f" class=\"{cls}\"" if cls else ""} href="{racine}{h}"{" aria-current=\"page\"" if actif == k else ""}>{t}</a>'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre)} · KiraBench</title>
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
  <a class="mark" href="{racine}" aria-label="KiraBench home"><span class="k" data-kira="neutre" data-pad="0"></span><b>KiraBench</b></a>
  <nav aria-label="Main">{nav("results.html", "Results", "results")}{nav("benchmarks/", "Benchmarks", "benchmarks")}{nav("compare.html", "Compare", "compare", "hide-s")}<a class="hide-s" href="{racine}#alerts">Alerts</a></nav>
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


def logo(m, racine, cls="mlogo"):
    if m.get("logo"):
        return f'<img class="{cls}" src="{racine}{e(m["logo"])}" alt="" width="56" height="56">'
    lettres = "".join(w[0] for w in m["name"].split()[:2]).upper()
    return f'<span class="{cls} mono-logo" aria-hidden="true">{e(lettres)}</span>'


def apercu(run, racine, titre):
    src = f'{racine}lab/{run["model"]}/{run["benchmark"]}/index.html'
    return f"""<div class="lab" data-lab>
  <div class="labbar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="labtitle mono">{e(titre)}</span>
    <div class="seg" role="group" aria-label="Screen size">
      <button type="button" data-w="desktop" aria-pressed="true">Desktop</button><button type="button" data-w="phone" aria-pressed="false">Phone</button>
    </div>
    <a class="labopen" href="{src}" target="_blank" rel="noopener">Open full page</a>
  </div>
  <div class="labview"><iframe title="{e(titre)}, made by the model" src="{src}" sandbox="allow-scripts allow-forms"></iframe></div>
</div>"""


def chk(runs):
    """Score x/y avec l'infobulle de détail (même format que assets/site.js)."""
    ok = sum(passe(r)[0] for r in runs); n = sum(passe(r)[1] for r in runs)
    d = [{"title": B[r["benchmark"]]["title"], "items": [{"label": c["label"], "ok": bool(r["checks"][c["id"]])} for c in B[r["benchmark"]]["checks"] if c["id"] in r["checks"]], "notes": r.get("notes", [])} for r in runs]
    return f'<span class="chk" tabindex="0" role="button" aria-label="{ok}/{n} checks passed, show details" data-checks="{e(json.dumps(d))}">{ok}/{n}</span>'


def checks_html(run):
    b = B[run["benchmark"]]
    li = "".join(f'<li class="{"ok" if run["checks"].get(c["id"]) else "ko"}"><span class="mark2" aria-hidden="true">{"✓" if run["checks"].get(c["id"]) else "✗"}</span>{e(c["label"])}<span class="sr-only">{": passed" if run["checks"].get(c["id"]) else ": failed"}</span></li>' for c in b["checks"] if c["id"] in run["checks"])
    notes = "".join(f"<p class=\"note\">{e(n)}</p>" for n in run.get("notes", []))
    return f'<ul class="checks">{li}</ul>{notes}'


# ---------------------------------------------------------------- pages modèles
def page_modele(m):
    racine = "../../"
    runs = [r for r in D["runs"] if r["model"] == m["id"]]
    vit = [s for s in D["speed"] if s["model"] == m["id"]]
    base = M.get(m.get("base")) if m.get("base") else None
    faits = [("creator", e(m["creator"])), ("based on", f'<a href="{racine}models/{base["id"]}/">{e(base["name"])}</a>' if base else "original model"),
             ("license", e(m["license"])), ("parameters", e(m["params"])), ("weights", f'<a href="{e(m["hf"])}" rel="noopener">Hugging Face</a>')]
    rig = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in faits)
    vitesse = "".join(f"""<tr><td>{e(R[s["rig"]]["gpu"])}</td><td>{e(s["quant"])}</td><td class="num">{s["context"] // 1024}k</td><td class="num">{s["vram_gb"]} GB</td>
<td class="num">{s["pp512"]:,}</td><td class="num">{s["pp4096"]:,}</td><td class="num">{s["tg128"]}</td></tr>""" for s in vit)
    epreuves = ""
    for r in runs:
        b = B[r["benchmark"]]; ok, n = passe(r)
        epreuves += f"""<section class="run" id="{e(b["id"])}">
  <h3><a href="{racine}benchmarks/{b["id"]}/">{e(b["title"])}</a></h3>
  <p class="meta mono">{chk([r])} checks · built in {duree(r["seconds"])} · {len(r["files"])} file{"s" if len(r["files"]) > 1 else ""} ({e(", ".join(r["files"]))}) · {e(R[r["rig"]]["gpu"])}</p>
  {checks_html(r)}
  {apercu(r, racine, m["name"] + " · " + b["title"])}
  <details class="log" data-log="{racine}logs/{r["model"]}/{r["benchmark"]}.json"><summary>What the agent did, step by step</summary><div class="logbody"><p class="dim">Loading…</p></div></details>
  <p class="more"><a href="{racine}compare.html?b={b["id"]}">Compare with the other models on this test</a></p>
</section>"""
    pas_fait = [b for b in D["benchmarks"] if b["id"] not in {r["benchmark"] for r in runs}]
    if pas_fait:
        epreuves += f'<p class="dim">Not tested yet: {e(", ".join(b["title"] for b in pas_fait))}.</p>'
    claims = "".join(f'<li>{e(c["text"])} <span class="who">({e(c["who"])})</span></li>' for c in m.get("claims", [])) or "<li>No special claims: this is the base model.</li>"
    comm = "".join(f'<li><a href="{e(c["url"])}" rel="noopener">{e(c["title"])}</a> <span class="who">{e(c["source"])}</span></li>' for c in m.get("community", []))
    corps = f"""<section class="hero2">
  <p class="cmd"><b>$</b> kirabench model {e(m["id"])}</p>
  <div class="mhead">{logo(m, racine)}<h1>{e(m["name"])}</h1></div>
  <p class="sub">{e(m["about"])}</p>
  <dl class="rig">{rig}</dl>
</section>
<section>
  <p class="cmd"><b>$</b> kirabench speed {e(m["id"])}</p>
  <h2>Speed on our cards</h2>
  <p class="dim small">Prefill = how fast it reads (tokens per second), decode = how fast it writes. Measured with llama-bench, 3 runs.</p>
  <div class="tablewrap"><table><thead><tr><th scope="col">gpu</th><th scope="col">quant</th><th scope="col" class="num">context</th><th scope="col" class="num">vram used</th><th scope="col" class="num">prefill 512</th><th scope="col" class="num">prefill 4096</th><th scope="col" class="num">decode</th></tr></thead><tbody>{vitesse}</tbody></table></div>
</section>
<section>
  <p class="cmd"><b>$</b> kirabench tests {e(m["id"])}</p>
  <h2>What it built</h2>
  {epreuves}
</section>
<section class="split">
  <div><p class="cmd"><b>$</b> man {e(m["id"])}</p><h2>When to pick it</h2>
  <dl class="man"><dt>pick it if</dt><dd>{e(m["pick_if"])}</dd><dt>watch out</dt><dd>{e(m["watch_out"])}</dd></dl></div>
  <div><p class="cmd"><b>$</b> kirabench claims {e(m["id"])}</p><h2>What it claims</h2><ul class="plain">{claims}</ul>
  {f'<h2 style="margin-top:28px">What others say</h2><ul class="plain">{comm}</ul>' if comm else ""}</div>
</section>"""
    os.makedirs(os.path.join(SITE, "models", m["id"]), exist_ok=True)
    open(os.path.join(SITE, "models", m["id"], "index.html"), "w").write(
        page(m["name"], f'{m["name"]} tested on real hardware: speed, the websites and games it built, and every check it passed or failed.', racine, corps))


# ---------------------------------------------------------------- pages épreuves
def page_epreuve(b):
    racine = "../../"
    runs = [r for r in D["runs"] if r["benchmark"] == b["id"]]
    tete = "".join(f'<th scope="col" class="num">{e(c["label"])}</th>' for c in b["checks"])
    lignes = ""
    for r in sorted(runs, key=lambda r: (-passe(r)[0], r["seconds"])):
        m = M[r["model"]]; ok, n = passe(r)
        cel = "".join(f'<td class="num {"okc" if r["checks"].get(c["id"]) else "koc"}">{"✓" if r["checks"].get(c["id"]) else "✗"}</td>' for c in b["checks"])
        lignes += f'<tr><td><a href="{racine}models/{m["id"]}/#{b["id"]}">{e(m["name"])}</a></td>{cel}<td class="num">{chk([r])}</td><td class="num">{duree(r["seconds"])}</td></tr>'
    v = next((x for x in D.get("verdicts", []) if x["benchmark"] == b["id"]), None)
    verdict = ""
    if v:
        verdict = f"""<section><p class="cmd"><b>$</b> kirabench verdict {e(b["id"])}</p><h2>Our verdict</h2>
<dl class="man"><dt>human co-host</dt><dd>{e(M[v["human"]]["name"])}</dd><dt>kira</dt><dd>{e(M[v["kira"]]["name"])}</dd></dl>
<p class="dim">Then you are the second judge: open each one below and say which you would ship in the comments of the video.</p></section>"""
    galerie = "".join(f'<section class="run"><h3><a href="{racine}models/{r["model"]}/#{b["id"]}">{e(M[r["model"]]["name"])}</a></h3>{apercu(r, racine, M[r["model"]]["name"] + " · " + b["title"])}</section>' for r in runs)
    corps = f"""<section class="hero2">
  <p class="cmd"><b>$</b> kirabench test {e(b["id"])}</p>
  <h1>{e(b["title"])}</h1>
  <p class="sub">{e(b["harness"])}. Every model gets exactly this prompt:</p>
  <pre class="prompt">{e(b["prompt"])}</pre>
</section>
<section>
  <p class="cmd"><b>$</b> kirabench checks {e(b["id"])}</p>
  <h2>Results</h2>
  <p class="dim small">Automatic checks run in a real browser on what each model built. <a href="{racine}compare.html?b={b["id"]}">Compare them side by side</a>.</p>
  <div class="tablewrap"><table class="checks-t"><thead><tr><th scope="col">model</th>{tete}<th scope="col" class="num">checks</th><th scope="col" class="num">time</th></tr></thead><tbody>{lignes}</tbody></table></div>
</section>
{verdict}
<section><p class="cmd"><b>$</b> kirabench gallery {e(b["id"])}</p><h2>What each model built</h2>{galerie}</section>"""
    os.makedirs(os.path.join(SITE, "benchmarks", b["id"]), exist_ok=True)
    open(os.path.join(SITE, "benchmarks", b["id"], "index.html"), "w").write(
        page(b["title"], f'{b["title"]}: the same prompt given to every local model, the automatic checks and what each one built.', racine, corps))


# ---------------------------------------------------------------- comparaison
def page_compare():
    corps = """<section class="hero2">
  <p class="cmd"><b>$</b> kirabench compare</p>
  <h1>Compare side by side</h1>
  <p class="sub">Pick a test and the models. Each one is the real file the model wrote, running in your browser.</p>
</section>
<section>
  <div class="cmpctl" id="cmpctl"></div>
  <div class="cmpgrid" id="cmpgrid"></div>
</section>"""
    open(os.path.join(SITE, "compare.html"), "w").write(
        page("Compare", "Compare what local AI models built for the same prompt, side by side.", "", corps, "compare"))


def page_index_epreuves():
    racine = "../"
    blocs = ""
    for b in D["benchmarks"]:
        runs = [r for r in D["runs"] if r["benchmark"] == b["id"]]
        top = max((passe(r)[0] for r in runs), default=None)
        meilleurs = [r for r in runs if passe(r)[0] == top] if runs else []
        noms = ", ".join(M[r["model"]]["name"] for r in runs) or "no model yet"
        blocs += f"""<section class="run">
  <h3><a href="{racine}benchmarks/{b["id"]}/">{e(b["title"])}</a></h3>
  <p class="meta mono">{len(runs)} model{"s" if len(runs) != 1 else ""} tested · {len(b["checks"])} checks · {e(b["kind"])}</p>
  <p class="dim">{e(b["prompt"][:220])}{"…" if len(b["prompt"]) > 220 else ""}</p>
  <p class="dim small">Tested: {e(noms)}.{(" Most checks passed: " + ", ".join(f'<a href="{racine}models/{r["model"]}/#{b["id"]}">{e(M[r["model"]]["name"])}</a> ({chk([r])})' for r in meilleurs) + ".") if meilleurs else ""}</p>
  <p class="more"><a href="{racine}benchmarks/{b["id"]}/">Open the test</a> · <a href="{racine}compare.html?b={b["id"]}">Compare side by side</a></p>
</section>"""
    corps = f"""<section class="hero2">
  <p class="cmd"><b>$</b> kirabench tests --list</p>
  <h1>Every test, the same for every model</h1>
  <p class="sub">Each test is one prompt given to the model, with no help, then automatic checks in a real browser. Not every model has taken every test yet; new tests are added over time.</p>
</section>
<section>{blocs}</section>"""
    open(os.path.join(SITE, "benchmarks", "index.html"), "w").write(
        page("Benchmarks", "Every KiraBench test: the prompt, the checks and which local models passed them.", racine, corps, "benchmarks"))


def versionner():
    """Ajoute ?v=<empreinte> aux fichiers CSS/JS de toutes les pages : le navigateur recharge dès qu'un fichier change."""
    import hashlib, re
    emp = {}
    for f in ["assets/style.css", "assets/site.js", "assets/lab.js", "assets/kira.js", "assets/palette.js"]:
        emp[f] = hashlib.sha1(open(os.path.join(SITE, f), "rb").read()).hexdigest()[:8]
    pages = [os.path.join(dp, f) for dp, _, fs in os.walk(SITE) for f in fs if f.endswith(".html") and "/lab/" not in dp and "/.git" not in dp]
    for p in pages:
        s = open(p).read()
        for f, h in emp.items():
            s = re.sub(r'((?:\.\./)*' + re.escape(f) + r')(\?v=[0-9a-f]+)?"', r'\1?v=' + h + '"', s)
        open(p, "w").write(s)
    return len(pages)


for m in D["models"]:
    page_modele(m)
for b in D["benchmarks"]:
    page_epreuve(b)
page_compare()
page_index_epreuves()
print("versions ajoutées sur", versionner(), "pages")
print(len(D["models"]), "modèles,", len(D["benchmarks"]), "épreuves, compare.html")
