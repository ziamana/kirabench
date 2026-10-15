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
    fetch("data/results.json", { cache: "no-store" })
      .then(r => r.json())
      .then(d => render(holder, d, Number(holder.dataset.limit || 0)))
      .catch(() => { holder.innerHTML = `<div class="empty"><pre><span class="w">error</span> results could not be loaded. Refresh the page.</pre></div>`; });
  }

  function render(el, data, limit) {
    const rig = document.getElementById("rig");
    if (rig && data.rig) {
      rig.innerHTML = [["gpu", data.rig.gpu], ["paid", data.rig.price], ["cpu", data.rig.cpu], ["memory", data.rig.ram]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    }
    const rows = data.results || [];
    if (!rows.length) {
      el.innerHTML = `<div class="tablewrap"><div class="empty"><pre><span class="p">$</span> <span class="c">kirabench results</span>
no results yet. first run starts when the card is installed.
queued: ${(data.queue || []).map(esc).join(", ")}</pre></div></div>`;
      return;
    }
    let key = "score", dir = -1, view = "all", gpu = "all";
    const gpus = [...new Set(rows.map(r => r.gpu))];
    const cols = [["model", "model", 0], ["gpu", "gpu", 0], ["quant", "quant", 0], ["vram_gb", "vram used", 1], ["tok_s", "tokens/s", 1], ["score", "score", 1], ["fits", "fits", 0]];
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
          <td>${r.video ? `<a href="${esc(r.video)}">${esc(r.model)}</a>` : esc(r.model)}</td>
          <td>${esc(r.gpu)}</td>
          <td>${esc(r.quant)}</td>
          <td class="num">${esc(r.vram_gb)} GB</td>
          <td class="num">${esc(r.tok_s)}<span class="meter" style="width:${Math.round(36 * r.tok_s / mt)}px"></span></td>
          <td class="num">${esc(r.score)}%<span class="meter" style="width:${Math.round(36 * r.score / ms)}px"></span></td>
          <td><span class="tag ${r.fits ? "" : "no"}">${r.fits ? "yes" : "offload"}</span></td>
        </tr>`).join("")}</tbody></table></div>`;
      el.querySelectorAll("th").forEach(th => th.onclick = () => { const k = th.dataset.k; dir = k === key ? -dir : -1; key = k; draw(); });
      el.querySelectorAll(".filters button[data-v]").forEach(b => b.onclick = () => { view = b.dataset.v; draw(); });
      el.querySelectorAll(".filters button[data-g]").forEach(b => b.onclick = () => { gpu = b.dataset.g; draw(); });
    }
    draw();
  }

  // Inscription : à brancher sur Brevo (double opt-in) une fois le compte créé.
  document.querySelectorAll("form.signup").forEach(f => {
    const msg = f.querySelector(".msg");
    f.email.addEventListener("input", () => { f.email.removeAttribute("aria-invalid"); msg.classList.remove("err"); msg.textContent = ""; });
    f.addEventListener("submit", e => {
      e.preventDefault();
      if (!f.vram.value) { msg.classList.add("err"); msg.textContent = "Pick your GPU memory so the alert matches your card."; f.vram.focus(); return; }
      if (!f.email.checkValidity()) {
        f.email.setAttribute("aria-invalid", "true"); msg.classList.add("err");
        msg.textContent = "That email doesn't look right. Check it and try again."; f.email.focus(); return;
      }
      msg.textContent = "Alerts open with the first benchmark run. Come back in a few days.";
    });
  });
})();
