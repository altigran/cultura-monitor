#!/usr/bin/env python3
"""
fetch.py — Ingestao de posts REAIS do TikTok para o mockup do curador.

Uso:
    python3 tools/fetch.py URL [URL ...]
    python3 tools/fetch.py --file tools/seed_urls.txt

O que faz para cada URL de video do TikTok:
  1. Chama o endpoint publico oEmbed (sem credenciais).
  2. Extrai autor, legenda/titulo, link e thumbnail REAIS.
  3. Baixa a thumbnail para assets/thumbs/<id>.jpg (a URL assinada do
     TikTok expira e bloqueia hotlink; por isso guardamos local).
  4. Gera metricas PLAUSIVEIS porem SIMULADAS (o oEmbed nao expoe
     views/likes/comentarios/shares). Sao deterministicas por id.
  5. Faz merge em data/posts.json (nao duplica por id).

Campos reais:    author, author_url, caption, link, thumbnail, hashtags
Campos simulados: views, likes, comments, shares, posted_at  (metrics_simulated=true)
"""
import sys
import os
import re
import json
import hashlib
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "posts.json")
THUMBS = os.path.join(ROOT, "assets", "thumbs")
OEMBED = "https://www.tiktok.com/oembed?url="
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def vid_id(url):
    m = re.search(r"/video/(\d+)", url)
    return m.group(1) if m else hashlib.sha1(url.encode()).hexdigest()[:16]


def seeded(id_str, lo, hi):
    """Numero deterministico em [lo, hi] derivado do id (metricas estaveis)."""
    h = int(hashlib.sha256(id_str.encode()).hexdigest(), 16)
    return lo + (h % (hi - lo + 1))


def extract_hashtags(text):
    return re.findall(r"#(\w+)", text or "")


def fetch_oembed(url):
    req = urllib.request.Request(OEMBED + urllib.parse.quote(url, safe=""),
                                 headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode())
    if data.get("code") or not data.get("author_name"):
        raise ValueError(data.get("message", "resposta invalida"))
    return data


def download_thumb(thumb_url, vid):
    if not thumb_url:
        return ""
    os.makedirs(THUMBS, exist_ok=True)
    path = os.path.join(THUMBS, vid + ".jpg")
    req = urllib.request.Request(thumb_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        with open(path, "wb") as f:
            f.write(r.read())
    return os.path.relpath(path, ROOT)


def load_posts():
    if os.path.exists(DATA):
        with open(DATA, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_posts(posts):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    # Tambem grava como JS embutivel, para abrir o index.html via file://
    # (o fetch() de JSON local e bloqueado pelo Chrome).
    js = os.path.join(os.path.dirname(DATA), "posts.js")
    with open(js, "w", encoding="utf-8") as f:
        f.write("window.__POSTS__ = ")
        json.dump(posts, f, ensure_ascii=False, indent=2)
        f.write(";\n")


def build_post(url, o, vid, thumb_path):
    caption = o.get("title", "")
    months = ["2025-09", "2025-11", "2026-01", "2026-03", "2026-05"]
    return {
        "id": vid,
        "author": o.get("author_name", ""),
        "author_url": o.get("author_url", ""),
        "caption": caption,
        "link": url,
        "thumbnail": thumb_path,
        "hashtags": extract_hashtags(caption),
        # --- metricas SIMULADAS (oEmbed nao fornece) ---
        "metrics_simulated": True,
        "views": seeded(vid + "v", 50_000, 9_500_000),
        "likes": seeded(vid + "l", 5_000, 1_200_000),
        "comments": seeded(vid + "c", 80, 45_000),
        "shares": seeded(vid + "s", 40, 90_000),
        "posted_at": months[seeded(vid, 0, len(months) - 1)] + "-15",
    }


def main(argv):
    args = argv[1:]
    if not args:
        print(__doc__)
        return 1
    urls = []
    if args[0] == "--file":
        with open(args[1], encoding="utf-8") as f:
            urls = [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
    else:
        urls = args

    posts = load_posts()
    by_id = {p["id"]: p for p in posts}
    ok = 0
    for url in urls:
        vid = vid_id(url)
        try:
            o = fetch_oembed(url)
            thumb = download_thumb(o.get("thumbnail_url", ""), vid)
            by_id[vid] = build_post(url, o, vid, thumb)
            ok += 1
            print(f"  OK   {o['author_name']:<22} {url}")
        except Exception as e:
            print(f"  SKIP ({e})  {url}")

    save_posts(list(by_id.values()))
    print(f"\n{ok}/{len(urls)} posts reais ingeridos -> {os.path.relpath(DATA, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
