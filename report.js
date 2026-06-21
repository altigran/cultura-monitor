/* Culture Monitor — mockup do EDITOR DE RELATÓRIO (etapa pós-curadoria).
 * Lê o Workspace (itens curados em localStorage "curator.v3") e o acervo
 * coletado (data/posts) e monta um relatório com as editorias do deck (CMS
 * "Criar Report"), com preview no layout editorial.
 *   state em localStorage "culture.report.v1" = { title, edition, brand, date, sections[] }
 *   section = { id, type, title, intro, items: [postId, ...] }
 * Itens curados (✓) carregam a nota do analista (→ "Como usar"); itens do
 * acervo entram crus. O relatório é PRODUTO derivado do banco de curadoria (D10).
 */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const STORE = "culture.report.v1";
  const CUR_STORE = "curator.v3";

  const TERRITORIES = [
    { id: "esportes", name: "Esportes", topics: [
      { id: "volei", name: "Vôlei" }, { id: "basquete", name: "Basquete (NBA, NBB)" }, { id: "surf", name: "Surf" },
    ] },
    { id: "musica", name: "Música", topics: [
      { id: "pop", name: "Pop nacional" }, { id: "rap", name: "Rap & Trap" },
    ] },
    { id: "cinema", name: "Cinema, TV & Streaming", topics: [
      { id: "series", name: "Séries & Streaming" }, { id: "estreias", name: "Estreias de cinema" },
    ] },
  ];
  const topicName = (id) => {
    for (const t of TERRITORIES) { const tp = t.topics.find((x) => x.id === id); if (tp) return tp.name; }
    return id || "—";
  };
  const COMPONENTS = ["Capa", "Trending Topics", "TikTok Trends", "Portas de Atenção", "Assuntos & Períodos", "Business", "Sessão Temática", "Curadoria"];
  const CLIENTES = ["Amstel", "TikTok", "Eletrolux", "Mondelez", "Riachuelo", "Stanley"];

  let POSTS = [];
  let report = load();
  let previewing = false;
  let pickerFor = null;

  function today() { return new Date().toLocaleDateString("pt-BR"); }
  function uid() { return "s" + Math.random().toString(36).slice(2, 8); }

  function load() {
    let r;
    try { r = JSON.parse(localStorage.getItem(STORE)); } catch { r = null; }
    if (!r || typeof r !== "object") {
      r = { title: "Culture Monitor", edition: "", brand: "", date: today(),
        sections: [{ id: uid(), type: "Capa", title: "Capa", intro: "", items: [] }] };
    }
    if (!Array.isArray(r.sections)) r.sections = [];
    // migração: itens antigos no formato "topic|postId" → só postId.
    r.sections.forEach((s) => { s.items = (s.items || []).map((k) => String(k).includes("|") ? String(k).split("|")[1] : String(k)); });
    return r;
  }
  function persist() { localStorage.setItem(STORE, JSON.stringify(report)); }
  function curation() { try { return JSON.parse(localStorage.getItem(CUR_STORE)) || {}; } catch { return {}; } }

  const findPost = (pid) => POSTS.find((p) => String(p.id) === String(pid));
  // melhor metadado curado do post (1º tópico onde está publicado)
  function curatedOf(pid) {
    const c = curation(), dec = c.decisions || {}, sv = c.saved || {};
    for (const topic in dec) if (dec[topic][pid] && dec[topic][pid].status === "published")
      return { topic, saved: (sv[topic] || {})[pid] || {} };
    return null;
  }
  function itemByKey(pid) {
    const post = findPost(pid); if (!post) return null;
    const cur = curatedOf(pid);
    return { pid: String(pid), post, curated: !!cur,
      topic: cur ? cur.topic : (post.topics && post.topics[0]) || null,
      saved: cur ? cur.saved : {} };
  }
  // Workspace = posts publicados (únicos)
  function workspaceItems() {
    const c = curation(), dec = c.decisions || {};
    const seen = new Set(), out = [];
    for (const topic in dec) for (const pid in dec[topic])
      if (dec[topic][pid] && dec[topic][pid].status === "published" && !seen.has(pid)) {
        const it = itemByKey(pid); if (it) { seen.add(pid); out.push(it); }
      }
    return out;
  }

  // ---- DOM ----
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(n || 0);
  const initials = (s) => (s || "?").trim().slice(0, 1).toUpperCase();
  const thumbHTML = (post, cls) => `<span class="rb-thumb ${cls || ""}">${post.thumbnail ? `<img src="${post.thumbnail}" onerror="this.style.opacity=.2">` : "✋"}</span>`;

  // ---- render ----
  function render() {
    $("#crumbs").innerHTML = `Reports <span class="sep">›</span> <b>${esc(report.title || "Novo Report")}</b>`;
    $("#builder").hidden = previewing;
    $("#preview").hidden = !previewing;
    $("#btn-preview").textContent = previewing ? "✎ Voltar ao editor" : "▶ Pré-visualizar";
    if (previewing) return renderPreview();
    renderBuilder();
  }

  function renderBuilder() {
    const b = $("#builder");
    b.innerHTML = "";

    const meta = el("div", "rb-meta");
    meta.innerHTML = `
      <label>Título <input id="m-title" type="text" value="${esc(report.title)}"></label>
      <label>Edição nº <input id="m-edition" type="text" value="${esc(report.edition)}" placeholder="ex.: 601"></label>
      <label>Marca
        <select id="m-brand"><option value="">Geral</option>
          ${CLIENTES.map((c) => `<option value="${esc(c)}"${report.brand === c ? " selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
      </label>
      <label>Data <input id="m-date" type="text" value="${esc(report.date)}"></label>`;
    b.appendChild(meta);
    $("#m-title").addEventListener("input", (e) => { report.title = e.target.value; persist(); const cb = $("#crumbs").querySelector("b"); if (cb) cb.textContent = report.title || "Novo Report"; });
    $("#m-edition").addEventListener("input", (e) => { report.edition = e.target.value; persist(); });
    $("#m-brand").addEventListener("change", (e) => { report.brand = e.target.value; persist(); render(); });
    $("#m-date").addEventListener("input", (e) => { report.date = e.target.value; persist(); });

    const ws = workspaceItems().length;
    const note = el("div", "rb-source");
    note.innerHTML = `📥 Fontes: <b>${ws}</b> ${ws === 1 ? "item curado (✓)" : "itens curados (✓)"} no Workspace + acervo coletado (${POSTS.length} posts).${report.brand ? ` Curados filtrados por <b>${esc(report.brand)}</b>.` : ""} ${ws ? "" : `<a href="index.html">Cure conteúdos</a> para enriquecê-los com nota e marca.`}`;
    b.appendChild(note);

    report.sections.forEach((sec) => b.appendChild(sectionEl(sec)));

    const add = el("div", "rb-addsec");
    add.innerHTML = `<span>Adicionar componente:</span>` + COMPONENTS.map((t) => `<button class="rb-comp" data-type="${esc(t)}">+ ${esc(t)}</button>`).join("");
    add.querySelectorAll(".rb-comp").forEach((btn) => btn.onclick = () => addSection(btn.dataset.type));
    b.appendChild(add);
  }

  function sectionEl(sec) {
    const wrap = el("section", "rb-sec");
    const head = el("div", "rb-sec-head");
    head.innerHTML = `<span class="rb-sec-type">${esc(sec.type)}</span>`;
    const titleIn = el("input", "rb-sec-title"); titleIn.value = sec.title; titleIn.placeholder = "Título da seção";
    titleIn.addEventListener("input", (e) => { sec.title = e.target.value; persist(); });
    head.appendChild(titleIn);
    const del = el("button", "rb-x", "✕ remover seção"); del.onclick = () => removeSection(sec.id);
    head.appendChild(del);
    wrap.appendChild(head);

    const intro = el("textarea", "rb-intro"); intro.rows = 2; intro.value = sec.intro || "";
    intro.placeholder = "Texto de abertura da seção (opcional)";
    intro.addEventListener("input", (e) => { sec.intro = e.target.value; persist(); });
    wrap.appendChild(intro);

    const items = el("div", "rb-items");
    sec.items.forEach((pid) => { const it = itemByKey(pid); if (it) items.appendChild(itemRow(sec, it)); });
    if (!sec.items.length) items.appendChild(el("div", "rb-empty", "Sem itens. Adicione do Workspace/acervo abaixo."));
    wrap.appendChild(items);

    const addBtn = el("button", "rb-additem", pickerFor === sec.id ? "Fechar" : "+ Adicionar item");
    addBtn.onclick = () => { pickerFor = pickerFor === sec.id ? null : sec.id; render(); };
    wrap.appendChild(addBtn);
    if (pickerFor === sec.id) wrap.appendChild(pickerEl(sec));
    return wrap;
  }

  function itemRow(sec, it) {
    const row = el("div", "rb-item");
    row.innerHTML = `${thumbHTML(it.post)}
      <div class="rb-item-body">
        ${it.curated ? `<span class="rb-badge">✓ curado</span> ` : ""}<b>${esc(it.post.author)}</b>
        <span class="rb-tag">${esc(topicName(it.topic))}</span>${it.saved.tipoExpressao ? ` <span class="rb-tag">${esc(it.saved.tipoExpressao)}</span>` : ""}
        <div class="rb-cap">${esc((it.post.caption || "").slice(0, 90))}</div>
        ${it.saved.notes ? `<div class="rb-note">💡 ${esc(it.saved.notes)}</div>` : ""}
      </div>`;
    const rm = el("button", "rb-x", "✕"); rm.title = "remover do report";
    rm.onclick = () => { sec.items = sec.items.filter((k) => String(k) !== it.pid); persist(); render(); };
    row.appendChild(rm);
    return row;
  }

  function pickerEl(sec) {
    const box = el("div", "rb-picker");
    const inSec = new Set(sec.items.map(String));
    // grupo 1: curados (Workspace), filtrados por marca
    let curados = workspaceItems().filter((i) => !inSec.has(i.pid));
    if (report.brand) curados = curados.filter((i) => (i.saved.marcas || []).includes(report.brand));
    // grupo 2: acervo (não publicados), todos os posts restantes
    const pubIds = new Set(workspaceItems().map((i) => i.pid));
    const acervo = POSTS.filter((p) => !inSec.has(String(p.id)) && !pubIds.has(String(p.id))).map((p) => itemByKey(p.id)).filter(Boolean);

    if (!curados.length && !acervo.length) { box.appendChild(el("div", "rb-empty", "Nada disponível.")); return box; }
    if (curados.length) {
      box.appendChild(el("div", "rb-pick-h", "✓ Curados (Workspace)"));
      const g = el("div", "rb-pick-grid"); curados.forEach((it) => g.appendChild(pickBtn(sec, it))); box.appendChild(g);
    }
    if (acervo.length) {
      box.appendChild(el("div", "rb-pick-h", "Acervo coletado"));
      const g = el("div", "rb-pick-grid"); acervo.forEach((it) => g.appendChild(pickBtn(sec, it))); box.appendChild(g);
    }
    return box;
  }
  function pickBtn(sec, it) {
    const c = el("button", "rb-pick" + (it.curated ? " is-curated" : ""));
    c.innerHTML = `${thumbHTML(it.post, "sm")}
      <span class="rb-pick-t"><b>${esc(it.post.author)}</b><small>${esc(topicName(it.topic))}${it.curated ? " · ✓" : ""}</small></span>`;
    c.onclick = () => { sec.items.push(String(it.pid)); persist(); render(); };
    return c;
  }

  // ---- preview ----
  function renderPreview() {
    const cover = `<div class="rp-cover"><div class="rp-logo">Culture <span>☺</span> Monitor <b>live ☺</b></div>
      <div class="rp-meta">${esc(report.date)}${report.edition ? ` · Edição #${esc(report.edition)}` : ""}${report.brand ? ` · ${esc(report.brand)}` : ""}</div></div>`;
    const secs = report.sections.map((sec) => {
      const items = sec.items.map(itemByKey).filter(Boolean).map((it) => `
        <div class="rp-item"><div class="rp-thumb">${it.post.thumbnail ? `<img src="${it.post.thumbnail}" onerror="this.style.opacity=.2">` : "✋"}</div>
          <div class="rp-item-body">
            <div class="rp-author"><span class="rp-av">${esc(initials(it.post.author))}</span> <b>${esc(it.post.author)}</b></div>
            <p class="rp-cap">${esc(it.post.caption) || "&lt;sem legenda&gt;"}</p>
            <div class="rp-metrics">▶ ${fmt(it.post.views)} · ♥ ${fmt(it.post.likes)} · 💬 ${fmt(it.post.comments)}</div>
            ${it.saved.notes ? `<div class="rp-howto"><b>💡 Como usar</b> ${esc(it.saved.notes)}</div>` : ""}
            ${(it.saved.contextos || []).length ? `<div class="rp-ctx">${it.saved.contextos.map((x) => `<span>▸ ${esc(x)}</span>`).join("")}</div>` : ""}
          </div></div>`).join("");
      return `<section class="rp-sec"><h2>${esc(sec.title || sec.type)}</h2>${sec.intro ? `<p class="rp-intro">${esc(sec.intro)}</p>` : ""}${items || `<div class="rb-empty">—</div>`}</section>`;
    }).join("");
    $("#preview").innerHTML = `<div class="rp-page">${cover}${secs}</div>`;
  }

  // ---- ações ----
  function addSection(type) { report.sections.push({ id: uid(), type, title: type, intro: "", items: [] }); persist(); render(); }
  function removeSection(id) { report.sections = report.sections.filter((s) => s.id !== id); if (pickerFor === id) pickerFor = null; persist(); render(); }

  // ---- init ----
  async function loadPosts() {
    if (Array.isArray(window.__POSTS__)) return window.__POSTS__;
    try { return await (await fetch("data/posts.json")).json(); } catch { return []; }
  }
  function wire() {
    $("#btn-preview").onclick = () => { previewing = !previewing; pickerFor = null; render(); };
    $("#btn-new").onclick = () => {
      if (!confirm("Começar um novo report? O rascunho atual será descartado.")) return;
      localStorage.removeItem(STORE); report = load(); previewing = false; pickerFor = null; render();
    };
  }
  loadPosts().then((d) => { POSTS = d; wire(); render(); });
})();
