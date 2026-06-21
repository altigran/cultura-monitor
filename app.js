/* Culture Monitor — mockup de Curadoria por Tópico (modelo live.tt).
 *
 * Território (agrupa) ▸ Tópico (1 robô + palavras-chave) ▸ posts coletados.
 * A curadoria é POR TÓPICO: o analista escolhe um tópico (contexto) e trabalha
 * a fila daquele robô. Pós-moderação, 2 níveis:
 *   Timeline(tópico) ─analista cura─▶ Workspace(tópico) ─editor descarta─▶ Descarte(tópico)
 *                    └─analista descarta────────────────────────────────▶ Descarte(tópico)
 * Sobreposição: um post pode pertencer a vários tópicos; a decisão é por
 * (tópico × post). "Manter" no Workspace é implícito; só o editor poda.
 *
 *   state.user                       = usuário atual (analista | editor)
 *   state.topic                      = tópico em foco (contexto de trabalho)
 *   state.decisions[topic][postId]   = { status, by, at }   status: published | reported
 *   state.saved[topic][postId]       = { notes, hashtags, by, at }
 *   state.added                      = posts incluídos manualmente (com .topics)
 */
(function () {
  "use strict";

  const STORE_KEY = "curator.v3";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Catálogo Território → Tópico. No mockup é fixo (quem define fica para depois).
  const TERRITORIES = [
    { id: "esportes", name: "Esportes", topics: [
      { id: "volei", name: "Vôlei" },
      { id: "basquete", name: "Basquete (NBA, NBB)" },
      { id: "surf", name: "Surf" },
    ] },
    { id: "musica", name: "Música", topics: [
      { id: "pop", name: "Pop nacional" },
      { id: "rap", name: "Rap & Trap" },
    ] },
    { id: "cinema", name: "Cinema, TV & Streaming", topics: [
      { id: "series", name: "Séries & Streaming" },
      { id: "estreias", name: "Estreias de cinema" },
    ] },
  ];
  const ALL_TOPICS = TERRITORIES.flatMap((t) => t.topics.map((tp) => tp.id));
  const topicName = (id) => {
    for (const t of TERRITORIES) { const tp = t.topics.find((x) => x.id === id); if (tp) return tp.name; }
    return id;
  };
  const territoryOfTopic = (id) => TERRITORIES.find((t) => t.topics.some((x) => x.id === id)) || null;

  // Eixos de classificação adicionais (modelo do deck).
  // Tipo de Expressão: vocabulário "chutado"; o robô pré-classifica (ver botTipo).
  const TIPOS = ["Comunidade", "Meme", "Formato", "Tendência", "Notícia"];
  // Marcas vinculáveis = "Clientes atuais" do deck.
  const CLIENTES = ["Amstel", "TikTok", "Eletrolux", "Mondelez", "Riachuelo", "Stanley"];

  // Plataformas (a ferramenta é multiplataforma; hoje só TikTok está ativo).
  const PLATFORMS = [
    { id: "tiktok", name: "TikTok" },
    { id: "instagram", name: "Instagram" },
    { id: "x", name: "X" },
  ];
  const ACTIVE_PLATFORMS = ["tiktok"]; // os demais entram "em breve"
  const platformOf = (p) => p.platform || "tiktok";
  const platformName = (id) => (PLATFORMS.find((p) => p.id === id) || {}).name || id;

  // Equipe simulada — alimenta o seletor "Você:".
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
  let activePlatform = "todas";
  let mineOnly = false;
  let modalPost = null;
  let pendingTags = [];
  let pendingContextos = [];
  let pendingMarcas = [];

  const me = () => userById(state.user);
  const isEditor = () => me().role === "editor";

  // Acesso ao estado do tópico atual (cria o "saco" sob demanda).
  const decBag = () => (state.decisions[state.topic] ||= {});
  const savedBag = () => (state.saved[state.topic] ||= {});
  const dOf = (p) => state.decisions[state.topic]?.[p.id];
  const sOf = (p) => state.saved[state.topic]?.[p.id];
  // "Enviado por mim": minha inclusão manual, ou minha curadoria/decisão.
  const sentByMe = (p) => isManual(p) ? p.added_by === state.user : (dOf(p)?.by === state.user || sOf(p)?.by === state.user);

  const TITLES = {
    dashboard: ["Dashboard", "Efetividade da automação — todos os tópicos"],
    timeline: ["TimeLine", "Confira os posts recentes"],
    curados: ["Workspace", "Curado pela equipe — o editor mantém ou descarta"],
    reports: ["Descarte", "Posts descartados na triagem ou pelo editor"],
  };

  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { s = null; }
    if (!s || typeof s !== "object") s = {};
    if (!s.decisions) s.decisions = {};
    if (!s.saved) s.saved = {};
    if (!Array.isArray(s.added)) s.added = [];
    if (!s.user || !USERS.some((u) => u.id === s.user)) s.user = USERS[0].id;
    if (!s.topic || !ALL_TOPICS.includes(s.topic)) s.topic = ALL_TOPICS[0];
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

  // Coleta simulada: o robô do tópico roda na madrugada — sempre "ontem ~03:14".
  function lastRun() {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(3, 14, 0, 0); return d;
  }
  function dayWhen(d) {
    const day0 = new Date(d); day0.setHours(0, 0, 0, 0);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const diff = Math.round((t0 - day0) / 864e5);
    const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${diff === 0 ? "hoje" : diff === 1 ? "ontem" : d.toLocaleDateString("pt-BR")} às ${hm}`;
  }
  const isManual = (p) => p.source === "manual";
  function provenance(p) {
    return isManual(p)
      ? `✋ Adicionado por ${esc(nameOf(p.added_by))} ${esc(whenLabel(p.added_at))}`
      : `🤖 Coletado ${esc(dayWhen(lastRun()))}`;
  }
  // Tipo de Expressão pré-classificado pelo robô (manual não vem classificado).
  function botTipo(p) {
    if (isManual(p)) return "";
    const h = String(p.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return TIPOS[h % TIPOS.length];
  }

  // Pertinência por tópico (com sobreposição). Posts manuais trazem .topics
  // explícito; para o dataset, distribuição determinística pelo id.
  function postInTopic(p, topicId) {
    if (Array.isArray(p.topics)) return p.topics.includes(topicId);
    const ti = ALL_TOPICS.indexOf(topicId);
    const h = String(p.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    if (ALL_TOPICS[h % ALL_TOPICS.length] === topicId) return true; // tópico primário garantido
    return (h + ti) % 3 === 0; // sobreposição
  }
  const topicPosts = () => POSTS.filter((p) => postInTopic(p, state.topic));

  function postsFor(v) {
    const inTopic = topicPosts();
    if (v === "curados") return inTopic.filter((p) => dOf(p)?.status === "published");
    if (v === "reports") return inTopic.filter((p) => dOf(p)?.status === "reported");
    // timeline: contribuição humana (manual) entra com prioridade — sobe ao topo.
    const pending = inTopic.filter((p) => !dOf(p));
    return [...pending.filter(isManual), ...pending.filter((p) => !isManual(p))];
  }
  function tagsOf(p) {
    const s = sOf(p);
    return (s?.hashtags?.length ? s.hashtags : p.hashtags) || [];
  }
  function applyFilters(list) {
    const q = $("#search").value.trim().toLowerCase();
    return list.filter((p) => {
      if (activePlatform !== "todas" && platformOf(p) !== activePlatform) return false;
      if (mineOnly && !sentByMe(p)) return false;
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
    document.body.classList.toggle("is-editor", isEditor());

    const terr = territoryOfTopic(state.topic);
    $("#crumbs").innerHTML = `${esc(terr ? terr.name : "—")} <span class="sep">›</span> <b>${esc(topicName(state.topic))}</b>`;

    const isDash = view === "dashboard";
    $("#dashboard").hidden = !isDash;
    $("#grid").hidden = isDash;
    $(".subtabs").style.display = isDash ? "none" : "";
    $(".chips-row").style.display = isDash ? "none" : "";
    if (isDash) { $("#empty").hidden = true; $("#collect-banner").hidden = true; return renderDash(); }

    // Faixa de proveniência, escopada ao tópico atual.
    const banner = $("#collect-banner");
    if (view === "timeline") {
      banner.hidden = false;
      const inTopic = topicPosts();
      const botN = inTopic.filter((p) => !isManual(p)).length;
      const manualN = inTopic.filter(isManual).length;
      banner.innerHTML = `<span class="cb-bot">🤖 Coleta automática</span>
        <span class="cb-info"><b>${botN}</b> posts do robô de <b>${esc(topicName(state.topic))}</b> · ${esc(dayWhen(lastRun()))}${manualN ? ` · <b>${manualN}</b> ✋ manuais` : ""}</span>
        <span class="cb-q"><b>${postsFor("timeline").length}</b> na fila para triagem</span>`;
    } else if (view === "curados") {
      banner.hidden = false;
      const pub = postsFor("curados");
      const curators = new Set(pub.map((p) => dOf(p)?.by).filter(Boolean));
      banner.innerHTML = `<span class="cb-bot cb-ws">📋 Workspace</span>
        <span class="cb-info"><b>${esc(topicName(state.topic))}</b> · <b>${pub.length}</b> ${pub.length === 1 ? "item curado" : "itens curados"}${curators.size ? ` por <b>${curators.size}</b> ${curators.size === 1 ? "analista" : "analistas"}` : ""}</span>
        <span class="cb-q">🤝 compartilhado pela equipe</span>`;
    } else banner.hidden = true;

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
            timeline: "🎉 Fila vazia! Tudo triado neste tópico.",
            curados: "Workspace vazio — nada curado neste tópico ainda.",
            reports: "Nada descartado neste tópico.",
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
    const saved = sOf(p);
    const dec = dOf(p);
    const tags = tagsOf(p);

    const wrap = el("article", "pcard" + (isManual(p) && view === "timeline" ? " is-priority" : ""));

    // topo: status + autoria + ações
    const top = el("div", "pcard-top");
    const sc = el("div", "status-chips");
    if (view === "curados") {
      sc.appendChild(el("span", "status curado", "Curado"));
      if (saved?.tipoExpressao) sc.appendChild(el("span", "status tipo", esc(saved.tipoExpressao)));
      (saved?.marcas || []).forEach((m) => sc.appendChild(el("span", "status marca", "● " + esc(m))));
      if (dec?.by) sc.appendChild(el("span", "status by", `por ${esc(nameOf(dec.by))}`));
    } else if (view === "reports") {
      sc.appendChild(el("span", "status report", "Descartado"));
      if (dec?.by) sc.appendChild(el("span", "status by", `por ${esc(nameOf(dec.by))}`));
    } else {
      sc.appendChild(el("span", "status pending", "⏳ Curadoria pendente"));
      if (isManual(p)) {
        sc.appendChild(el("span", "status priority", "★ prioritário"));
        sc.appendChild(el("span", "status manual", "✋ manual"));
      } else sc.appendChild(el("span", "status tipo", esc(botTipo(p))));
    }
    top.appendChild(sc);
    top.appendChild(actionsFor(p));
    wrap.appendChild(top);

    // main: thumb + conteúdo
    const main = el("div", "pcard-main");
    const thumb = el("a", "pcard-thumb");
    thumb.href = p.link; thumb.target = "_blank"; thumb.rel = "noopener";
    const platBadge = `<span class="plat">${esc(platformName(platformOf(p)))}</span>`;
    thumb.innerHTML = p.thumbnail
      ? `<img loading="lazy" src="${p.thumbnail}" alt="thumb de ${esc(p.author)}" onerror="this.style.opacity=.2">
         ${platBadge}<span class="views">▶ ${fmt(p.views)}</span>`
      : `${platBadge}<span class="thumb-ph">✋<small>sem prévia</small></span>`;
    main.appendChild(thumb);

    const stamp =
      view === "curados" && dec
        ? `<div class="pcard-stamp">Curado por <b>${esc(nameOf(dec.by))}</b> ${esc(whenLabel(dec.at))}</div>`
        : "";

    const terrN = territoryOfTopic(state.topic)?.name || "—";
    const classLine =
      view === "curados"
        ? `<div class="pcard-class"><b>${esc(terrN)} ▸ ${esc(topicName(state.topic))}</b>${
            (saved?.contextos || []).length ? " · " + saved.contextos.map((c) => `<span class="ctx">▸ ${esc(c)}</span>`).join(" ") : ""
          }</div>`
        : "";

    const content = el("div", "pcard-content");
    content.innerHTML = `
      <div class="pcard-author">
        <span class="avatar">${esc(initials(p.author))}</span>
        <b>${esc(p.author)}</b> <span class="handle">@${esc(at)}</span>
      </div>
      <div class="pcard-meta">${provenance(p)}${p.posted_at && p.posted_at !== "—" ? ` · 📅 publicado na rede em ${esc(p.posted_at)}` : ""} · ${p.metrics_simulated ? "métricas simuladas" : "métricas reais"} ·
        <a class="open-link" href="${p.link}" target="_blank" rel="noopener">abrir no TikTok ↗</a></div>
      <p class="pcard-caption">${esc(p.caption) || "&lt;sem legenda&gt;"}</p>
      <div class="pcard-metrics">
        ${metric(p.likes, "curtidas")}${metric(p.comments, "comentários")}${metric(p.shares, "compart.")}
      </div>
      ${tags.length ? `<div class="pcard-tags">${tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
      ${classLine}
      ${stamp}
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
      box.appendChild(actBtn("save is-on", "✎", "Editar curadoria", () => openModal(p)));
      box.appendChild(actBtn("discard", "↩", "Devolver à fila", () => requeue(p)));
      if (isEditor()) box.appendChild(actBtn("discard", "✕", "Descartar do Workspace (editor)", () => discardFromWorkspace(p)));
    } else {
      box.appendChild(actBtn("save", "↩", "Devolver à fila", () => requeue(p)));
    }
    return box;
  }
  function actBtn(cls, glyph, title, fn) {
    const b = el("button", "act " + cls, glyph);
    b.title = title; b.onclick = fn; return b;
  }

  // ---- ações (sempre no tópico atual) ----
  function discard(p) {
    const bag = decBag();
    bag[p.id] = { status: "reported", by: state.user, at: now() };
    persist(); render();
    toast(`Descartado: ${p.author}`, () => { delete bag[p.id]; persist(); render(); });
  }
  function requeue(p) { delete decBag()[p.id]; delete savedBag()[p.id]; persist(); render(); }

  // 2º nível: o editor poda o Workspace. "Manter" é implícito (não fazer nada).
  function discardFromWorkspace(p) {
    if (!isEditor()) return;
    const bag = decBag();
    const prev = bag[p.id];
    bag[p.id] = { status: "reported", by: state.user, at: now() };
    persist(); render();
    toast(`Descartado do Workspace: ${p.author}`, () => { bag[p.id] = prev; persist(); render(); });
  }

  // ---- modal curar ----
  function openModal(p) {
    modalPost = p;
    const ex = sOf(p);
    pendingTags = [...(ex?.hashtags || p.hashtags || [])];
    pendingContextos = [...(ex?.contextos || [])];
    pendingMarcas = [...(ex?.marcas || [])];
    $("#notes").value = ex?.notes || "";
    // Tipo de Expressão: confirmado pelo curador (default = pré-classificação do robô).
    $("#tipo").value = ex?.tipoExpressao || botTipo(p) || "";
    const terrN = territoryOfTopic(state.topic)?.name || "—";
    $("#modal-preclass").innerHTML = isManual(p)
      ? `Inclusão manual — classifique abaixo. Raia: <b>${esc(terrN)} ▸ ${esc(topicName(state.topic))}</b>`
      : `🤖 Pré-classificado pelo robô: <b>${esc(terrN)} ▸ ${esc(topicName(state.topic))}</b>`;
    $("#modal-context").textContent = `${p.author} — ${(p.caption || "").slice(0, 70)}`;
    $("#tag-input").value = ""; $("#contexto-input").value = "";
    renderTags(); renderContextos(); renderMarcas();
    $("#modal").hidden = false;
    $("#tipo").focus();
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
  function renderContextos() {
    $("#contexto-list").innerHTML = pendingContextos
      .map((t, i) => `<span class="tag">▸ ${esc(t)} <button data-i="${i}" aria-label="remover">✕</button></span>`).join("");
    $$("#contexto-list button").forEach((b) => (b.onclick = () => { pendingContextos.splice(+b.dataset.i, 1); renderContextos(); }));
  }
  function addContexto(raw) {
    const t = raw.trim();
    if (t && !pendingContextos.includes(t)) pendingContextos.push(t);
    renderContextos();
  }
  function renderMarcas() {
    $("#marca-chips").innerHTML = CLIENTES.map((c) =>
      `<button type="button" class="marca-chip${pendingMarcas.includes(c) ? " is-on" : ""}" data-m="${esc(c)}">${esc(c)}</button>`).join("");
    $$("#marca-chips .marca-chip").forEach((b) => (b.onclick = () => {
      const m = b.dataset.m, i = pendingMarcas.indexOf(m);
      if (i < 0) pendingMarcas.push(m); else pendingMarcas.splice(i, 1);
      renderMarcas();
    }));
  }
  function renderTipoOptions() {
    $("#tipo").innerHTML = `<option value="">Selecione…</option>` +
      TIPOS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  }
  function confirmSave() {
    if (!modalPost) return;
    const tipo = $("#tipo").value;
    if (!tipo) { // trava de completude (igual ao "Aprovar sem curar" do deck)
      $("#tipo").focus(); toast("Tipo de Expressão é obrigatório para aprovar."); return;
    }
    const id = modalPost.id;
    const bagD = decBag(), bagS = savedBag();
    const prev = bagD[id];
    // ao aprovar, o conteúdo entra no Workspace do tópico, atribuído a quem curou.
    if (!prev) bagD[id] = { status: "published", by: state.user, at: now() };
    const sv = bagS[id] || {};
    bagS[id] = {
      notes: $("#notes").value.trim(),
      hashtags: [...pendingTags],
      tipoExpressao: tipo,
      contextos: [...pendingContextos],
      marcas: [...pendingMarcas],
      by: sv.by || state.user,
      at: sv.at || now(),
    };
    persist();
    const a = modalPost.author; closeModal(); render();
    toast(prev ? `Curadoria atualizada: ${a}` : `Aprovado e adicionado ao Workspace: ${a}`);
  }

  // ---- dashboard (escopado ao tópico) ----
  // Dashboard GERAL — efetividade da automação (robôs + gerador), todos os tópicos.
  function renderDash() {
    let coletados = 0, curados = 0, descartados = 0, pend = 0, acertos = 0, manualCurados = 0;
    const porTopico = {}, byAnalyst = {};
    ALL_TOPICS.forEach((tid) => {
      const inT = POSTS.filter((p) => postInTopic(p, tid));
      const dec = state.decisions[tid] || {}, sv = state.saved[tid] || {};
      let c = 0, d = 0;
      inT.forEach((p) => {
        const dd = dec[p.id];
        if (!dd) { pend++; }
        else if (dd.status === "published") {
          c++; curados++;
          if (dd.by) byAnalyst[dd.by] = (byAnalyst[dd.by] || 0) + 1;
          if (isManual(p)) manualCurados++;
          else if (sv[p.id] && sv[p.id].tipoExpressao === botTipo(p)) acertos++; // manteve a pré-classificação
        } else if (dd.status === "reported") { d++; descartados++; }
      });
      coletados += inT.length;
      porTopico[tid] = { coletados: inT.length, curados: c, descartados: d };
    });
    const triados = curados + descartados;
    const aprov = triados ? Math.round((curados / triados) * 100) : 0;
    const botCurados = curados - manualCurados;
    const acertoPct = botCurados ? Math.round((acertos / botCurados) * 100) : 0;

    const rows = ALL_TOPICS.map((tid) => {
      const t = porTopico[tid], tr = t.curados + t.descartados;
      const ap = tr ? Math.round((t.curados / tr) * 100) : 0;
      return `<div class="dash-tr"><span>${esc(topicName(tid))}</span><span>${t.coletados}</span><span>${t.curados}</span><span>${t.descartados}</span><span>${ap}%</span></div>`;
    }).join("");
    const analystRows = USERS.filter((u) => u.role === "analyst").map((u) =>
      `<span class="tag">${esc(u.name)} <b>${byAnalyst[u.id] || 0}</b></span>`).join("");

    $("#dashboard").innerHTML = `
      <div class="stat accent"><div class="n">${aprov}%</div><div class="l">Aproveitamento (curados ÷ triados)</div></div>
      <div class="stat"><div class="n">${coletados}</div><div class="l">Coletados (candidatos)</div></div>
      <div class="stat"><div class="n">${curados}</div><div class="l">Curados (Workspace)</div></div>
      <div class="stat"><div class="n">${descartados}</div><div class="l">Descartados</div></div>
      <div class="stat"><div class="n">${acertoPct}%</div><div class="l">Acerto da pré-classificação do robô</div></div>
      <div class="stat"><div class="n">${pend}</div><div class="l">Pendentes na fila</div></div>
      <div class="stat"><div class="n">${manualCurados}</div><div class="l">Curados de inclusão manual</div></div>
      <div class="stat dash-wide">
        <h3>Efetividade por tópico</h3>
        <div class="dash-table">
          <div class="dash-tr dash-th"><span>Tópico</span><span>Coletados</span><span>Curados</span><span>Descartados</span><span>Aproveit.</span></div>
          ${rows}
        </div>
      </div>
      <div class="stat dash-wide">
        <h3>Curadoria por analista</h3>
        <div class="toplist">${analystRows || '<span class="chips-label">Sem curadoria ainda.</span>'}</div>
      </div>
      <div class="stat dash-wide soon-card">
        <h3>✨ Gerador de relatório <span class="soon">a instrumentar</span></h3>
        <p>Assuntos gerados <b>mantidos × editados × removidos</b> · <b>taxa de edição</b> · <b>% auto vs manual</b>. Requer marcar no editor o que foi gerado vs editado.</p>
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

  // ---- add modal (adição manual no tópico atual) ----
  function openAdd() {
    $("#add-modal").hidden = false;
    $("#add-url").value = ""; $("#add-author").value = ""; $("#add-caption").value = "";
    $("#add-topic-name").textContent = topicName(state.topic);
    updateCmd(); $("#add-url").focus();
  }
  function updateCmd() {
    const u = $("#add-url").value.trim() || "<cole a URL>";
    $("#add-cmd").textContent = `python3 tools/fetch.py "${u}"`;
  }
  function addManual() {
    const url = $("#add-url").value.trim();
    if (!url) { $("#add-url").focus(); return; }
    const at = handle(url);
    const post = {
      id: "m" + Date.now(),
      author: $("#add-author").value.trim() || ("@" + at),
      author_url: url, caption: $("#add-caption").value.trim(),
      link: url, thumbnail: "", hashtags: [],
      metrics_simulated: true, views: 0, likes: 0, comments: 0, shares: 0,
      posted_at: "—",
      platform: "tiktok",
      source: "manual", added_by: state.user, added_at: now(),
      topics: [state.topic], // entra no tópico em foco
    };
    state.added.unshift(post);
    POSTS.unshift(post);
    persist();
    $("#add-modal").hidden = true;
    view = "timeline"; activeChip = null; $("#search").value = "";
    render();
    toast(`Adicionado à fila de ${topicName(state.topic)}: ${post.author}`);
  }

  // ---- seletores ----
  function renderUserSelect() {
    const sel = $("#user-select");
    sel.innerHTML = USERS.map((u) =>
      `<option value="${u.id}">${esc(u.name)} — ${u.role === "editor" ? "Editor" : "Analista"}</option>`).join("");
    sel.value = state.user;
  }
  function renderTopicSelect() {
    const sel = $("#topic-select");
    sel.innerHTML = TERRITORIES.map((t) =>
      `<optgroup label="${esc(t.name)}">${t.topics.map((tp) =>
        `<option value="${tp.id}">${esc(tp.name)}</option>`).join("")}</optgroup>`).join("");
    sel.value = state.topic;
  }
  function renderFonteSelect() {
    const sel = $("#fonte-select");
    sel.innerHTML = `<option value="todas">Fonte: todas</option>` +
      PLATFORMS.map((p) => {
        const on = ACTIVE_PLATFORMS.includes(p.id);
        return `<option value="${p.id}"${on ? "" : " disabled"}>${esc(p.name)}${on ? "" : " (em breve)"}</option>`;
      }).join("");
    sel.value = activePlatform;
  }

  // ---- wiring ----
  function go(v) { view = v; activeChip = null; render(); }
  function wire() {
    $$(".nav[data-view]").forEach((n) => (n.onclick = () => go(n.dataset.view)));
    $$(".subtab").forEach((t) => (t.onclick = () => go(t.dataset.view)));
    $("#topic-select").onchange = (e) => {
      state.topic = e.target.value; activeChip = null; $("#search").value = ""; persist(); render();
      toast(`Tópico: ${topicName(state.topic)}`);
    };
    $("#user-select").onchange = (e) => { state.user = e.target.value; persist(); render(); toast(`Você agora é ${me().name}`); };
    $("#fonte-select").onchange = (e) => { activePlatform = e.target.value; render(); };
    $("#mine-only").onchange = (e) => { mineOnly = e.target.checked; render(); };
    $("#search").addEventListener("input", render);
    $("#search-btn").onclick = render;
    $("#modal-close").onclick = $("#modal-cancel").onclick = closeModal;
    $("#modal-confirm").onclick = confirmSave;
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
    $("#tag-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag($("#tag-input").value); $("#tag-input").value = ""; }
      else if (e.key === "Backspace" && !$("#tag-input").value && pendingTags.length) { pendingTags.pop(); renderTags(); }
    });
    $("#contexto-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addContexto($("#contexto-input").value); $("#contexto-input").value = ""; }
      else if (e.key === "Backspace" && !$("#contexto-input").value && pendingContextos.length) { pendingContextos.pop(); renderContextos(); }
    });
    $("#add-content").onclick = openAdd;
    $("#add-url").addEventListener("input", updateCmd);
    $("#add-close").onclick = $("#add-cancel").onclick = () => ($("#add-modal").hidden = true);
    $("#add-confirm").onclick = addManual;
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

  loadPosts().then((d) => { POSTS = [...state.added, ...d]; renderUserSelect(); renderTopicSelect(); renderFonteSelect(); renderTipoOptions(); wire(); render(); });
})();
