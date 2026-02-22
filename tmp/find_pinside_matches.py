import asyncio
import csv
import re
import os
import json
import math
import hashlib
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote_plus

from PIL import Image
import imagehash
from playwright.async_api import async_playwright

ROOT = Path('/Users/pillyliu/Documents/Codex/Pillyliu Pinball Website')
TARGETS_TSV = ROOT / 'tmp/pinside_image_targets.tsv'
PLAYFIELDS_DIR = ROOT / 'shared/pinball/images/playfields'
STATE_PATH = ROOT / 'tmp/pinside_state.json'
OUT_JSON = ROOT / 'tmp/pinside_match_candidates.json'
OUT_CSV = ROOT / 'tmp/pinside_match_candidates.csv'
CACHE_DIR = ROOT / 'tmp/pinside_img_cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)

MAX_ADS_PER_GAME = 100
MAX_IMAGES_PER_AD = 6
MAX_RESULTS_PER_GAME = 12


def sanitize_game_to_filename(game: str):
    slug = game.lower()
    for a, b in [(':', ''), ("'", ''), ('&', 'and'), (',', ''), ('.', ''), (' ', '-')]:
        slug = slug.replace(a, b)
    # find exact local original image
    exact = list(PLAYFIELDS_DIR.glob(f"{slug}.*"))
    exact = [p for p in exact if '_700.' not in p.name and '_1400.' not in p.name]
    if exact:
        return exact[0]
    # fallback startswith
    starts = [p for p in PLAYFIELDS_DIR.iterdir() if p.is_file() and p.name.startswith(slug)]
    starts = [p for p in starts if '_700.' not in p.name and '_1400.' not in p.name]
    return starts[0] if starts else None


def open_image_hash(path: Path):
    with Image.open(path) as im:
        im = im.convert('RGB')
        return {
            'phash': imagehash.phash(im, hash_size=16),
            'dhash': imagehash.dhash(im, hash_size=16),
            'whash': imagehash.whash(im, hash_size=16),
        }


def url_to_cache_path(url: str):
    h = hashlib.sha1(url.encode('utf-8')).hexdigest()
    return CACHE_DIR / f"{h}.img"


def normalize_imgproxy_thumb(url: str):
    # Prefer small variants for faster hashing.
    u = url.replace('&quot;', '')
    u = re.sub(r'/rs:fit:3000:3000/', '/rs:fill:360:360/', u)
    u = re.sub(r'/rs:fit:640:480/', '/rs:fill:360:360/', u)
    return u


def fetch_image(url: str):
    cache = url_to_cache_path(url)
    if cache.exists() and cache.stat().st_size > 0:
        return cache
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://pinside.com/',
    })
    with urlopen(req, timeout=20) as r:
        data = r.read()
    cache.write_bytes(data)
    return cache


def score_hash(local_h, remote_h):
    p = local_h['phash'] - remote_h['phash']
    d = local_h['dhash'] - remote_h['dhash']
    w = local_h['whash'] - remote_h['whash']
    return p * 1.0 + d * 0.8 + w * 0.6


async def collect_ad_links(page, game, max_ads=MAX_ADS_PER_GAME):
    ad_urls = []
    seen = set()
    page_num = 1
    while len(ad_urls) < max_ads:
        base = 'https://pinside.com/pinball/market/classifieds/archive'
        q = f"s=1&keywords={quote_plus(game)}&sort_by=ad_end_date&sort_order=DESC"
        if page_num == 1:
            url = f"{base}?{q}#results"
        else:
            url = f"{base}/page/{page_num}?{q}"
        await page.goto(url, wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(500)
        links = await page.evaluate("""
            () => [...new Set([...document.querySelectorAll("a[href*='/pinball/market/classifieds/archive/']")]
                .map(a => a.href)
                .filter(h => /\/pinball\/market\/classifieds\/archive\/\d+$/.test(h)))]
        """)
        if not links:
            break
        before = len(ad_urls)
        for h in links:
            if h not in seen:
                seen.add(h)
                ad_urls.append(h)
                if len(ad_urls) >= max_ads:
                    break
        if len(ad_urls) == before:
            break
        page_num += 1
        if page_num > 25:
            break
    return ad_urls[:max_ads]


async def collect_ad_images(page, ad_url):
    await page.goto(ad_url, wait_until='domcontentloaded', timeout=45000)
    await page.wait_for_timeout(300)
    title = await page.title()
    data = await page.evaluate("""
        () => {
            const hrefs = [...document.querySelectorAll('a[href]')].map(a => a.href).filter(Boolean);
            const imgs = hrefs
              .filter(h => h.includes('imgproxy.pinside.com') && h.includes('fn:pinside_market_'))
              .map(h => h.replace(/&quot;/g, ''));
            const uniq = [...new Set(imgs)];
            return uniq;
        }
    """)
    return title, data[:MAX_IMAGES_PER_AD]


async def main():
    targets = []
    with TARGETS_TSV.open(newline='', encoding='utf-8') as f:
        r = csv.DictReader(f, delimiter='\t')
        for row in r:
            game = row['game'].strip()
            if not game:
                continue
            local_file = sanitize_game_to_filename(game)
            if not local_file or not local_file.exists():
                continue
            targets.append({
                'game': game,
                'manufacturer': row['manufacturer'].strip(),
                'current_url': row['current_url'].strip(),
                'original_o_pinside_url': row['original_o_pinside_url'].strip(),
                'local_file': str(local_file),
            })

    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=False)
        context = await browser.new_context(storage_state=str(STATE_PATH))
        page = await context.new_page()

        for i, t in enumerate(targets, 1):
            game = t['game']
            print(f"[{i}/{len(targets)}] {game} ...", flush=True)
            local_hash = open_image_hash(Path(t['local_file']))
            ad_urls = await collect_ad_links(page, game, MAX_ADS_PER_GAME)
            game_matches = []

            for ad_url in ad_urls:
                try:
                    title, img_urls = await collect_ad_images(page, ad_url)
                except Exception:
                    continue

                best = None
                for img_url in img_urls:
                    u = normalize_imgproxy_thumb(img_url)
                    try:
                        pth = fetch_image(u)
                        rh = open_image_hash(pth)
                        score = score_hash(local_hash, rh)
                    except Exception:
                        continue
                    if best is None or score < best['score']:
                        best = {
                            'score': round(float(score), 3),
                            'image_url': u,
                            'image_url_raw': img_url,
                        }

                if best is not None:
                    game_matches.append({
                        'game': game,
                        'ad_url': ad_url,
                        'ad_title': title,
                        'score': best['score'],
                        'image_url': best['image_url'],
                        'image_url_raw': best['image_url_raw'],
                    })

            game_matches.sort(key=lambda x: x['score'])
            top = game_matches[:MAX_RESULTS_PER_GAME]
            results.append({
                'game': game,
                'manufacturer': t['manufacturer'],
                'local_file': t['local_file'],
                'current_url': t['current_url'],
                'original_o_pinside_url': t['original_o_pinside_url'],
                'ad_count_scanned': len(ad_urls),
                'top_matches': top,
            })

        await context.close()
        await browser.close()

    OUT_JSON.write_text(json.dumps(results, indent=2), encoding='utf-8')

    with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['game', 'ad_count_scanned', 'rank', 'score', 'ad_url', 'ad_title', 'image_url'])
        for g in results:
            for idx, m in enumerate(g['top_matches'], 1):
                w.writerow([g['game'], g['ad_count_scanned'], idx, m['score'], m['ad_url'], m['ad_title'], m['image_url']])

    print(f"wrote {OUT_JSON}")
    print(f"wrote {OUT_CSV}")


if __name__ == '__main__':
    asyncio.run(main())
