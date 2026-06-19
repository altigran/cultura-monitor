/* Cultura Monitor — mockup de Curadoria & Análise de posts do TikTok.
 * Estado persiste em localStorage (simula o "banco de dados").
 *   curator.decisions = { [id]: "saved" | "discarded" }
 *   curator.saved     = { [id]: { notes, hashtags: [] } }
 * Views: dashboard | timeline (fila) | curados (salvos) | reports (descartados)
 */
(function () {
  "use strict";

  const STORE_KEY = "curator.v1";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  let POSTS = [];
  let state = load();
  let view = "timeline";
  let activeChip = null;
  let modalPost = null;
  let pendingTags = [];

  const TITLES = {
    dashboard: ["Dashboard", "Visão geral da curadoria"],
    timeline: ["TimeLine", "Confira os posts recentes"],
    curados: ["Conteúdos Curados", "Posts salvos no banco com anotações"],
    reports: ["Conteúdos Reportados", "Posts descartados na triagem"],
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { decisions: {}, saved: {} }; }
    catch { return { decisions: {}, saved: {} }; }
  }
  function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  async function loadPosts() {
    if (Array.isArray(window.__POSTS__)) return window.__POSTS__;
    try { return await (await fetch("data/posts.json")).json(); } catch { return []; }
  }

  // ---- helpers ----
  const fmt = (n) =>
    n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(n);
  const handle = (url, author) => {
    const m = (url || "").match(/@([\w.]+)/);
    return m ? m[1] : (author || "").toLowerCase().replace(/\s+/g, "");
  };
  const initials = (s) => (s || "?").trim().slice(0, 1).toUpperCase();

  function postsFor(v) {
    const d = state.decisions;
    if (v === "curados") return POSTS.filter((p) => d[p.id] === "saved");
    if (v === "reports") return POSTS.filter((p) => d[p.id] === "discarded");
    return POSTS.filter((p) => !d[p.id]); // timeline
  }
  function tagsOf(p) {
    return (state.saved[p.id]?.hashtags?.length ? state.saved[p.id].hashtags : p.hashtags) || [];
  }
  function applyFilters(list) {
    const q = $("#search").value.trim().toLowerCase();
    return list.filter((p) => {
      if (activeChip && !tagsOf(p).map((t) => t.toLowerCase()).includes(activeChip)) return false;
      if (q) return (p.author + " " + p.caption + " " + tagsOf(p).join(" ")).toLowerCase().includes(q);
      return true;
    });
  }

  // ---- render raiz ----
  function render() {
    $$(".nav").forEach((n) => n.classList.toggle("is-active", n.dataset.view === view));
    $$(".subtab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
    $("#view-title").textContent = TITLES[view][0];
    $("#view-sub").textContent = TITLES[view][1];
    $("#count-timeline").textContent = postsFor("timeline").length;
    $("#count-curados").textContent = postsFor("curados").length;
    $("#count-reports").textContent = postsFor("reports").length;

    const isDash = view === "dashboard";
    $("#dashboard").hidden = !isDash;
    $("#grid").hidden = isDash;
    $(".subtabs").style.display = isDash ? "none" : "";
    $(".chips-row").style.display = isDash ? "none" : "";
    if (isDash) { $("#empty").hidden = true; return renderDash(); }

    renderChips();
    const list = applyFilters(postsFor(view));
    const grid = $("#grid");
    grid.innerHTML = "";
    const empty = $("#empty");
    if (!list.length) {
      empty.hidden = false;
      empty.textContent = activeChip || $("#search").value
        ? "Nenhum conteúdo para esse filtro."
        : { timeline: "🎉 Fila vazia! Tudo triado.", curados: "Nenhum conteúdo curado ainda.", reports: "Nenhum conteúdo reportado." }[view];
      return;
    }
    empty.hidden = true;
    list.forEach((p) => grid.appendChild(card(p)));
  }

  // ---- chips de hashtag ----
  function renderChips() {
    const counts = {};
    postsFor(view).forEach((p) => tagsOf(p).forEach((t) => (counts[t.toLowerCase()] = (counts[t.toLowerCase()] || 0) + 1)));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const box = $("#chips");
    box.innerHTML = "";
    if (activeChip) {
      const c = el("button", "chip clear", "✕ limpar");
      c.onclick = () => { activeChip = null; render(); };
      box.appendChild(c);
    }
    top.forEach(([t, n]) => {
      const c = el("button", "chip" + (activeChip === t ? " is-active" : ""), `#${t} · ${n}`);
      c.onclick = () => { activeChip = activeChip === t ? null : t; render(); };
      box.appendChild(c);
    });
    if (!top.length && !activeChip) box.innerHTML = `<span class="chips-label">sem tags</span>`;
  }

  // ---- card ----
  function card(p) {
    const at = handle(p.author_url || p.link, p.author);
    const saved = state.saved[p.id];
    const tags = tagsOf(p);

    const wrap = el("article", "pcard");

    // topo: status + ações
    const top = el("div", "pcard-top");
    const sc = el("div", "status-chips");
    if (view === "curados") sc.appendChild(el("span", "status curado", "Curado"));
    else if (view === "reports") sc.appendChild(el("span", "status report", "Reportado"));
    else tags.slice(0, 2).forEach((t) => sc.appendChild(el("span", "status", "#" + t)));
    top.appendChild(sc);
    top.appendChild(actionsFor(p));
    wrap.appendChild(top);

    // main: thumb + conteúdo
    const main = el("div", "pcard-main");
    const thumb = el("a", "pcard-thumb");
    thumb.href = p.link; thumb.target = "_blank"; thumb.rel = "noopener";
    thumb.innerHTML = `<img loading="lazy" src="${p.thumbnail}" alt="thumb de ${esc(p.author)}" onerror="this.style.opacity=.2">
      <span class="views">▶ ${fmt(p.views)}</span>`;
    main.appendChild(thumb);

    const content = el("div", "pcard-content");
    content.innerHTML = `
      <div class="pcard-author">
        <span class="avatar">${esc(initials(p.author))}</span>
        <b>${esc(p.author)}</b> <span class="handle">@${esc(at)}</span>
      </div>
      <div class="pcard-meta">Postado em ${esc(p.posted_at)} · ${p.metrics_simulated ? "métricas simuladas" : "métricas reais"} ·
        <a class="open-link" href="${p.link}" target="_blank" rel="noopener">abrir no TikTok ↗</a></div>
      <p class="pcard-caption">${esc(p.caption) || "&lt;sem legenda&gt;"}</p>
      <div class="pcard-metrics">
        ${metric(p.likes, "curtidas")}${metric(p.comments, "comentários")}${metric(p.shares, "compart.")}
      </div>
      ${tags.length ? `<div class="pcard-tags">${tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
      ${view === "curados" ? `<div class="pcard-note ${saved?.notes ? "" : "empty"}">${saved?.notes ? esc(saved.notes) : "Sem anotações."}</div>` : ""}
    `;
    main.appendChild(content);
    wrap.appendChild(main);
    return wrap;
  }

  const metric = (v, k) => `<span class="metric"><span class="v">${fmt(v)}</span><span class="k">${k}</span></span>`;

  function actionsFor(p) {
    const box = el("div", "pcard-acts");
    if (view === "timeline") {
      box.appendChild(actBtn("save", "🔖", "Curar", () => openModal(p)));
      box.appendChild(actBtn("discard", "✕", "Descartar", () => discard(p)));
    } else if (view === "curados") {
      box.appendChild(actBtn("save is-on", "✎", "Editar", () => openModal(p)));
      box.appendChild(actBtn("discard", "↩", "Devolver à fila", () => requeue(p)));
    } else {
      box.appendChild(actBtn("save", "↩", "Devolver à fila", () => requeue(p)));
    }
    return box;
  }
  function actBtn(cls, glyph, title, fn) {
    const b = el("button", "act " + cls, glyph);
    b.title = title; b.onclick = fn; return b;
  }

  // ---- ações ----
  function discard(p) {
    state.decisions[p.id] = "discarded"; persist(); render();
    toast(`Reportado: ${p.author}`, () => { delete state.decisions[p.id]; persist(); render(); });
  }
  function requeue(p) { delete state.decisions[p.id]; delete state.saved[p.id]; persist(); render(); }

  // ---- modal curar ----
  function openModal(p) {
    modalPost = p;
    const ex = state.saved[p.id];
    pendingTags = [...(ex?.hashtags || p.hashtags || [])];
    $("#notes").value = ex?.notes || "";
    $("#modal-context").textContent = `${p.author} — ${(p.caption || "").slice(0, 70)}`;
    $("#tag-input").value = "";
    renderTags();
    $("#modal").hidden = false;
    $("#notes").focus();
  }
  function closeModal() { $("#modal").hidden = true; modalPost = null; }
  function renderTags() {
    $("#taglist").innerHTML = pendingTags
      .map((t, i) => `<span class="tag">#${esc(t)} <button data-i="${i}" aria-label="remover">✕</button></span>`).join("");
    $$("#taglist button").forEach((b) => (b.onclick = () => { pendingTags.splice(+b.dataset.i, 1); renderTags(); }));
  }
  function addTag(raw) {
    const t = raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (t && !pendingTags.includes(t)) pendingTags.push(t);
    renderTags();
  }
  function confirmSave() {
    if (!modalPost) return;
    state.decisions[modalPost.id] = "saved";
    state.saved[modalPost.id] = { notes: $("#notes").value.trim(), hashtags: [...pendingTags] };
    persist();
    const a = modalPost.author; closeModal(); render();
    toast(`Salvo nos Curados: ${a}`);
  }

  // ---- dashboard ----
  function renderDash() {
    const q = postsFor("timeline").length, c = postsFor("curados").length, r = postsFor("reports").length;
    const total = POSTS.length;
    const counts = {};
    POSTS.filter((p) => state.decisions[p.id] === "saved")
      .forEach((p) => tagsOf(p).forEach((t) => (counts[t.toLowerCase()] = (counts[t.toLowerCase()] || 0) + 1)));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    $("#dashboard").innerHTML = `
      <div class="stat accent"><div class="n">${q}</div><div class="l">Na fila para triagem</div></div>
      <div class="stat"><div class="n">${c}</div><div class="l">Conteúdos curados</div></div>
      <div class="stat"><div class="n">${r}</div><div class="l">Conteúdos reportados</div></div>
      <div class="stat"><div class="n">${total ? Math.round(((c + r) / total) * 100) : 0}%</div><div class="l">Progresso da triagem</div></div>
      <div class="stat dash-wide">
        <h3>Tags mais usadas nos curados</h3>
        <div class="toplist">${top.length ? top.map(([t, n]) => `<span class="tag">#${esc(t)} <b>${n}</b></span>`).join("") : '<span class="chips-label">Nenhum conteúdo curado ainda.</span>'}</div>
      </div>`;
  }

  // ---- toast ----
  let toastTimer;
  function toast(msg, undo) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>`;
    if (undo) { const b = el("button", "", "Desfazer"); b.onclick = () => { clearTimeout(toastTimer); t.hidden = true; undo(); }; t.appendChild(b); }
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 4000);
  }

  // ---- util DOM ----
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- add modal ----
  function openAdd() { $("#add-modal").hidden = false; $("#add-url").value = ""; updateCmd(); $("#add-url").focus(); }
  function updateCmd() {
    const u = $("#add-url").value.trim() || "<cole a URL>";
    $("#add-cmd").textContent = `python3 tools/fetch.py "${u}"`;
  }

  // ---- wiring ----
  function go(v) { view = v; activeChip = null; render(); }
  function wire() {
    $$(".nav").forEach((n) => (n.onclick = () => go(n.dataset.view)));
    $$(".subtab").forEach((t) => (t.onclick = () => go(t.dataset.view)));
    $("#search").addEventListener("input", render);
    $("#search-btn").onclick = render;
    $("#modal-close").onclick = $("#modal-cancel").onclick = closeModal;
    $("#modal-confirm").onclick = confirmSave;
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
    $("#tag-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag($("#tag-input").value); $("#tag-input").value = ""; }
      else if (e.key === "Backspace" && !$("#tag-input").value && pendingTags.length) { pendingTags.pop(); renderTags(); }
    });
    $("#add-content").onclick = openAdd;
    $("#add-url").addEventListener("input", updateCmd);
    $("#add-close").onclick = $("#add-cancel").onclick = () => ($("#add-modal").hidden = true);
    $("#add-copy").onclick = () => {
      navigator.clipboard?.writeText($("#add-cmd").textContent).then(() => toast("Comando copiado!"));
    };
    $("#add-modal").addEventListener("click", (e) => { if (e.target.id === "add-modal") $("#add-modal").hidden = true; });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("#modal").hidden) closeModal();
      if (!$("#add-modal").hidden) $("#add-modal").hidden = true;
    });
  }

  loadPosts().then((d) => { POSTS = d; wire(); render(); });
})();
