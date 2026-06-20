# Culture Monitor — mockup (TikTok)

Mockup de **curadoria de conteúdo cultural** do TikTok no modelo da live.tt.
Um robô coleta posts por **tópico**; analistas fazem a triagem e um editor
faz o 2º nível. Tudo é organizado pela hierarquia **Território ▸ Tópico**.

## Como abrir

Duplo-clique em `index.html` (funciona via `file://` — os dados são embutidos
em `data/posts.js`).

Ou sirva localmente, se preferir:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Conceitos (modelo live.tt)

- **Território** — macrotema cultural amplo (Esportes, Música, Cinema/TV &
  Streaming). Só agrupa tópicos; não tem tela própria.
- **Tópico** — recorte acionável dentro do território (Vôlei, Basquete, Surf,
  Pop, Rap & Trap, Séries, Estreias). **Cada tópico tem um robô** que coleta
  candidatos usando suas palavras-chave (afinidade *fuzzy* → supercoleta).
- **Curadoria por tópico** — o analista escolhe um tópico (seletor "Tópico:"
  no topo) e trabalha **só aquela raia**. A decisão é por **(tópico × post)**:
  um mesmo post pode ser coletado por vários tópicos (**sobreposição**) e ter
  destinos diferentes em cada um.

## O ciclo

```
🤖 robô do tópico (coleta na madrugada)
        │
   📥 Timeline (fila) ─analista cura─▶ 📋 Workspace ─editor descarta─▶ 🗑️ Descarte
                      └─analista descarta────────────────────────────▶ 🗑️ Descarte
```

Pós-moderação em 2 níveis: o analista cura e o post **já entra no Workspace**
(compartilhado pela equipe); o **editor** então mantém (implícito) ou descarta.
Cada decisão registra **quem** e **quando**.

## Funcionalidades

- **Seletor Território ▸ Tópico** no topo + breadcrumb do contexto atual.
- **Seletor "Você:"** (papéis): analistas e editor. Só o editor descarta do
  Workspace (2º nível); o botão ✓ é exclusivo dele.
- **Timeline / Workspace / Descarte** com contadores, **escopados ao tópico**.
- **Proveniência da coleta**: banner do robô do tópico ("ontem 03:14") e, em
  cada card, "🤖 coletado" vs "📅 publicado na rede" (timestamps distintos).
- **Adição manual** (botão "✋ Adicionar manualmente"): inclui um post no tópico
  em foco, marcado `✋ manual` e atribuído a você — distinto da coleta do robô.
- **Curar** abre um modal para anotações do analista + hashtags (chips).
- **Descartar** com *Desfazer*; devolver itens à fila.
- **Dashboard por tópico**: fila/Workspace/descartados, curadoria por analista,
  tags mais usadas.
- Busca por autor, legenda ou hashtag.
- Estado persiste em `localStorage` (`curator.v3`), simulando o banco
  **compartilhado**. A troca de usuário/tópico é simulada no mesmo navegador;
  sincronizar entre máquinas exige um backend, que a camada `load/persist`
  deixa pronta para substituir.

## Dados reais

Autor, legenda, **thumbnail** e link são **reais**, obtidos do endpoint
público **oEmbed** do TikTok (sem credenciais). As thumbnails são baixadas
para `assets/thumbs/` (a URL assinada do TikTok expira e bloqueia hotlink).

As métricas (views/likes/comentários/shares) e a hora da coleta são
**simuladas** — o oEmbed não as expõe — e estão marcadas como tal na interface.
O mapeamento **post → tópico** é definido no dataset (campo `topics`).

### Adicionar posts reais

Cole URLs de vídeos do TikTok e rode o ingestor:

```bash
python3 tools/fetch.py "https://www.tiktok.com/@usuario/video/123..."
# ou em lote:
python3 tools/fetch.py --file tools/seed_urls.txt
```

Ele atualiza `data/posts.json` e `data/posts.js` e baixa as thumbnails. O
ingestor **não** preenche `topics` — atribua o tópico de cada post no dataset.

## Estrutura

```
index.html          interface
styles.css          estilo (tema escuro TikTok)
app.js              catálogo Território▸Tópico + curadoria por tópico + persistência
data/posts.json     dataset canônico (real + métricas simuladas + topics)
data/posts.js       mesmo dataset embutível (para file://)
assets/thumbs/      thumbnails reais baixadas
tools/fetch.py      ingestor via oEmbed
tools/seed_urls.txt URLs-semente (organizadas por tópico)
```
