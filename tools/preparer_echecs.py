#!/usr/bin/env python3
"""
Prépare les données de la page échecs (ép. 5, Claude Opus 5.5 contre GPT-6 Astra) à partir de ~/projets/kirabench-echecs :
partie.json (coups, temps), analyse.json (Stockfish 19, prof. 20), conversations/opus.json (explications complètes de Claude).
Écrit data/chess-opus-astra.json et chess/opus-vs-astra/game.pgn. À lancer avec le venv qui a python-chess :
  ~/projets/kirabench-echecs/.venv/bin/python tools/preparer_echecs.py
"""
import json, os, re
import chess, chess.pgn, chess.svg

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = os.path.expanduser("~/projets/kirabench-echecs")
p = json.load(open(f"{E}/partie.json"))
an = json.load(open(f"{E}/analyse.json"))
A = [m for m in json.load(open(f"{E}/conversations/opus.json")) if m["s"] == "assistant"]
GRADE = {"meilleur": "best", "bon": "good", "imprécision": "inaccuracy", "erreur": "mistake", "gaffe": "blunder"}
MV = re.compile(r"MOVE\s*:\s*\**\s*([A-Za-z0-9+#=\-O]+)")
propre = lambda t: re.sub(r"\n*MOVE\s*:.*$", "", t.strip(), flags=re.S).strip()

# explications de Claude : messages complets de la conversation, alignés sur ses coups joués (le coup illégal 26.Qxc2 est gardé à part)
opus = [c for c in p["coups"] if c["joueur"] == "opus"]
textes, illegal, i = {}, None, 0
for m in A:
    mv = (MV.findall(m["t"]) or ["?"])[-1].rstrip("+#")
    if i < len(opus) and mv == opus[i]["san"].rstrip("+#"):
        textes.setdefault(opus[i]["n"], propre(m["t"])); i += 1
    elif mv == "Qxc2" and illegal is None:
        illegal = {"n": 26, "san": "Qxc2", "text": propre(m["t"])}
assert i == len(opus), "explications mal alignées"

b = chess.Board(); demi = []
for c, x in zip(p["coups"], an["coups"]):
    mv = chess.Move.from_uci(c["uci"]); blanc = b.turn == chess.WHITE
    san = b.san(mv); b.push(mv)
    demi.append({"n": c["n"], "white": blanc, "player": c["joueur"], "san": san, "from": c["uci"][:2], "to": c["uci"][2:4],
                 "fen": b.board_fen(), "eval": x["eval"], "mate": x["mat_en"], "grade": GRADE[x["classe"]], "loss": x["perte"],
                 "best": x["meilleur"], "secs": round(c["secondes"]), "check": b.is_check(),
                 "text": textes.get(c["n"]) if c["joueur"] == "opus" else None})
demi[hk := 2 * (26 - 1)]["illegal"] = illegal
assert b.is_checkmate()

out = {"white": "Claude Opus 5.5", "black": "GPT-6 Astra", "result": "0-1", "start": chess.Board().board_fen(),
       "pieces": dict(chess.svg.PIECES), "moves": demi}
json.dump(out, open(os.path.join(SITE, "data/chess-opus-astra.json"), "w"), ensure_ascii=False, separators=(",", ":"))

g = chess.pgn.Game()
g.headers.update({"Event": "KiraBench episode 5", "Site": "https://kirabench.com/chess/opus-vs-astra/", "Date": "2026.10.18",
                  "White": "Claude Opus 5.5 (claude.ai, effort high)", "Black": "GPT-6 Astra (ChatGPT, effort high)", "Result": "0-1",
                  "Annotator": "Stockfish 19, depth 20"})
nd = g; NAG = {"blunder": 4, "mistake": 2, "inaccuracy": 6}
for c, d in zip(p["coups"], demi):
    nd = nd.add_variation(chess.Move.from_uci(c["uci"]))
    if d["grade"] in NAG: nd.nags.add(NAG[d["grade"]])
open(os.path.join(SITE, "chess/opus-vs-astra/game.pgn"), "w").write(str(g) + "\n")
print(len(demi), "demi-coups ;", sum(1 for d in demi if d["text"]), "explications de Claude ; illégal :", illegal["san"])
