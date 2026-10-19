// Rejouer une partie coup par coup (page échecs). Données : window.KB_CHESS (tools/preparer_echecs.py).
// Position = k (−1 : départ, sinon index du demi-coup joué). Lien direct : #m=<k>. Flèches du clavier : coup précédent / suivant.
(() => {
  const G = window.KB_CHESS, root = document.querySelector("[data-chess]");
  if (!G || !root) return;
  const M = G.moves, N = M.length;
  const $ = (s) => root.querySelector(s);
  const FILES = "abcdefgh";
  const MARK = { blunder: "??", mistake: "?", inaccuracy: "?!" };
  const GRADE = { best: "Best move", good: "Good move", inaccuracy: "Inaccuracy", mistake: "Mistake", blunder: "Blunder" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const label = (d) => `${d.white ? d.n + "." : d.n + "…"} ${d.san}${MARK[d.grade] || ""}`;
  const evalTxt = (d) => d.mate !== null && d.mate !== undefined ? (d.mate === 0 ? (d.white ? "1-0" : "0-1") : (d.mate > 0 ? "+M" : "−M") + Math.abs(d.mate))
    : (d.eval > 0 ? "+" : d.eval < 0 ? "−" : "") + Math.abs(d.eval / 100).toFixed(1);
  const evalNum = (d) => d.mate !== null && d.mate !== undefined ? (d.mate >= 0 && !(d.mate === 0 && !d.white) ? 10 : -10) : Math.max(-10, Math.min(10, d.eval / 100));

  // ── échiquier : 64 cases, pièces en SVG (jeu cburnett)
  const plateau = $(".cz-board");
  let h = "";
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = FILES[f] + (8 - r);
    h += `<div class="sq ${(r + f) % 2 ? "d" : "l"}" data-sq="${sq}">${f === 0 ? `<i class="rk">${8 - r}</i>` : ""}${r === 7 ? `<i class="fl">${FILES[f]}</i>` : ""}<span class="pc"></span></div>`;
  }
  plateau.innerHTML = h;
  const cases = {}; plateau.querySelectorAll(".sq").forEach((c) => (cases[c.dataset.sq] = c));
  const piece = (s) => `<svg viewBox="0 0 45 45" aria-hidden="true">${G.pieces[s]}</svg>`;
  const NOM = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const lireFen = (fen) => { const pos = {}; fen.split("/").forEach((ligne, r) => { let f = 0;
    for (const ch of ligne) { if (/\d/.test(ch)) f += +ch; else { pos[FILES[f] + (8 - r)] = ch; f++; } } }); return pos; };

  // ── liste des coups
  const liste = $(".cz-moves");
  let lh = "";
  for (let k = 0; k < N; k += 2) {
    lh += `<span class="no">${M[k].n}.</span>`;
    for (const j of [k, k + 1]) lh += j < N ? `<button type="button" data-k="${j}" class="mv g-${M[j].grade}">${esc(M[j].san)}${MARK[M[j].grade] || ""}</button>` : "<span></span>";
  }
  liste.innerHTML = lh;
  liste.addEventListener("click", (ev) => { const b = ev.target.closest("[data-k]"); if (b) aller(+b.dataset.k); });

  // ── courbe d'évaluation
  const courbe = $(".cz-curve");
  const W = 800, H = 160, x = (k) => (k + 0.5) * W / N, y = (v) => H / 2 - v * (H / 2 - 8) / 10;
  const pts = M.map((d, k) => `${x(k).toFixed(1)},${y(evalNum(d)).toFixed(1)}`).join(" ");
  courbe.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Stockfish evaluation after every move, from White's side">
    <rect x="0" y="0" width="${W}" height="${H / 2}" class="cv-w" /><rect x="0" y="${H / 2}" width="${W}" height="${H / 2}" class="cv-b" />
    <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" class="cv-0" />
    <polyline points="${pts}" class="cv-l" vector-effect="non-scaling-stroke" />
    ${M.map((d, k) => d.grade === "blunder" ? `<circle cx="${x(k)}" cy="${y(evalNum(d))}" r="5" class="cv-bl" vector-effect="non-scaling-stroke" />` : "").join("")}
    <line class="cv-now" x1="0" y1="0" x2="0" y2="${H}" vector-effect="non-scaling-stroke" /></svg>`;
  courbe.addEventListener("click", (ev) => { const r = courbe.getBoundingClientRect(); aller(Math.min(N - 1, Math.max(0, Math.floor((ev.clientX - r.left) / r.width * N)))); });

  // ── afficher la position k
  let k = -1;
  function aller(nk, maj = true) {
    k = Math.max(-1, Math.min(N - 1, nk));
    const d = M[k], pos = lireFen(d ? d.fen : G.start);
    for (const [sq, c] of Object.entries(cases)) {
      const s = pos[sq], pc = c.querySelector(".pc");
      if (pc.dataset.s !== (s || "")) { pc.innerHTML = s ? piece(s) : ""; pc.dataset.s = s || ""; }
      c.classList.toggle("hl", !!d && (sq === d.from || sq === d.to));
      c.classList.toggle("chk", !!d && d.check && s === (d.white ? "k" : "K"));
      c.setAttribute("aria-label", sq + (s ? ", " + (s === s.toUpperCase() ? "white " : "black ") + NOM[s.toLowerCase()] : ""));
    }
    // barre d'évaluation + texte
    const v = d ? evalNum(d) : 0.2;
    $(".cz-evalfill").style.transform = `scaleY(${1 / (1 + Math.exp(-v / 3))})`;
    $(".cz-evaltxt").textContent = d ? evalTxt(d) : "+0.2";
    // panneau du coup
    const p = $(".cz-panel");
    if (!d) {
      p.innerHTML = `<p class="cz-who">Starting position</p><p class="cz-move">Move 0</p>
        <p class="dim">Claude Opus 5.5 has White (coin toss). Press <kbd>→</kbd> or Next to play the first move.</p>`;
    } else {
      const qui = d.player === "opus" ? "Claude Opus 5.5 · White" : "GPT-6 Astra · Black";
      const avant = k > 0 ? evalTxt(M[k - 1]) : "+0.2";
      const mieux = d.grade !== "best" && d.best && d.best !== d.san ? `<p class="small dim">Stockfish preferred <b class="mono">${esc(d.best)}</b>.</p>` : "";
      const ill = d.illegal ? `<div class="cz-ill"><p class="small"><b>Illegal move first.</b> Claude answered <b class="mono">${esc(d.illegal.san)}</b>, which is not legal here (its own knight on d2 blocks the queen). The referee asked again.</p>
        <blockquote>${esc(d.illegal.text)}</blockquote></div>` : "";
      const txt = d.text ? `<p class="cz-said">Claude wrote:</p><blockquote>${esc(d.text).replace(/\n+/g, "<br><br>")}</blockquote>`
        : d.player === "astra" ? `<p class="cz-said">Astra wrote:</p><blockquote class="mono">MOVE: ${esc(d.san)}</blockquote><p class="small dim">Astra never explained a move: its reasoning stays hidden in ChatGPT.</p>` : "";
      p.innerHTML = `<p class="cz-who">${qui}</p><p class="cz-move mono">${esc(label(d))}</p>
        <p class="cz-grade"><span class="tag g-${d.grade}">${GRADE[d.grade]}</span> <span class="mono small dim">eval ${avant} → ${evalTxt(d)} · answered in ${d.secs} s</span></p>
        ${mieux}${ill}${txt}`;
    }
    $(".cz-count").textContent = d ? `${k + 1} / ${N}` : `0 / ${N}`;
    $(".cz-range").value = k + 1;
    liste.querySelectorAll("[aria-current]").forEach((b) => b.removeAttribute("aria-current"));
    const actif = liste.querySelector(`[data-k="${k}"]`);
    if (actif) { actif.setAttribute("aria-current", "true"); const lr = liste.getBoundingClientRect(), br = actif.getBoundingClientRect();
      if (br.top < lr.top || br.bottom > lr.bottom) liste.scrollTop += br.top - lr.top - lr.height / 2; }
    courbe.querySelector(".cv-now").setAttribute("x1", k >= 0 ? x(k) : 0); courbe.querySelector(".cv-now").setAttribute("x2", k >= 0 ? x(k) : 0);
    root.querySelectorAll("[data-go]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.go === k ? "true" : "false"));
    if (maj) try { history.replaceState(null, "", k >= 0 ? `#m=${k}` : location.pathname); } catch {}
  }

  // ── commandes
  root.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
    const s = b.dataset.step; aller(s === "first" ? -1 : s === "last" ? N - 1 : k + +s);
  }));
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { aller(+b.dataset.go); plateau.scrollIntoView({ block: "nearest", behavior: "smooth" }); }));
  const range = $(".cz-range"); range.max = N; range.addEventListener("input", () => aller(+range.value - 1));
  document.addEventListener("keydown", (ev) => {
    if (ev.target.closest("input, textarea, select") || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === "ArrowRight") { aller(k + 1); ev.preventDefault(); }
    else if (ev.key === "ArrowLeft") { aller(k - 1); ev.preventDefault(); }
    else if (ev.key === "Home") { aller(-1); ev.preventDefault(); }
    else if (ev.key === "End") { aller(N - 1); ev.preventDefault(); }
  });
  const depuisUrl = () => { const m = /#m=(-?\d+)/.exec(location.hash); return m ? +m[1] : -1; };
  window.addEventListener("hashchange", () => aller(depuisUrl(), false));
  aller(depuisUrl(), false);
})();
