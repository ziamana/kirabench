// KiraBench : aperçus en direct (ordinateur / téléphone), journal de l'agent, page de comparaison.
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const racine = (document.querySelector('link[rel="stylesheet"]').getAttribute("href") || "").replace("assets/style.css", "");

  // ---- bascule ordinateur / téléphone sur chaque aperçu
  function brancherLab(lab) {
    lab.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => {
      lab.classList.toggle("phone", b.dataset.w === "phone");
      lab.querySelectorAll("[data-w]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    }));
  }
  document.querySelectorAll("[data-lab]").forEach(brancherLab);

  // ---- journal de l'agent : chargé à l'ouverture
  const temps = t => { t = Math.max(0, Math.round(t)); return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : `0:${String(t).padStart(2, "0")}`; };
  const court = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + " …" : s);
  function etape(s) {
    if (s.kind === "thinking") return `<li class="st th"><span class="tt mono">${temps(s.t0)}</span><div><b>thinking</b> <span class="dim">${Math.round(s.t1 - s.t0)} s</span><p>${esc(court(s.text || "", 420))}</p></div></li>`;
    if (s.kind === "text") return `<li class="st tx"><span class="tt mono">${temps(s.t0)}</span><div><b>says</b><p>${esc(court(s.text || "", 300))}</p></div></li>`;
    const a = s.args || {};
    let quoi = s.tool;
    if (s.tool === "write") quoi = `writes <code>${esc(a.path)}</code> <span class="dim">${(a.content || "").split("\n").length} lines</span>`;
    else if (s.tool === "edit") quoi = `edits <code>${esc(a.path)}</code>`;
    else if (s.tool === "read") quoi = `reads <code>${esc(a.path)}</code>`;
    else if (s.tool === "bash") quoi = `runs <code>${esc(court(a.command || "", 120))}</code>`;
    const res = s.result && s.tool !== "write" && s.tool !== "read" ? `<pre>${esc(court(s.result, 400))}</pre>` : "";
    return `<li class="st tl${s.error ? " err" : ""}"><span class="tt mono">${temps(s.t0)}</span><div><b>${quoi}</b>${res}</div></li>`;
  }
  document.querySelectorAll("details[data-log]").forEach(d => d.addEventListener("toggle", () => {
    if (!d.open || d.dataset.ok) return;
    d.dataset.ok = "1";
    fetch(d.dataset.log).then(r => r.json()).then(segs => {
      d.querySelector(".logbody").innerHTML = `<ol class="steps">${segs.map(etape).join("")}</ol>
        <p class="dim small">Times are from the real run. Thinking is shortened here; the full text is in the <a href="${esc(d.dataset.log)}">full log (JSON)</a>.</p>`;
    }).catch(() => { d.querySelector(".logbody").innerHTML = `<p class="dim">The log could not be loaded.</p>`; });
  }));

  // ---- page de comparaison
  const ctl = document.getElementById("cmpctl"), grid = document.getElementById("cmpgrid");
  if (!ctl) return;
  fetch(racine + "data/kirabench.json", { cache: "no-store" }).then(r => r.json()).then(D => {
    const p = new URLSearchParams(location.search);
    let bench = p.get("b") || D.benchmarks[0].id;
    let device = "desktop";
    const nom = id => (D.models.find(m => m.id === id) || {}).name || id;
    function dessiner() {
      const runs = D.runs.filter(r => r.benchmark === bench);
      const choisis = new Set((p.get("m") || runs.map(r => r.model).join(",")).split(",").filter(Boolean));
      ctl.innerHTML = `<div class="seg" role="group" aria-label="Test">${D.benchmarks.map(b =>
          `<button type="button" data-b="${esc(b.id)}" aria-pressed="${b.id === bench}">${esc(b.title)}</button>`).join("")}</div>
        <div class="seg" role="group" aria-label="Models">${runs.map(r =>
          `<button type="button" data-m="${esc(r.model)}" aria-pressed="${choisis.has(r.model)}">${esc(nom(r.model))}</button>`).join("")}</div>
        <div class="seg" role="group" aria-label="Screen size"><button type="button" data-w="desktop" aria-pressed="${device === "desktop"}">Desktop</button><button type="button" data-w="phone" aria-pressed="${device === "phone"}">Phone</button></div>`;
      const vus = runs.filter(r => choisis.has(r.model));
      grid.style.setProperty("--n", Math.max(1, vus.length));
      grid.innerHTML = vus.map(r => {
        const ok = Object.values(r.checks).filter(Boolean).length, n = Object.keys(r.checks).length;
        const src = `${racine}lab/${r.model}/${r.benchmark}/index.html`;
        return `<div class="lab${device === "phone" ? " phone" : ""}">
          <div class="labbar"><span class="labtitle"><a href="${racine}models/${esc(r.model)}/#${esc(bench)}">${esc(nom(r.model))}</a></span>
          <span class="mono dim">${ok}/${n} · ${r.seconds >= 60 ? Math.floor(r.seconds / 60) + " min " + String(r.seconds % 60).padStart(2, "0") + " s" : r.seconds + " s"}</span>
          <a class="labopen" href="${src}" target="_blank" rel="noopener">Open</a></div>
          <div class="labview"><iframe title="${esc(nom(r.model))}" src="${src}" sandbox="allow-scripts allow-forms"></iframe></div></div>`;
      }).join("") || `<p class="dim">Pick at least one model.</p>`;
      ctl.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { bench = b.dataset.b; p.set("b", bench); p.delete("m"); history.replaceState(null, "", "?" + p); dessiner(); });
      ctl.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
        choisis.has(b.dataset.m) ? choisis.delete(b.dataset.m) : choisis.add(b.dataset.m);
        p.set("m", [...choisis].join(",")); history.replaceState(null, "", "?" + p); dessiner();
      });
      ctl.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { device = b.dataset.w; dessiner(); });
    }
    dessiner();
  }).catch(() => { grid.innerHTML = `<p class="dim">The results could not be loaded. Refresh the page.</p>`; });
})();
