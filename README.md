# Curador Social — mockup (TikTok)

Ferramenta de **triagem** para analistas de mídia social: mostra uma fila de
posts do TikTok com os metadados mais importantes, thumbnail e link para o
original. O analista decide **salvar** (com anotações + hashtags) ou
**descartar** cada post.

## Como abrir

Duplo-clique em `index.html` (funciona via `file://` — os dados são embutidos
em `data/posts.js`).

Ou sirva localmente, se preferir:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Funcionalidades

- **Fila / Salvos / Descartados** com contadores.
- Card com autor, legenda, hashtags, métricas e link "Abrir no TikTok".
- **Salvar** abre um modal para anotações do analista + hashtags (chips).
- **Descartar** com opção de *Desfazer*.
- Devolver itens à fila a partir de Salvos/Descartados.
- Busca por autor, legenda ou hashtag.
- Decisões persistem em `localStorage` (simula o banco de dados).

## Dados reais

Autor, legenda, **thumbnail** e link são **reais**, obtidos do endpoint
público **oEmbed** do TikTok (sem credenciais). As thumbnails são baixadas
para `assets/thumbs/` (a URL assinada do TikTok expira e bloqueia hotlink).

As métricas (views/likes/comentários/shares) são **simuladas** — o oEmbed não
as expõe — e estão marcadas como tal na interface.

### Adicionar posts reais

Cole URLs de vídeos do TikTok e rode o ingestor:

```bash
python3 tools/fetch.py "https://www.tiktok.com/@usuario/video/123..." 
# ou em lote:
python3 tools/fetch.py --file tools/seed_urls.txt
```

Ele atualiza `data/posts.json` e `data/posts.js` e baixa as thumbnails.

## Estrutura

```
index.html          interface
styles.css          estilo (tema escuro TikTok)
app.js              lógica de triagem + persistência
data/posts.json     dataset canônico (real + métricas simuladas)
data/posts.js       mesmo dataset embutível (para file://)
assets/thumbs/      thumbnails reais baixadas
tools/fetch.py      ingestor via oEmbed
tools/seed_urls.txt URLs-semente
```
