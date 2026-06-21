/* Culture Monitor — mockup do EDITOR DE RELATÓRIO (etapa pós-curadoria).
 * Lê o Workspace (itens curados em localStorage "curator.v3") e monta um
 * relatório com as editorias do deck. Cada seção contém ASSUNTOS (agrupam 1+
 * posts curados), no formato do bot do Telegram:
 *   título · 🏷 tags · Resumo · 🎯 Categoria + ✅/❌ Acionável · 💡 insight · 📊 métricas.
 * "✨ Gerar" SIMULA a geração por LLM (texto canned/aleatório) — pré-preenche e
 * deixa editável (humano no loop). Tudo aqui é só do relatório (não toca a curadoria).
 *   state "culture.report.v1" = { title, edition, brand, date, sections[] }
 *   section = { id, type, title, intro, assuntos:[ {id,titulo,posts:[pid],categoria,acionavel,resumo,insight,tags} ] }
 */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const STORE = "culture.report.v1";
  const CUR_STORE = "curator.v3";

  const TERRITORIES = [
    { id: "esportes", name: "Esportes", topics: [
      { id: "volei", name: "Vôlei" }, { id: "basquete", name: "Basquete (NBA, NBB)" }, { id: "surf", name: "Surf" } ] },
    { id: "musica", name: "Música", topics: [
      { id: "pop", name: "Pop nacional" }, { id: "rap", name: "Rap & Trap" } ] },
    { id: "cinema", name: "Cinema, TV & Streaming", topics: [
      { id: "series", name: "Séries & Streaming" }, { id: "estreias", name: "Estreias de cinema" } ] },
  ];
  const topicName = (id) => { for (const t of TERRITORIES) { const tp = t.topics.find((x) => x.id === id); if (tp) return tp.name; } return id || "—"; };
  const COMPONENTS = ["Capa", "Trending Topics", "TikTok Trends", "Portas de Atenção", "Assuntos & Períodos", "Business", "Sessão Temática", "Curadoria"];
  const CLIENTES = ["Amstel", "TikTok", "Eletrolux", "Mondelez", "Riachuelo", "Stanley"];
  // Categorias (vocabulário real do bot do Telegram).
  const CATEGORIAS = [
    { id: "meme", label: "Meme" }, { id: "formato", label: "Formato" }, { id: "trend", label: "Trend" },
    { id: "comportamento", label: "Comportamento" }, { id: "conversa_em_alta", label: "Conversa em alta" },
    { id: "noticia", label: "Notícia" }, { id: "curadoria", label: "Curadoria" },
  ];
  const catLabel = (id) => (CATEGORIAS.find((c) => c.id === id) || {}).label || "—";
  // mapeia o Tipo de Expressão (curadoria) → Categoria (relatório), quando existir
  const TIPO2CAT = { Meme: "meme", Formato: "formato", Tendência: "trend", Comunidade: "comportamento", Notícia: "noticia" };

  let POSTS = [];
  let previewing = false;
  let picker = null; // { kind:"sec"|"ass", id }

  const today = () => new Date().toLocaleDateString("pt-BR");
  const uid = () => Math.random().toString(36).slice(2, 8);

  function load() {
    let r; try { r = JSON.parse(localStorage.getItem(STORE)); } catch { r = null; }
    if (!r || typeof r !== "object")
      r = { title: "Culture Monitor", edition: "", brand: "", date: today(), sections: defaultSections() };
    if (!Array.isArray(r.sections)) r.sections = [];
    // migração: sections antigas com items:[pid] → 1 assunto por post
    r.sections.forEach((s) => {
      if (!Array.isArray(s.assuntos)) {
        s.assuntos = (s.items || []).map((k) => mkAssunto(String(k).includes("|") ? String(k).split("|")[1] : String(k)));
      }
      delete s.items;
    });
    return r;
  }
  function persist() { localStorage.setItem(STORE, JSON.stringify(report)); }
  function curation() { try { return JSON.parse(localStorage.getItem(CUR_STORE)) || {}; } catch { return {}; } }

  const findPost = (pid) => POSTS.find((p) => String(p.id) === String(pid));
  function curatedOf(pid) {
    const c = curation(), dec = c.decisions || {}, sv = c.saved || {};
    for (const t in dec) if (dec[t][pid] && dec[t][pid].status === "published") return { topic: t, saved: (sv[t] || {})[pid] || {} };
    return null;
  }
  function workspaceItems() {
    const c = curation(), dec = c.decisions || {}; const seen = new Set(), out = [];
    for (const t in dec) for (const pid in dec[t]) if (dec[t][pid] && dec[t][pid].status === "published" && !seen.has(pid)) {
      const post = findPost(pid); if (post) { seen.add(pid); out.push({ pid, post, topic: t, saved: (c.saved || {})[t] && (c.saved || {})[t][pid] || {} }); }
    }
    return out;
  }
  // cria um assunto semeado por um post curado
  function mkAssunto(pid) {
    const cur = curatedOf(pid), post = findPost(pid);
    return { id: uid(), titulo: "", posts: [String(pid)], resumo: "", insight: cur ? (cur.saved.notes || "") : "",
      categoria: cur && TIPO2CAT[cur.saved.tipoExpressao] || "", acionavel: true, tags: (post && post.hashtags) || [] };
  }

  // esqueleto-padrão de um report (editorias mais comuns do deck)
  function defaultSections() {
    return ["Capa", "Trending Topics", "TikTok Trends", "Portas de Atenção", "Sessão Temática"]
      .map((t) => ({ id: uid(), type: t, title: t, intro: "", assuntos: [] }));
  }
  // novo report: MANTÉM a estrutura de seções atual, limpa o conteúdo e a edição.
  function newReport() {
    const tpl = (report.sections || []).map((s) => ({ id: uid(), type: s.type, title: s.title, intro: "", assuntos: [] }));
    report = { title: report.title || "Culture Monitor", edition: "", brand: report.brand || "", date: today(), sections: tpl.length ? tpl : defaultSections() };
    persist();
  }

  let report = load();

  // ---- DOM ----
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(Math.round(n || 0));
  const initials = (s) => (s || "?").trim().slice(0, 1).toUpperCase();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function avg(posts, f) { const v = posts.map(f).filter((x) => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }
  function metricsOf(A) {
    const ps = A.posts.map(findPost).filter(Boolean);
    const eng = avg(ps, (p) => p.views ? (p.likes / p.views) * 100 : 0);
    return { n: ps.length, likes: avg(ps, (p) => p.likes), comments: avg(ps, (p) => p.comments), eng: eng.toFixed(1).replace(".", ",") };
  }

  // ---- geração simulada (sem LLM) ----
  const T = {
    titulo: ["{tagCap}: {cat} em alta", "Formato de {tagCap}", "{cat} de {tagCap}", "A onda de {tagCap}", "Trend: {tagCap}"],
    resumo: [
      "Conteúdo no formato {catl} que explora {tags}, com forte apelo dentro de {topico}.",
      "Formato viral em {topico} que {acao}, destacando {tag} para gerar {efeito}.",
      "{abertura} sobre {tag}, refletindo um movimento relevante de {topico}.",
      "Recorte que reúne posts sobre {tag}, mostrando como {topico} se expressa hoje na rede.",
    ],
    insight: [
      "Formato replicável e de fácil adaptação — alto potencial para branded content{brand}.",
      "Sinaliza um comportamento relevante do público; marcas podem se conectar de forma autêntica explorando {tag}.",
      "Trend em ascensão com ótimo custo-benefício de produção para a marca surfar a conversa.",
      "Oportunidade de a marca entrar na conversa com {tag} mantendo tom nativo da plataforma.",
    ],
    acao: ["celebra a espontaneidade", "ironiza o cotidiano", "remixa uma referência pop", "humaniza o comportamento", "traduz um jargão"],
    efeito: ["humor", "identificação", "engajamento alto", "compartilhamento orgânico"],
    abertura: ["Discussão", "Conversa em alta", "Compilação", "Tutorial"],
  };
  function genAssunto(A) {
    const ps = A.posts.map(findPost).filter(Boolean); if (!ps.length) return;
    const post = ps[0];
    const tags = (A.tags && A.tags.length ? A.tags : post.hashtags || []);
    const tag = tags[0] || topicName(curatedOf(A.posts[0]) ? curatedOf(A.posts[0]).topic : null);
    const tagCap = tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : "Cultura";
    const topico = topicName((curatedOf(A.posts[0]) || {}).topic);
    if (!A.categoria) A.categoria = pick(CATEGORIAS).id;
    const cat = catLabel(A.categoria), catl = cat.toLowerCase();
    const sub = (s) => s.replace("{tagCap}", tagCap).replace("{cat}", cat).replace("{catl}", catl)
      .replace("{tags}", tags.slice(0, 3).map((t) => "#" + t).join(" • ") || "a conversa do momento")
      .replace("{tag}", "#" + (tag || "cultura")).replace("{topico}", topico)
      .replace("{acao}", pick(T.acao)).replace("{efeito}", pick(T.efeito)).replace("{abertura}", pick(T.abertura))
      .replace("{brand}", report.brand ? ` para a ${report.brand}` : "");
    if (!A.titulo) A.titulo = sub(pick(T.titulo));
    A.resumo = sub(pick(T.resumo));
    A.insight = sub(pick(T.insight));
    A.acionavel = A.categoria !== "conversa_em_alta" ? Math.random() > 0.15 : Math.random() > 0.5;
  }
  function genSection(sec) { sec.assuntos.forEach(genAssunto); if (!sec.intro) sec.intro = pick(["Os destaques do dia.", "O que move a conversa agora.", "Selecionados pela curadoria."]); }

  // ---- render ----
  function render() {
    $("#crumbs").innerHTML = `Reports <span class="sep">›</span> <b>${esc(report.title || "Novo Report")}</b>`;
    $("#builder").hidden = previewing; $("#preview").hidden = !previewing;
    $("#btn-preview").textContent = previewing ? "✎ Voltar ao editor" : "▶ Pré-visualizar";
    if (previewing) return renderPreview();
    renderBuilder();
  }

  function renderBuilder() {
    const b = $("#builder"); b.innerHTML = "";
    const meta = el("div", "rb-meta");
    meta.innerHTML = `
      <label>Título <input id="m-title" type="text" value="${esc(report.title)}"></label>
      <label>Edição nº <input id="m-edition" type="text" value="${esc(report.edition)}" placeholder="ex.: 601"></label>
      <label>Marca <select id="m-brand"><option value="">Geral</option>${CLIENTES.map((c) => `<option value="${esc(c)}"${report.brand === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label>Data <input id="m-date" type="text" value="${esc(report.date)}"></label>`;
    b.appendChild(meta);
    $("#m-title").addEventListener("input", (e) => { report.title = e.target.value; persist(); const cb = $("#crumbs").querySelector("b"); if (cb) cb.textContent = report.title || "Novo Report"; });
    $("#m-edition").addEventListener("input", (e) => { report.edition = e.target.value; persist(); });
    $("#m-brand").addEventListener("change", (e) => { report.brand = e.target.value; persist(); render(); });
    $("#m-date").addEventListener("input", (e) => { report.date = e.target.value; persist(); });

    const ws = workspaceItems().length;
    b.appendChild(el("div", "rb-source", ws
      ? `📥 <b>${ws}</b> ${ws === 1 ? "item curado" : "itens curados"} no Workspace. Agrupe em <b>Assuntos</b> e use <b>✨ Gerar</b> para pré-preencher (editável).`
      : `⚠️ Nenhum conteúdo curado ainda. <a href="index.html">Cure conteúdos</a> e volte aqui.`));

    report.sections.forEach((sec) => b.appendChild(sectionEl(sec)));

    const add = el("div", "rb-addsec");
    add.innerHTML = `<span>Adicionar componente:</span>` + COMPONENTS.map((t) => `<button class="rb-comp" data-type="${esc(t)}">+ ${esc(t)}</button>`).join("");
    add.querySelectorAll(".rb-comp").forEach((btn) => btn.onclick = () => { report.sections.push({ id: uid(), type: btn.dataset.type, title: btn.dataset.type, intro: "", assuntos: [] }); persist(); render(); });
    b.appendChild(add);
  }

  function sectionEl(sec) {
    const wrap = el("section", "rb-sec");
    const head = el("div", "rb-sec-head");
    head.innerHTML = `<span class="rb-sec-type">${esc(sec.type)}</span>`;
    const titleIn = el("input", "rb-sec-title"); titleIn.value = sec.title; titleIn.placeholder = "Título da seção";
    titleIn.addEventListener("input", (e) => { sec.title = e.target.value; persist(); });
    head.appendChild(titleIn);
    const gen = el("button", "rb-gen", "✨ Gerar seção"); gen.onclick = () => { genSection(sec); persist(); render(); };
    head.appendChild(gen);
    const del = el("button", "rb-x", "✕"); del.title = "remover seção"; del.onclick = () => { report.sections = report.sections.filter((s) => s.id !== sec.id); persist(); render(); };
    head.appendChild(del);
    wrap.appendChild(head);

    const intro = el("textarea", "rb-intro"); intro.rows = 2; intro.value = sec.intro || ""; intro.placeholder = "Texto de abertura da seção (opcional)";
    intro.addEventListener("input", (e) => { sec.intro = e.target.value; persist(); });
    wrap.appendChild(intro);

    sec.assuntos.forEach((A, i) => wrap.appendChild(assuntoEl(sec, A, i)));
    if (!sec.assuntos.length) wrap.appendChild(el("div", "rb-empty", "Sem assuntos. Adicione do Workspace abaixo."));

    const addA = el("button", "rb-additem", picker && picker.kind === "sec" && picker.id === sec.id ? "Fechar" : "+ Adicionar assunto");
    addA.onclick = () => { picker = (picker && picker.kind === "sec" && picker.id === sec.id) ? null : { kind: "sec", id: sec.id }; render(); };
    wrap.appendChild(addA);
    if (picker && picker.kind === "sec" && picker.id === sec.id) wrap.appendChild(pickerEl(sec, null));
    return wrap;
  }

  function assuntoEl(sec, A, i) {
    const wrap = el("div", "rb-ass");
    const head = el("div", "rb-ass-head");
    head.innerHTML = `<span class="rb-ass-n">#${i + 1}</span>`;
    const tIn = el("input", "rb-ass-title"); tIn.value = A.titulo; tIn.placeholder = "Título do assunto";
    tIn.addEventListener("input", (e) => { A.titulo = e.target.value; persist(); });
    head.appendChild(tIn);
    const cat = el("select", "rb-cat", `<option value="">Categoria…</option>` + CATEGORIAS.map((c) => `<option value="${c.id}"${A.categoria === c.id ? " selected" : ""}>${esc(c.label)}</option>`).join(""));
    cat.addEventListener("change", (e) => { A.categoria = e.target.value; persist(); });
    head.appendChild(cat);
    const acion = el("button", "rb-acion " + (A.acionavel ? "on" : "off"), A.acionavel ? "✅ Acionável" : "❌ Não acionável");
    acion.onclick = () => { A.acionavel = !A.acionavel; persist(); render(); };
    head.appendChild(acion);
    const g = el("button", "rb-gen sm", "✨"); g.title = "Gerar este assunto"; g.onclick = () => { genAssunto(A); persist(); render(); };
    head.appendChild(g);
    const rm = el("button", "rb-x", "✕"); rm.title = "remover assunto"; rm.onclick = () => { sec.assuntos = sec.assuntos.filter((x) => x.id !== A.id); persist(); render(); };
    head.appendChild(rm);
    wrap.appendChild(head);

    const resumo = el("textarea", "rb-field"); resumo.rows = 2; resumo.value = A.resumo; resumo.placeholder = "Resumo (✨ gera, você edita)";
    resumo.addEventListener("input", (e) => { A.resumo = e.target.value; persist(); });
    wrap.appendChild(resumo);
    const ins = el("textarea", "rb-field note"); ins.rows = 2; ins.value = A.insight; ins.placeholder = "💡 Como usar / oportunidade pra marca";
    ins.addEventListener("input", (e) => { A.insight = e.target.value; persist(); });
    wrap.appendChild(ins);

    // posts relacionados
    const ps = el("div", "rb-ass-posts");
    A.posts.map(findPost).filter(Boolean).forEach((p) => {
      const chip = el("span", "rb-ppost", `${p.thumbnail ? `<img src="${p.thumbnail}" onerror="this.style.opacity=.2">` : "✋"}<b>${esc(p.author)}</b>`);
      const x = el("button", "rb-ppost-x", "✕"); x.onclick = () => { A.posts = A.posts.filter((k) => String(k) !== String(p.id)); persist(); render(); };
      chip.appendChild(x); ps.appendChild(chip);
    });
    const addP = el("button", "rb-addpost", picker && picker.kind === "ass" && picker.id === A.id ? "fechar" : "+ post relacionado");
    addP.onclick = () => { picker = (picker && picker.kind === "ass" && picker.id === A.id) ? null : { kind: "ass", id: A.id }; render(); };
    ps.appendChild(addP);
    wrap.appendChild(ps);
    if (picker && picker.kind === "ass" && picker.id === A.id) wrap.appendChild(pickerEl(sec, A));

    const m = metricsOf(A);
    if (m.n) wrap.appendChild(el("div", "rb-ass-m", `📊 Médias de ${m.n} ${m.n === 1 ? "post" : "posts"}: ❤️ ${fmt(m.likes)} · 💬 ${fmt(m.comments)} · 📈 ${m.eng}%`));
    return wrap;
  }

  // picker: target null = novo assunto na seção; target=assunto = adiciona post nele
  function pickerEl(sec, target) {
    const box = el("div", "rb-picker");
    const usedInSec = new Set(); sec.assuntos.forEach((A) => A.posts.forEach((k) => usedInSec.add(String(k))));
    let pool = workspaceItems().filter((i) => !usedInSec.has(i.pid));
    if (report.brand) pool = pool.filter((i) => (i.saved.marcas || []).includes(report.brand));
    if (!pool.length) { box.appendChild(el("div", "rb-empty", "Nada disponível no Workspace" + (report.brand ? " para esta marca." : "."))); return box; }
    const grid = el("div", "rb-pick-grid");
    pool.forEach((it) => {
      const c = el("button", "rb-pick", `<span class="rb-thumb sm">${it.post.thumbnail ? `<img src="${it.post.thumbnail}" onerror="this.style.opacity=.2">` : "✋"}</span><span class="rb-pick-t"><b>${esc(it.post.author)}</b><small>${esc(topicName(it.topic))}</small></span>`);
      c.onclick = () => {
        if (target) target.posts.push(it.pid);
        else sec.assuntos.push(mkAssunto(it.pid));
        picker = null; persist(); render();
      };
      grid.appendChild(c);
    });
    box.appendChild(grid);
    return box;
  }

  // ---- preview (formato do bot) ----
  function renderPreview() {
    const cover = `<div class="rp-cover"><div class="rp-logo">Culture <span>☺</span> Monitor <b>live ☺</b></div>
      <div class="rp-meta">${esc(report.date)}${report.edition ? ` · Edição #${esc(report.edition)}` : ""}${report.brand ? ` · ${esc(report.brand)}` : ""}</div></div>`;
    const secs = report.sections.map((sec) => {
      const ass = sec.assuntos.map((A, i) => {
        const ps = A.posts.map(findPost).filter(Boolean);
        const m = metricsOf(A);
        const thumbs = ps.map((p) => `<span class="rp-th">${p.thumbnail ? `<img src="${p.thumbnail}" onerror="this.style.opacity=.2">` : "✋"}</span>`).join("");
        return `<div class="rp-ass">
          <div class="rp-ass-h">#️⃣ ${i + 1} — <b>${esc(A.titulo || "(sem título)")}</b></div>
          ${A.tags && A.tags.length ? `<div class="rp-tags">🏷 ${A.tags.slice(0, 6).map((t) => "#" + esc(t)).join(" • ")}</div>` : ""}
          ${A.resumo ? `<div class="rp-resumo"><b>Resumo:</b> ${esc(A.resumo)}</div>` : ""}
          <div class="rp-cat">🎯 ${esc(catLabel(A.categoria))} • ${A.acionavel ? "✅ Acionável para marcas" : "❌ Não acionável"}</div>
          ${A.insight ? `<div class="rp-howto"><b>💡</b> ${esc(A.insight)}</div>` : ""}
          ${m.n ? `<div class="rp-metrics">📊 ❤️ ${fmt(m.likes)} • 💬 ${fmt(m.comments)} • 📈 ${m.eng}%</div>` : ""}
          ${thumbs ? `<div class="rp-thumbs">${thumbs}</div>` : ""}
        </div>`;
      }).join("");
      return `<section class="rp-sec"><h2>${esc(sec.title || sec.type)}</h2>${sec.intro ? `<p class="rp-intro">${esc(sec.intro)}</p>` : ""}${ass || `<div class="rb-empty">—</div>`}</section>`;
    }).join("");
    $("#preview").innerHTML = `<div class="rp-page">${cover}${secs}</div>`;
  }

  // ---- init ----
  async function loadPosts() { if (Array.isArray(window.__POSTS__)) return window.__POSTS__; try { return await (await fetch("data/posts.json")).json(); } catch { return []; } }
  function wire() {
    $("#btn-preview").onclick = () => { previewing = !previewing; picker = null; render(); };
    $("#btn-gen").onclick = () => { report.sections.forEach(genSection); persist(); render(); };
    $("#btn-new").onclick = () => { if (!confirm("Novo report: mantém a estrutura das seções e limpa o conteúdo (assuntos) e a edição. Continuar?")) return; newReport(); previewing = false; picker = null; render(); };
  }
  loadPosts().then((d) => { POSTS = d; wire(); render(); });
})();
