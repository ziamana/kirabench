// KiraBench : sprites, terminal du héros, résultats (data/results.json), inscription.
(function () {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  document.querySelectorAll("[data-kira]").forEach(el => {
    el.innerHTML = window.KiraSprite(el.dataset.kira || "neutre", Number(el.dataset.pad || 1));
  });

  // Terminal du héros : le texte est déjà dans la page ; on le retape une fois si le mouvement est permis.
  const pre = document.querySelector(".term pre");
  const face = document.querySelector(".term .kira svg");
  if (pre && !calm) {
    const lines = [...pre.querySelectorAll(":scope > span.l")];
    lines.forEach(l => { l.dataset.full = l.innerHTML; l.style.visibility = "hidden"; });
    let i = 0;
    const next = () => {
      if (i >= lines.length) { face && face.classList.remove("open"); return; }
      const l = lines[i++], cmd = l.classList.contains("cmd");
      l.style.visibility = "visible";
      if (!cmd) { face && face.classList.toggle("open", true); setTimeout(() => { face && face.classList.remove("open"); next(); }, 260); return; }
      const text = l.textContent, head = l.querySelector(".p").outerHTML; let n = 0;
      l.innerHTML = head;
      const t = setInterval(() => {
        n++; l.innerHTML = head + esc(text.slice(2, 2 + n));
        if (2 + n >= text.length) { clearInterval(t); l.innerHTML = l.dataset.full; setTimeout(next, 380); }
      }, 34);
    };
    setTimeout(next, 450);
  }

  // Résultats
  const holder = document.getElementById("results");
  if (holder) {
    fetch("data/kirabench.json", { cache: "no-store" })
      .then(r => r.json())
      .then(d => render(holder, versTableau(d), Number(holder.dataset.limit || 0)))
      .catch(() => { holder.innerHTML = `<div class="empty"><pre><span class="w">error</span> results could not be loaded. Refresh the page.</pre></div>`; });
  }

  // data/kirabench.json (modèles, épreuves, mesures) → lignes : une par modèle et par carte.
  // Vérifications = total sur les épreuves passées par ce modèle (un modèle n'a pas besoin de toutes les avoir faites).
  // Détail d'une épreuve pour l'infobulle : titre, chaque vérification réussie ou non, notes.
  function detailChecks(D, r) {
    const b = D.benchmarks.find(x => x.id === r.benchmark) || { title: r.benchmark, checks: [] };
    return { title: b.title, items: b.checks.filter(c => c.id in r.checks).map(c => ({ label: c.label, ok: !!r.checks[c.id] })), notes: r.notes || [] };
  }
  window.KB = Object.assign(window.KB || {}, { detailChecks });

  function versTableau(D) {
    const rig = D.rigs[0] || {};
    const rows = D.speed.map(s => {
      const m = D.models.find(x => x.id === s.model) || { name: s.model };
      const runs = D.runs.filter(r => r.model === s.model && r.rig === s.rig);
      const ok = runs.reduce((a, r) => a + Object.values(r.checks).filter(Boolean).length, 0);
      const n = runs.reduce((a, r) => a + Object.keys(r.checks).length, 0);
      const g = D.rigs.find(x => x.id === s.rig) || {};
      const detail = runs.map(r => detailChecks(D, r));
      return { id: s.model, model: m.name, gpu: g.gpu, quant: s.quant, context: s.context, vram_gb: s.vram_gb, pp_tok_s: s.pp512, tok_s: s.tg128,
               score: n ? Math.round(100 * ok / n) : 0, checks: n ? `${ok}/${n}` : "—", detail, tests: runs.length, fits: true };
    });
    const notes = "Context = tokens the model can keep in mind; vram is measured with that context loaded. Prefill = llama-bench pp512, decode = tg128, 3 runs. Checks = automatic browser checks passed on everything the model built (website, Snake game…), one prompt, no help. Click a model for the details.";
    return { rig: { gpu: [rig.gpu, rig.detail].filter(Boolean).join(" on ").replace(" on EVGA XC on", ", EVGA XC on"), cpu: rig.cpu, ram: rig.ram }, results: rows, notes, queue: ["more models that fit in 12 GB"] };
  }

  function render(el, data, limit) {
    const rig = document.getElementById("rig");
    if (rig && data.rig) {
      rig.innerHTML = [["gpu", data.rig.gpu], ["cpu", data.rig.cpu], ["memory", data.rig.ram]].filter(x => x[1])
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    }
    const rows = data.results || [];
    if (!rows.length) {
      el.innerHTML = `<div class="tablewrap"><div class="empty"><pre><span class="p">$</span> <span class="c">kirabench results</span>
no results yet.
queued: ${(data.queue || []).map(esc).join(", ")}</pre></div></div>`;
      return;
    }
    let key = "score", dir = -1, view = "all", gpu = "all";
    const gpus = [...new Set(rows.map(r => r.gpu))];
    const cols = [["model", "model", 0], ["gpu", "gpu", 0], ["quant", "quant", 0], ["context", "context", 1], ["vram_gb", "vram used", 1], ["pp_tok_s", "prefill t/s", 1], ["tok_s", "decode t/s", 1], ["score", "checks", 1], ["fits", "fits", 0]];
    const max = k => Math.max(...rows.map(r => Number(r[k]) || 0), 1);
    function draw() {
      let list = rows.filter(r => (gpu === "all" || r.gpu === gpu) && (view === "all" || (view === "fits" ? r.fits : !r.fits)));
      list.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir);
      if (limit) list = list.slice(0, limit);
      const mt = max("tok_s"), ms = max("score");
      el.innerHTML = `${limit ? "" : `${gpus.length > 1 ? `<div class="filters" role="group" aria-label="Filter by GPU">${
          [["all", "All GPUs"], ...gpus.map(g => [g, g])].map(([v, l]) =>
          `<button type="button" data-g="${esc(v)}" aria-pressed="${gpu === v}">${esc(l)}</button>`).join("")}</div>` : ""}
        <div class="filters" role="group" aria-label="Filter models">${
          [["all", "All models"], ["fits", "Fits in VRAM"], ["nofit", "Needs offload"]].map(([v, l]) =>
          `<button type="button" data-v="${v}" aria-pressed="${view === v}">${l}</button>`).join("")}</div>`}
        <div class="tablewrap"><table><thead><tr>${cols.map(([k, l, n]) =>
          `<th scope="col" data-k="${k}" class="${n ? "num" : ""}"${k === key ? ` aria-sort="${dir < 0 ? "descending" : "ascending"}"` : ""}>${l}</th>`).join("")}
        </tr></thead><tbody>${list.map(r => `<tr>
          <td>${r.id ? `<a href="models/${esc(r.id)}/">${esc(r.model)}</a>` : esc(r.model)}</td>
          <td>${esc(r.gpu)}</td>
          <td>${esc(r.quant)}</td>
          <td class="num">${r.context ? Math.round(r.context / 1024) + "k" : "—"}</td>
          <td class="num">${esc(r.vram_gb)} GB</td>
          <td class="num">${esc(r.pp_tok_s)}</td>
          <td class="num">${esc(r.tok_s)}<span class="meter" style="width:${Math.round(36 * r.tok_s / mt)}px"></span></td>
          <td class="num"><span class="chk" tabindex="0" role="button" aria-label="${esc(r.checks)} checks passed, show details" data-checks="${esc(JSON.stringify(r.detail || []))}">${esc(r.checks || r.score + "%")}</span><span class="meter" style="width:${Math.round(36 * r.score / ms)}px"></span></td>
          <td><span class="tag ${r.fits ? "" : "no"}">${r.fits ? "yes" : "offload"}</span></td>
        </tr>`).join("")}</tbody></table></div>`;
      if (!limit && data.notes) el.insertAdjacentHTML("beforeend", `<p class="notes">${esc(data.notes)}</p>`);
      el.querySelectorAll("th").forEach(th => th.onclick = () => { const k = th.dataset.k; dir = k === key ? -dir : -1; key = k; draw(); });
      el.querySelectorAll(".filters button[data-v]").forEach(b => b.onclick = () => { view = b.dataset.v; draw(); });
      el.querySelectorAll(".filters button[data-g]").forEach(b => b.onclick = () => { gpu = b.dataset.g; draw(); });
    }
    draw();
  }

  // Inscription : ajout seul dans Supabase (table alert_signups, RLS « insert » pour anon, aucune lecture possible).
  // La clé publishable est faite pour être publique ; la confirmation par e-mail (double opt-in) viendra avant toute alerte.
  const SB_URL = "https://pwehtuvjawtaqsfhyzvg.supabase.co/rest/v1/alert_signups";
  const SB_KEY = "sb_publishable_4QEkNcUUQWzv8tDV1u94Fg_5GeeZrEK";
  const MERCI = "You're on the list. Before any alert, we'll send you one email to confirm it's really you.";
  document.querySelectorAll("form.signup").forEach(f => {
    const msg = f.querySelector(".msg"), btn = f.querySelector("button[type=submit]");
    f.email.addEventListener("input", () => { f.email.removeAttribute("aria-invalid"); msg.classList.remove("err"); msg.textContent = ""; });
    f.addEventListener("submit", e => {
      e.preventDefault();
      if (btn.disabled) return;
      if (!f.vram.value) { msg.classList.add("err"); msg.textContent = "Pick your GPU memory so the alert matches your card."; f.vram.focus(); return; }
      if (!f.email.checkValidity()) {
        f.email.setAttribute("aria-invalid", "true"); msg.classList.add("err");
        msg.textContent = "That email doesn't look right. Check it and try again."; f.email.focus(); return;
      }
      msg.classList.remove("err");
      if (f.website && f.website.value) { msg.textContent = MERCI; f.reset(); return; } // champ piège : rempli = robot
      btn.disabled = true; msg.textContent = "Sending…";
      fetch(SB_URL, {
        method: "POST",
        headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ email: f.email.value.trim(), vram: Number(f.vram.value), newsletter: f.news.checked })
      }).then(r => {
        // 409 = déjà inscrit : même message, pour ne pas révéler qui est sur la liste
        if (r.ok || r.status === 409) { msg.textContent = MERCI; f.reset(); return; }
        throw new Error(r.status);
      }).catch(() => {
        msg.classList.add("err"); msg.textContent = "Something went wrong and nothing was saved. Try again in a minute.";
      }).finally(() => { btn.disabled = false; });
    });
  });

  // ---- infobulle des vérifications : tout élément [data-checks] (JSON : [{title, items:[{label, ok}], notes}])
  const tip = document.createElement("div");
  tip.className = "chktip"; tip.setAttribute("role", "tooltip"); tip.hidden = true;
  document.body.appendChild(tip);
  let cible = null;
  function montrer(el) {
    let d = [];
    try { d = JSON.parse(el.dataset.checks || "[]"); } catch (e) { return; }
    if (!d.length) return;
    tip.innerHTML = d.map(g => `<div class="g"><b>${esc(g.title)}</b><ul>${g.items.map(i =>
      `<li class="${i.ok ? "ok" : "ko"}"><span aria-hidden="true">${i.ok ? "✓" : "✗"}</span>${esc(i.label)}</li>`).join("")}</ul>${
      (g.notes || []).filter((n, k) => !g.items.every(i => i.ok) || k < 0).map(n => `<p>${esc(n)}</p>`).join("")}</div>`).join("");
    tip.hidden = false; cible = el;
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2, y = r.bottom + 8;
    x = Math.max(8, Math.min(x, innerWidth - t.width - 8));
    if (y + t.height > innerHeight - 8) y = r.top - t.height - 8;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  const cacher = () => { tip.hidden = true; cible = null; };
  document.addEventListener("mouseover", e => { const el = e.target.closest("[data-checks]"); if (el) montrer(el); });
  document.addEventListener("mouseout", e => { if (e.target.closest("[data-checks]") && !tip.contains(e.relatedTarget)) cacher(); });
  document.addEventListener("focusin", e => { const el = e.target.closest("[data-checks]"); if (el) montrer(el); });
  document.addEventListener("focusout", e => { if (e.target.closest("[data-checks]")) cacher(); });
  // un clic (ou un toucher sur téléphone) ouvre toujours ; cliquer ailleurs referme
  document.addEventListener("click", e => { const el = e.target.closest("[data-checks]"); if (el) { e.preventDefault(); montrer(el); } else cacher(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") cacher(); });
  // au défilement, l'infobulle suit son score (le focus d'un clic peut faire défiler la page)
  addEventListener("scroll", () => { if (cible && !tip.hidden) montrer(cible); }, { passive: true });
})();

