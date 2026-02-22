import csv
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from collections import defaultdict

from PIL import Image, ImageOps
import imagehash

ROOT = Path('/Users/pillyliu/Documents/Codex/Pillyliu Pinball Website')
TARGETS = ROOT / 'tmp/pinside_image_targets.tsv'
SHORTLIST = ROOT / 'tmp/pinside_phase2_shortlist.csv'  # top 15 ads/game by image count
FLAT = ROOT / 'tmp/pinside_archive_ad_images_flat.csv'
OUT_CSV = ROOT / 'tmp/pinside_phase3_ranked_matches.csv'
OUT_JSON = ROOT / 'tmp/pinside_phase3_ranked_matches.json'
CACHE = ROOT / 'tmp/pinside_img_cache_phase3'
PLAYFIELDS = ROOT / 'shared/pinball/images/playfields'
CACHE.mkdir(parents=True, exist_ok=True)

MAX_ADS_PER_GAME = 15  # from shortlist
MAX_IMAGES_PER_AD = 20
TOP_PER_GAME = 12


def game_to_local_file(game: str):
    slug = game.lower()
    for a, b in [(':', ''), ("'", ''), ('&', 'and'), (',', ''), ('.', ''), (' ', '-')]:
        slug = slug.replace(a, b)
    exact = [p for p in PLAYFIELDS.glob(f"{slug}.*") if '_700.' not in p.name and '_1400.' not in p.name]
    if exact:
        return exact[0]
    starts = [p for p in PLAYFIELDS.iterdir() if p.is_file() and p.name.startswith(slug) and '_700.' not in p.name and '_1400.' not in p.name]
    return starts[0] if starts else None


def fetch(url: str) -> Path:
    h = hashlib.sha1(url.encode()).hexdigest()
    out = CACHE / f"{h}.img"
    if out.exists() and out.stat().st_size > 0:
        return out
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://pinside.com/'
    })
    with urlopen(req, timeout=20) as r:
        out.write_bytes(r.read())
    return out


def hashes(path: Path):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        # full image hashes
        ph = imagehash.phash(im, hash_size=16)
        dh = imagehash.dhash(im, hash_size=16)
        wh = imagehash.whash(im, hash_size=16)

        # center crop hashes help when borders differ
        w, h = im.size
        cx = int(w * 0.1)
        cy = int(h * 0.1)
        if w - 2*cx > 50 and h - 2*cy > 50:
            crop = im.crop((cx, cy, w-cx, h-cy))
        else:
            crop = im
        cph = imagehash.phash(crop, hash_size=16)
        cdh = imagehash.dhash(crop, hash_size=16)

    return {'ph': ph, 'dh': dh, 'wh': wh, 'cph': cph, 'cdh': cdh}


def score(a, b):
    # lower is better
    s_full = (a['ph'] - b['ph']) * 1.0 + (a['dh'] - b['dh']) * 0.8 + (a['wh'] - b['wh']) * 0.6
    s_crop = (a['cph'] - b['cph']) * 0.9 + (a['cdh'] - b['cdh']) * 0.7
    return min(s_full, s_crop)


def main():
    targets = []
    with TARGETS.open(newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            game = r['game'].strip()
            if not game:
                continue
            lf = game_to_local_file(game)
            if not lf:
                continue
            targets.append({
                'game': game,
                'manufacturer': r['manufacturer'].strip(),
                'local_file': str(lf),
            })

    # shortlist ads per game
    ads_by_game = defaultdict(set)
    with SHORTLIST.open(newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if int(r['priority']) <= MAX_ADS_PER_GAME:
                ads_by_game[r['game']].add(r['ad_url'])

    # image urls keyed by ad
    images_by_ad = defaultdict(list)
    ad_title = {}
    with FLAT.open(newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            u = r['image_url'].strip()
            if not u:
                continue
            g = r['game']
            ad = r['ad_url']
            if ad in ads_by_game[g]:
                images_by_ad[(g, ad)].append(u)
                ad_title[(g, ad)] = r['page_title']

    out_rows = []
    out_json = []

    for t in targets:
        game = t['game']
        local_path = Path(t['local_file'])
        local_h = hashes(local_path)
        candidates = []

        for ad in ads_by_game[game]:
            imgs = images_by_ad.get((game, ad), [])[:MAX_IMAGES_PER_AD]
            best = None
            checked = 0
            for u in imgs:
                try:
                    p = fetch(u)
                    rh = hashes(p)
                    s = float(score(local_h, rh))
                    checked += 1
                    if best is None or s < best['score']:
                        best = {'score': round(s, 3), 'image_url': u}
                except Exception:
                    continue
            if best is not None:
                candidates.append({
                    'game': game,
                    'ad_url': ad,
                    'ad_title': ad_title.get((game, ad), ''),
                    'score': best['score'],
                    'checked_images': checked,
                    'best_image_url': best['image_url'],
                    'local_file': str(local_path),
                })

        candidates.sort(key=lambda x: (x['score'], -x['checked_images']))
        top = candidates[:TOP_PER_GAME]
        out_json.append({'game': game, 'local_file': str(local_path), 'matches': top})
        out_rows.extend(top)

    with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['game','score','checked_images','ad_url','ad_title','best_image_url','local_file'])
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    OUT_JSON.write_text(json.dumps(out_json, indent=2), encoding='utf-8')
    print(f'wrote {OUT_CSV}')
    print(f'wrote {OUT_JSON}')
    print(f'rows {len(out_rows)}')


if __name__ == '__main__':
    main()
