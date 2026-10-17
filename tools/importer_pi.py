#!/usr/bin/env python3
"""
Importe une épreuve Pi dans le site : fichiers créés par le modèle (lab/), journal compacté et nettoyé (logs/),
vignette (assets/img/). Usage :
  python3 tools/importer_pi.py <dossier run Pi> <id modèle> <id épreuve> [capture.png]
Le journal brut de Pi (événements --mode json) devient une suite de segments lisibles :
  {"t0", "t1", "kind": "thinking"|"text"|"tool", "text"|"tool"+"args"+"result"}
Les chemins locaux (/home/...) sont remplacés par des chemins relatifs.
"""
import json, os, re, shutil, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def nettoyer(x, base):
    if isinstance(x, str):
        x = x.replace(base + "/", "").replace(base, ".")
        x = re.sub(r"/home/[^/\s\"']+", "~", x)
        return re.sub(r"\b(tu44|aron)\b", "user", x)   # noms de compte (sorties de ls -l, invites)
    if isinstance(x, list):
        return [nettoyer(v, base) for v in x]
    if isinstance(x, dict):
        return {k: nettoyer(v, base) for k, v in x.items()}
    return x


def compacter(journal, base):
    segs, courant, outils = [], {}, {}
    for ligne in open(journal):
        r = json.loads(ligne); t = r["t"]
        try:
            e = json.loads(r["e"])
        except Exception:
            continue
        ty = e.get("type")
        if ty == "message_update":
            a = e.get("assistantMessageEvent", {}); at = a.get("type", ""); i = a.get("contentIndex")
            if at in ("thinking_start", "text_start", "toolcall_start"):
                kind = {"thinking_start": "thinking", "text_start": "text", "toolcall_start": "tool"}[at]
                courant[i] = {"t0": t, "t1": t, "kind": kind, "text": ""}
                if kind == "tool":
                    courant[i]["tool"] = a.get("toolName"); courant[i]["id"] = a.get("id")
            elif at.endswith("_delta") and i in courant:
                courant[i]["text"] += a.get("delta", ""); courant[i]["t1"] = t
            elif at.endswith("_end") and i in courant:
                s = courant.pop(i); s["t1"] = t
                if s["kind"] == "tool":
                    tc = a.get("toolCall", {}); s["args"] = tc.get("arguments", {}); s.pop("text", None)
                    outils[s.get("id")] = s
                segs.append(s)
        elif ty == "tool_execution_end":
            s = outils.get(e.get("toolCallId"))
            if s:
                res = e.get("result", {}).get("content", [])
                s["result"] = "".join(c.get("text", "") for c in res if isinstance(c, dict))[:4000]
                s["error"] = bool(e.get("isError"))
                s["t1"] = max(s["t1"], t)
    segs.sort(key=lambda s: s["t0"])
    for s in segs:
        s.pop("id", None)
        s["t0"], s["t1"] = round(s["t0"], 2), round(s["t1"], 2)
    return nettoyer(segs, base)


def main():
    run, modele, epreuve = sys.argv[1:4]
    capture = sys.argv[4] if len(sys.argv) > 4 else None
    base = os.path.join(os.path.abspath(run), "site")
    lab = os.path.join(SITE, "lab", modele, epreuve)
    shutil.rmtree(lab, ignore_errors=True)
    shutil.copytree(base, lab)
    logs = os.path.join(SITE, "logs", modele); os.makedirs(logs, exist_ok=True)
    segs = compacter(os.path.join(run, "journal.jsonl"), base)
    json.dump(segs, open(os.path.join(logs, epreuve + ".json"), "w"), ensure_ascii=False)
    if capture:
        from PIL import Image
        im = Image.open(capture).convert("RGB")
        im = im.crop((0, 0, im.width, min(im.height, int(im.width * 0.625))))
        im.thumbnail((960, 600))
        os.makedirs(os.path.join(SITE, "assets/img"), exist_ok=True)
        im.save(os.path.join(SITE, "assets/img", f"{modele}-{epreuve}.jpg"), quality=82)
    print(modele, epreuve, len(segs), "segments", round(os.path.getsize(os.path.join(logs, epreuve + ".json")) / 1024), "Ko")


if __name__ == "__main__":
    main()
