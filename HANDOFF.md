# HANDOFF — continuar o Culture Monitor (mockup)

Guia para quem for retomar/assumir o projeto. Leia junto com o
[`README.md`](README.md) (visão geral) e o [`DECISIONS.md`](DECISIONS.md)
(decisões e questões em aberto).

## 1. O que é

Mockup do produto Culture Monitor (parceria com a **live.tt**): curadoria de
conteúdo do TikTok + geração do relatório diário + dashboard de efetividade.
**Vanilla** — HTML/CSS/JS puro, **sem build, sem dependências, sem backend**.
Estado em `localStorage`. Deploy automático via **GitHub Pages** (branch `main`,
raiz). Online: https://altigran.github.io/cultura-monitor/

## 2. Rodar e desenvolver

- Abrir `index.html` no navegador (`file://`) **ou** `python3 -m http.server 8000`.
- Não há passo de build. Editou o JS/CSS → recarregue (hard refresh se o
  navegador cachear).
- **Validação rápida de JS:** `node --check app.js` / `node --check report.js`.
- Deploy: `git push origin main` → o Pages rebuilda sozinho em ~1 min.

## 3. Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `index.html` / `app.js` / `styles.css` | **Curadoria** + **Dashboard** |
| `reports.html` / `report.js` / `reports.css` | **Editor de relatório** |
| `data/posts.json` / `data/posts.js` | dataset (o `.js` é o que carrega via `file://`) |
| `assets/thumbs/` | thumbnails reais |
| `tools/fetch.py` | ingestor de posts via oEmbed |
| `DECISIONS.md` | decisões D1–D14 (firmes + a validar) |

## 4. Modelo de estado (`localStorage`)

**Curadoria — chave `curator.v3`:**
```js
{
  user: "ana",                 // usuário atual (ver USERS em app.js)
  topic: "volei",              // tópico em foco (ver TERRITORIES)
  decisions: { [topicId]: { [postId]: { status, by, at } } },  // status: "published" | "reported"
  saved:     { [topicId]: { [postId]: { notes, hashtags, tipoExpressao, contextos, marcas, by, at } } },
  added:     [ /* posts incluídos manualmente, com .topics, .source:"manual" */ ]
}
```
- **published** = está no Workspace; **reported** = Descarte; sem entrada = Timeline.
- Decisão é por **(tópico × post)** — daí o aninhamento por `topicId`.

**Relatório — chave `culture.report.v1`:**
```js
{
  title, edition, brand, date,
  sections: [ { id, type, title, intro,
    assuntos: [ { id, titulo, posts:[postId], categoria, acionavel, resumo, insight, tags } ] } ]
}
```
- O relatório **lê** `curator.v3` (Workspace) e referencia posts por `postId`.

## 5. Catálogos (onde editar conceitos)

- **Territórios/Tópicos:** `TERRITORIES` em `app.js` (e duplicado em `report.js`
  só para nomear). Mudou aqui → muda em todo lado.
- **Tipo de Expressão (curadoria):** `TIPOS` em `app.js`.
- **Categoria (relatório):** `CATEGORIAS` em `report.js` (vocabulário do bot:
  meme/formato/trend/comportamento/conversa_em_alta/notícia/curadoria).
- **Clientes/Marcas:** `CLIENTES` (em `app.js` e `report.js`).
- **Plataformas:** `PLATFORMS` / `ACTIVE_PLATFORMS` em `app.js`.
- **Componentes editoriais e esqueleto do report:** `COMPONENTS` / `defaultSections()`
  em `report.js`.
- **Mapa post → tópico:** campo `topics` em cada item de `data/posts.json` (+ `.js`).

## 6. Adicionar dados reais

`python3 tools/fetch.py --file tools/seed_urls.txt` (ou passe URLs). Ele atualiza
`data/posts.json` **e** `data/posts.js` e baixa thumbnails — **mas não preenche
`topics`**: atribua o tópico de cada post manualmente no dataset (e regenere o
`.js` se editar só o `.json`).

## 7. Decisões e o que está em aberto

Tudo em [`DECISIONS.md`](DECISIONS.md). Os itens **a validar com o cliente**
(levar pra reunião com o Lucas): **D1** (território transversal à plataforma),
**D5** (vocabulário de Tipo de Expressão/Categoria), **D11** (granularidade de
território), **D13** (mapeamento Território↔Marca no relatório), **D14**
(granularidade e recorte temporal do dashboard).

## 8. Material de requisito (NÃO está no repo)

Por serem **sensíveis**, ficam **fora do git** (ver `.gitignore`): o **deck do
produto (PDF)**, a **transcrição da reunião** e os **docs de apresentação**
(`APRESENTACAO-*.md`). Quem assumir precisa recebê-los por outro canal
(Drive/e-mail) — **pedir ao Altigran**. As justificativas de cada decisão citam
esse deck (📄) e essa transcrição (💬).

## 9. Convenções / pegadinhas

- **Sem build/deps** — não introduza framework sem necessidade real.
- `[hidden] { display:none !important }` no `styles.css` é essencial (sem ele, o
  `.feed{display:grid}` mantém o feed visível no Dashboard).
- Commits **temáticos** (`feat/fix/docs/chore(escopo)`).
- O **gerador do relatório é simulado** (texto canned em `report.js`); o piloto
  real roda no Telegram. Não há LLM no código.
- Persistência isolada em `load/persist` (curadoria) — trocar `localStorage` por
  backend é o ponto de extensão natural.
