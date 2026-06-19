/* Cultura Monitor — mockup de Curadoria & Análise de posts do TikTok.
 * Estado persiste em localStorage (simula o "banco de dados" COMPARTILHADO).
 *
 * Fluxo de curadoria em 2 níveis, com vários papéis:
 *   fila (timeline) ──analista cura──▶ em revisão ──editor aprova──▶ publicado (curados)
 *                  └─analista descarta─▶ reportado
 *
 *   state.user            = id do usuário atual (analista ou editor)
 *   state.decisions[id]   = { status, by, at, editor?, editorAt? }
 *                           status ∈ "review" | "published" | "reported"
 *   state.saved[id]       = { notes, hashtags, by, at }   (conteúdo da curadoria)
 * Views: dashboard | timeline (fila) | revisao | curados (publicados) | reports
 */
(function () {
  "use strict";

  const STORE_KEY = "curator.v2";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Equipe simulada — alimenta o seletor "Você:" no topo.
  const USERS = [
    { id: "ana", name: "Ana Lima", role: "analyst" },
    { id: "bruno", name: "Bruno Sá", role: "analyst" },
    { id: "duda", name: "Duda (editora)", role: "editor" },
  ];
  const userById = (id) => USERS.find((u) => u.id === id) || USERS[0];

  let POSTS = [];
  let state = load();
  let view = "timeline";
  let activeChip = null;
  let modalPost = null;
  let pendingTags = [];

  const me = () => userById(state.user);
  const isEditor = () => me().role === "editor";

  const TITLES = {
    dashboard: ["Dashboard", "Visão geral da curadoria"],
    timeline: ["TimeLine", "Confira os posts recentes"],
    revisao: ["Em Revisão", "Curadoria dos analistas aguardando o editor"],
    curados: ["Conteúdos Curados", "Publicados após revisão do editor"],
    reports: ["Conteúdos Reportados", "Posts descartados na triagem"],
  };

  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { s = null; }
    if (!s || typeof s !== "object") s = {};
    if (!s.decisions) s.decisions = {};
    if (!s.saved) s.saved = {};
    if (!s.user || !USERS.some((u) => u.id === s.user)) s.user = USERS[0].id;
    return s;
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
  const now = () => new Date().toISOString();
  const whenLabel = (iso) => {
    if (!iso) return "";
    const d = new Date(iso), mins = Math.round((Date.now() - d) / 6e4);
    if (mins < 1) return "agora";
    if (mins < 60) return `há ${mins} min`;
    if (mins < 1440) return `há ${Math.round(mins / 60)} h`;
    return d.toLocaleDateString("pt-BR");
  };
  const nameOf = (id) => userById(id).name;

  function postsFor(v) {
    const d = state.decisions;
    if (v === "revisao") return POSTS.filter((p) => d[p.id]?.status === "review");
    if (v === "curados") return POSTS.filter((p) => d[p.id]?.status === "published");
    if (v === "reports") return POSTS.filter((p) => d[p.id]?.status === "reported");
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
    $("#count-revisao").textContent = postsFor("revisao").length;
    $("#count-revisao-nav").textContent = postsFor("revisao").length;
    $("#count-curados").textContent = postsFor("curados").length;
    $("#count-reports").textContent = postsFor("reports").length;
    document.body.classList.toggle("is-editor", isEditor());

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
        : {
            timeline: "🎉 Fila vazia! Tudo triado.",
            revisao: "Nada aguardando revisão.",
            curados: "Nenhum conteúdo publicado ainda.",
            reports: "Nenhum conteúdo reportado.",
          }[view];
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
    const dec = state.decisions[p.id];
    const tags = tagsOf(p);

    const wrap = el("article", "pcard");

    // topo: status + autoria + ações
    const top = el("div", "pcard-top");
    const sc = el("div", "status-chips");
    if (view === "revisao") {
      sc.appendChild(el("span", "status review", "Em revisão"));
      if (dec?.by) sc.appendChild(el("span", "status by", `curado por ${esc(nameOf(dec.by))}`));
    } else if (view === "curados") {
      sc.appendChild(el("span", "status curado", "Publicado"));
      if (dec?.by) sc.appendChild(el("span", "status by", `por ${esc(nameOf(dec.by))}`));
      if (dec?.editor) sc.appendChild(el("span", "status ok", `✓ ${esc(nameOf(dec.editor))}`));
    } else if (view === "reports") {
      sc.appendChild(el("span", "status report", "Reportado"));
      if (dec?.by) sc.appendChild(el("span", "status by", `por ${esc(nameOf(dec.by))}`));
    } else {
      tags.slice(0, 2).forEach((t) => sc.appendChild(el("span", "status", "#" + t)));
    }
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

    const stamp =
      view === "curados" && dec
        ? `<div class="pcard-stamp">Curado por <b>${esc(nameOf(dec.by))}</b> · publicado por <b>${esc(nameOf(dec.editor))}</b> ${esc(whenLabel(dec.editorAt))}</div>`
        : view === "revisao" && dec
        ? `<div class="pcard-stamp">Curado por <b>${esc(nameOf(dec.by))}</b> ${esc(whenLabel(dec.at))}</div>`
        : "";

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
      ${stamp}
      ${(view === "curados" || view === "revisao") ? `<div class="pcard-note ${saved?.notes ? "" : "empty"}">${saved?.notes ? esc(saved.notes) : "Sem anotações."}</div>` : ""}
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
    } else if (view === "revisao") {
      if (isEditor()) box.appendChild(actBtn("approve", "✓", "Aprovar e publicar", () => approve(p)));
      box.appendChild(actBtn("save is-on", "✎", "Editar curadoria", () => openModal(p)));
      box.appendChild(actBtn("discard", "↩", "Devolver à fila", () => requeue(p)));
    } else if (view === "curados") {
      box.appendChild(actBtn("save is-on", "✎", "Editar curadoria", () => openModal(p)));
      if (isEditor()) box.appendChild(actBtn("discard", "↩", "Despublicar (volta à revisão)", () => unpublish(p)));
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
    state.decisions[p.id] = { status: "reported", by: state.user, at: now() };
    persist(); render();
    toast(`Reportado: ${p.author}`, () => { delete state.decisions[p.id]; persist(); render(); });
  }
  function requeue(p) { delete state.decisions[p.id]; delete state.saved[p.id]; persist(); render(); }

  function approve(p) {
    if (!isEditor()) return;
    const dec = state.decisions[p.id] || {};
    state.decisions[p.id] = { ...dec, status: "published", editor: state.user, editorAt: now() };
    persist(); render();
    toast(`Publicado: ${p.author}`, () => {
      const d = state.decisions[p.id]; delete d.editor; delete d.editorAt; d.status = "review";
      persist(); render();
    });
  }
  function unpublish(p) {
    if (!isEditor()) return;
    const dec = state.decisions[p.id] || {};
    delete dec.editor; delete dec.editorAt; dec.status = "review";
    state.decisions[p.id] = dec; persist(); render();
    toast(`Devolvido à revisão: ${p.author}`);
  }

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
    const id = modalPost.id;
    const prev = state.decisions[id];
    if (prev) {
      // editando uma curadoria existente — preserva o estágio do pipeline.
      state.decisions[id] = prev;
    } else {
      // primeira curadoria: entra na fila de revisão, atribuída a quem curou.
      state.decisions[id] = { status: "review", by: state.user, at: now() };
    }
    const sv = state.saved[id] || {};
    state.saved[id] = {
      notes: $("#notes").value.trim(),
      hashtags: [...pendingTags],
      by: sv.by || state.user,
      at: sv.at || now(),
    };
    persist();
    const a = modalPost.author; closeModal(); render();
    toast(prev ? `Curadoria atualizada: ${a}` : `Enviado para revisão: ${a}`);
  }

  // ---- dashboard ----
  function renderDash() {
    const q = postsFor("timeline").length, rv = postsFor("revisao").length;
    const c = postsFor("curados").length, r = postsFor("reports").length;
    const total = POSTS.length;
    const counts = {};
    POSTS.filter((p) => state.decisions[p.id]?.status === "published")
      .forEach((p) => tagsOf(p).forEach((t) => (counts[t.toLowerCase()] = (counts[t.toLowerCase()] || 0) + 1)));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);

    // produção por analista (curadoria enviada à revisão/publicada)
    const byAnalyst = {};
    POSTS.forEach((p) => {
      const d = state.decisions[p.id];
      if (d && (d.status === "review" || d.status === "published") && d.by)
        byAnalyst[d.by] = (byAnalyst[d.by] || 0) + 1;
    });
    const analystRows = USERS.filter((u) => u.role === "analyst").map((u) =>
      `<span class="tag">${esc(u.name)} <b>${byAnalyst[u.id] || 0}</b></span>`).join("");

    $("#dashboard").innerHTML = `
      <div class="stat accent"><div class="n">${q}</div><div class="l">Na fila para triagem</div></div>
      <div class="stat"><div class="n">${rv}</div><div class="l">Aguardando revisão</div></div>
      <div class="stat"><div class="n">${c}</div><div class="l">Publicados</div></div>
      <div class="stat"><div class="n">${r}</div><div class="l">Conteúdos reportados</div></div>
      <div class="stat"><div class="n">${total ? Math.round(((c + r) / total) * 100) : 0}%</div><div class="l">Progresso da triagem</div></div>
      <div class="stat dash-wide">
        <h3>Curadoria enviada por analista</h3>
        <div class="toplist">${analystRows || '<span class="chips-label">Sem curadoria ainda.</span>'}</div>
      </div>
      <div class="stat dash-wide">
        <h3>Tags mais usadas nos publicados</h3>
        <div class="toplist">${top.length ? top.map(([t, n]) => `<span class="tag">#${esc(t)} <b>${n}</b></span>`).join("") : '<span class="chips-label">Nenhum conteúdo publicado ainda.</span>'}</div>
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

  // ---- seletor de usuário ----
  function renderUserSelect() {
    const sel = $("#user-select");
    sel.innerHTML = USERS.map((u) =>
      `<option value="${u.id}">${esc(u.name)} — ${u.role === "editor" ? "Editor" : "Analista"}</option>`).join("");
    sel.value = state.user;
  }

  // ---- wiring ----
  function go(v) { view = v; activeChip = null; render(); }
  function wire() {
    $$(".nav").forEach((n) => (n.onclick = () => go(n.dataset.view)));
    $$(".subtab").forEach((t) => (t.onclick = () => go(t.dataset.view)));
    $("#user-select").onchange = (e) => { state.user = e.target.value; persist(); render(); toast(`Você agora é ${me().name}`); };
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

  loadPosts().then((d) => { POSTS = d; renderUserSelect(); wire(); render(); });
})();
