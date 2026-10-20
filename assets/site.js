// KiraBench : sprites, tri du tableau complet, inscription, infobulle des vérifications.
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  document.querySelectorAll("[data-kira]").forEach(el => {
    el.innerHTML = window.KiraSprite(el.dataset.kira || "neutre", Number(el.dataset.pad || 1));
  });

  // data/public.json (écrit par tools/generer.py) : détail d'une épreuve pour l'infobulle (titre, chaque vérification, notes)
  function detailChecks(D, r) {
    const b = D.benchmarks.find(x => x.id === r.benchmark) || { title: r.benchmark, checks: [] };
    return { title: b.title + (r.nolimit ? " (no time limit)" : ""), items: b.checks.filter(c => c.id in r.checks).map(c => ({ label: c.label, ok: !!r.checks[c.id] })), notes: r.notes || [] };
  }
  window.KB = Object.assign(window.KB || {}, { detailChecks });

  // Tableau complet (results.html) : tri au clic sur une colonne, filtre par emplacement (carte seule / carte + RAM)
  document.querySelectorAll("table[data-sortable]").forEach(t => {
    const tb = t.tBodies[0], ths = [...t.tHead.rows[0].cells];
    let col = -1, dir = 1;
    const val = (tr, i) => { const c = tr.cells[i]; const v = c.dataset.v; return v !== undefined && v !== "" && !isNaN(v) ? Number(v) : c.textContent.trim().toLowerCase(); };
    ths.forEach((th, i) => {
      th.tabIndex = 0; th.classList.add("sortable");
      const go = () => {
        dir = col === i ? -dir : (th.classList.contains("num") ? -1 : 1); col = i;
        [...tb.rows].sort((a, b) => { const x = val(a, i), y = val(b, i); return (x > y ? 1 : x < y ? -1 : 0) * dir; }).forEach(r => tb.appendChild(r));
        ths.forEach(h => h.removeAttribute("aria-sort")); th.setAttribute("aria-sort", dir < 0 ? "descending" : "ascending");
      };
      th.addEventListener("click", go);
      th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  });
  document.querySelectorAll(".filters[role=group]").forEach(g => g.querySelectorAll("button[data-f]").forEach(b => b.addEventListener("click", () => {
    g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const t = g.parentElement.querySelector("tbody");
    t && [...t.rows].forEach(r => { r.hidden = b.dataset.f !== "all" && r.dataset.p !== b.dataset.f; });
  })));

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

