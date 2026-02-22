import asyncio
import csv
import re
from pathlib import Path
from urllib.parse import quote_plus
from playwright.async_api import async_playwright

ROOT = Path('/Users/pillyliu/Documents/Codex/Pillyliu Pinball Website')
TARGETS_TSV = ROOT / 'tmp/pinside_image_targets.tsv'
STATE_PATH = ROOT / 'tmp/pinside_state.json'
OUT_CSV = ROOT / 'tmp/pinside_archive_ads_candidates.csv'
MAX_ADS = 100

async def collect_for_game(page, game):
    out = []
    seen = set()
    p = 1
    while len(out) < MAX_ADS and p <= 40:
        base = 'https://pinside.com/pinball/market/classifieds/archive'
        q = f"s=1&keywords={quote_plus(game)}&sort_by=ad_end_date&sort_order=DESC"
        url = f"{base}?{q}#results" if p == 1 else f"{base}/page/{p}?{q}"
        await page.goto(url, wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(300)

        rows = await page.evaluate("""
            () => {
                const map = new Map();
                const anchors = [...document.querySelectorAll("a[href*='/pinball/market/classifieds/archive/']")];
                for (const a of anchors) {
                    const href = a.href;
                    if (!/\/pinball\/market\/classifieds\/archive\/\d+$/.test(href)) continue;
                    const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
                    if (!map.has(href)) map.set(href, '');
                    if (text.length > (map.get(href) || '').length) map.set(href, text);
                }
                return [...map.entries()].map(([ad_url, ad_title]) => ({ad_url, ad_title}));
            }
        """)

        if not rows:
            break
        before = len(out)
        for r in rows:
            u = r['ad_url']
            if u in seen:
                continue
            seen.add(u)
            out.append((u, r.get('ad_title', '')))
            if len(out) >= MAX_ADS:
                break
        if len(out) == before:
            break
        p += 1
    return out[:MAX_ADS]


async def main():
    games = []
    with TARGETS_TSV.open(newline='', encoding='utf-8') as f:
        r = csv.DictReader(f, delimiter='\t')
        for row in r:
            game = row['game'].strip()
            if game:
                games.append(game)

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=False)
        context = await browser.new_context(storage_state=str(STATE_PATH))
        page = await context.new_page()

        for i, game in enumerate(games, 1):
            print(f"[{i}/{len(games)}] {game}", flush=True)
            ads = await collect_for_game(page, game)
            for rank, (ad_url, ad_title) in enumerate(ads, 1):
                results.append((game, rank, ad_url, ad_title))

        await context.close()
        await browser.close()

    with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['game', 'rank', 'ad_url', 'ad_title'])
        w.writerows(results)

    print(f"wrote {OUT_CSV} rows={len(results)}")

if __name__ == '__main__':
    asyncio.run(main())
