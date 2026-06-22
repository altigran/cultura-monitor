# Culture Monitor — mockup (TikTok)

Mockup do produto **Culture Monitor** (live.tt): curadoria de conteúdo cultural
do TikTok e geração do relatório diário. Três telas:

1. **Curadoria** (`index.html`) — robôs coletam posts por **tópico**; analistas
   triam e um editor faz o 2º nível.
2. **Editor de relatório** (`reports.html`) — monta o relatório a partir do que
   foi curado, com **geração assistida (IA, simulada)**.
3. **Dashboard** (dentro de `index.html`) — indicadores de **efetividade da
   automação**.

> É um mockup **vanilla** (HTML/CSS/JS, sem build e sem dependências). Estado em
> `localStorage`. Publicado via GitHub Pages.
> **Decisões e questões em aberto:** ver [`DECISIONS.md`](DECISIONS.md).
> **Para continuar o projeto:** ver [`HANDOFF.md`](HANDOFF.md).

## Como abrir

Duplo-clique em `index.html` (funciona via `file://` — os dados são embutidos
em `data/posts.js`). Ou sirva localmente:

```bash
python3 -m http.server 8000   # abra http://localhost:8000
```

Online: https://altigran.github.io/cultura-monitor/

## Conceitos (modelo live.tt)

- **Território** — macrotema cultural (Esportes, Música, Cinema/TV & Streaming).
  Agrupa tópicos; não tem tela própria.
- **Tópico** — recorte acionável (Vôlei, Basquete, Surf, Pop, Rap, Séries,
  Estreias). **Cada tópico tem um robô** que coleta por palavras-chave.
- **Curadoria por tópico** — decisão por **(tópico × post)**; um post pode estar
  em vários tópicos (**sobreposição**) com destinos diferentes.

## O ciclo

```
🤖 robô do tópico (coleta na madrugada)
        │
   📥 Timeline ─analista cura─▶ 📋 Workspace ─editor descarta─▶ 🗑️ Descarte
              └─analista descarta──────────────────────────────▶ 🗑️ Descarte
                                   │
                                   ▼
                       📄 Editor de relatório  (Assuntos + ✨ Gerar)
```

Pós-moderação em 2 níveis: o analista cura → entra no **Workspace** (compartilhado);
o **editor** mantém (implícito) ou descarta. O **relatório** deriva do Workspace.

## Curadoria (`index.html`)

- **Seletores** no topo: **Território ▸ Tópico** (contexto) e **"Você:"** (papel —
  analistas e editor). Só o editor descarta do Workspace.
- **Timeline / Workspace / Descarte** escopados ao tópico, com contadores.
- **Proveniência**: banner do robô + selo "🤖 coletado" vs "📅 publicado na rede".
- **Curar** abre o modal de classificação (modelo do deck): **Tipo de Expressão**
  (obrigatório, pré-preenchido pelo robô) · **Contexto** · **Marca vinculada**
  (clientes) · notas · hashtags.
- **Adição manual** ("✋ Adicionar manualmente"): inclui um post no tópico, marcado
  `✋ manual`, **com prioridade** (sobe ao topo) — a via "tradicional".
- **Filtro "Fonte"** (plataforma): TikTok ativo; Instagram/X "em breve".

## Editor de relatório (`reports.html`)

- Lê o **Workspace** curado e monta o relatório em **seções editoriais** (Capa,
  Trending Topics, TikTok Trends, Portas de Atenção, Sessão Temática…).
- Cada seção tem **Assuntos** (agrupam 1+ posts), no formato do bot do Telegram:
  título · tags · Resumo · 🎯 Categoria + ✅/❌ Acionável · 💡 insight · 📊 métricas.
- **✨ Gerar** (relatório / seção / assunto) **simula** a geração por IA
  (texto canned) — pré-preenche e deixa editável. **Pré-visualizar** mostra o
  layout editorial.

## Dashboard (efetividade da automação)

Gráficos (SVG/CSS) dos indicadores: **aproveitamento** (curados ÷ triados),
**acerto da pré-classificação** do robô, **funil** de triagem, aproveitamento
**por tópico**, **robô vs manual**, **por analista**. Recorte **diário**, geral
(todos os tópicos). Consumo do cliente está fora do escopo.

## Dados

Autor, legenda, **thumbnail** e link são **reais** (oEmbed do TikTok, sem
credenciais; thumbnails baixadas pra `assets/thumbs/`). Métricas e hora da coleta
são **simuladas**. O mapa **post → tópico** vem do campo `topics` no dataset.

```bash
python3 tools/fetch.py "https://www.tiktok.com/@usuario/video/123..."   # 1 URL
python3 tools/fetch.py --file tools/seed_urls.txt                        # lote
```
Atualiza `data/posts.json` + `data/posts.js` e baixa thumbnails. **Não** preenche
`topics` — atribua o tópico de cada post no dataset.

## Estrutura

```
index.html        curadoria + dashboard
app.js            catálogos, curadoria por tópico, dashboard, persistência
styles.css        estilo (compartilhado)
reports.html      editor de relatório
report.js         lógica do relatório (Assuntos + geração simulada)
reports.css       estilo do editor/preview
data/posts.json   dataset canônico (real + métricas simuladas + topics)
data/posts.js     mesmo dataset embutível (file://)
assets/thumbs/    thumbnails reais
tools/fetch.py    ingestor via oEmbed
DECISIONS.md      decisões e premissas (D1–D14)
HANDOFF.md        guia para continuar o projeto
```
