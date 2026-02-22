import asyncio
import csv
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path('/Users/pillyliu/Documents/Codex/Pillyliu Pinball Website')
IN_CSV = ROOT / 'tmp/pinside_archive_ads_candidates.csv'
STATE_PATH = ROOT / 'tmp/pinside_state.json'
OUT_JSONL = ROOT / 'tmp/pinside_archive_ad_images.jsonl'
OUT_CSV = ROOT / 'tmp/pinside_archive_ad_images_flat.csv'

MAX_PER_GAME = 100
TIMEOUT_MS = 45000


def load_candidates():
    rows = []
    per_game = {}
    with IN_CSV.open(newline='', encoding='utf-8') as f:
        r = csv.DictReader(f)
        for row in r:
            g = row['game'].strip()
            per_game.setdefault(g, 0)
            if per_game[g] >= MAX_PER_GAME:
                continue
            per_game[g] += 1
            rows.append({
                'game': g,
                'rank': int(row['rank']),
                'ad_url': row['ad_url'].strip(),
                'ad_title': row['ad_title'].strip(),
            })
    return rows


async def extract_from_ad(page, ad_url: str):
    await page.goto(ad_url, wait_until='domcontentloaded', timeout=TIMEOUT_MS)
    await page.wait_for_timeout(250)
    title = await page.title()
    data = await page.evaluate(
        """
        () => {
          const clean = (u) => (u || '').replace(/&quot;/g, '').trim();
          const hrefs = [...document.querySelectorAll('a[href]')].map(a => clean(a.href));
          const imgs  = [...document.querySelectorAll('img[src]')].map(i => clean(i.src));
          const all = [...hrefs, ...imgs];

          const gallery = [...new Set(all.filter(u =>
            u.includes('imgproxy.pinside.com') &&
            (u.includes('fn:pinside_market_') || u.includes('/fn:pinside_market_'))
          ))];

          const marketIds = [...new Set(gallery.map(u => {
            const m = u.match(/fn:pinside_market_(\d+)(?:_|\b)/);
            return m ? m[1] : null;
          }).filter(Boolean))];

          return { gallery, marketIds };
        }
        """
    )
    return title, data['gallery'], data['marketIds']


async def main():
    candidates = load_candidates()
    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)

    if OUT_JSONL.exists():
        OUT_JSONL.unlink()
    if OUT_CSV.exists():
        OUT_CSV.unlink()

    processed = 0
    failures = 0

    flat_rows = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=False)
        context = await browser.new_context(storage_state=str(STATE_PATH))
        page = await context.new_page()

        total = len(candidates)
        for i, row in enumerate(candidates, 1):
            game = row['game']
            ad_url = row['ad_url']
            record = {
                'game': game,
                'rank': row['rank'],
                'ad_url': ad_url,
                'seed_title': row['ad_title'],
                'page_title': '',
                'market_ids_in_images': [],
                'gallery_image_urls': [],
                'error': '',
            }

            try:
                title, gallery, mids = await extract_from_ad(page, ad_url)
                record['page_title'] = title
                record['gallery_image_urls'] = gallery
                record['market_ids_in_images'] = mids
                processed += 1

                for idx, u in enumerate(gallery, 1):
                    flat_rows.append({
                        'game': game,
                        'rank': row['rank'],
                        'ad_url': ad_url,
                        'page_title': title,
                        'image_index': idx,
                        'image_url': u,
                    })
            except Exception as e:
                failures += 1
                record['error'] = str(e)

            with OUT_JSONL.open('a', encoding='utf-8') as jf:
                jf.write(json.dumps(record, ensure_ascii=False) + '\n')

            if i % 25 == 0 or i == total:
                print(f"[{i}/{total}] processed={processed} failures={failures}", flush=True)

        await context.close()
        await browser.close()

    with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['game', 'rank', 'ad_url', 'page_title', 'image_index', 'image_url'])
        w.writeheader()
        w.writerows(flat_rows)

    print(f"done processed={processed} failures={failures}")
    print(f"jsonl={OUT_JSONL}")
    print(f"flat_csv={OUT_CSV}")


if __name__ == '__main__':
    asyncio.run(main())
