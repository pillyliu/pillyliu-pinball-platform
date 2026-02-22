import csv
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from collections import defaultdict

from PIL import Image, ImageOps
import imagehash

ROOT = Path('/Users/pillyliu/Documents/Codex/Pillyliu Pinball Website')
TARGETS = ROOT / 'tmp/pinside_image_targets.tsv'
SHORTLIST = ROOT / 'tmp/pinside_phase2_shortlist.csv'
FLAT = ROOT / 'tmp/pinside_archive_ad_images_flat.csv'
OUT_CSV = ROOT / 'tmp/pinside_phase3_ranked_matches.csv'
OUT_JSON = ROOT / 'tmp/pinside_phase3_ranked_matches.json'
CACHE = ROOT / 'tmp/pinside_img_cache_phase3'
PLAYFIELDS = ROOT / 'shared/pinball/images/playfields'
CACHE.mkdir(parents=True, exist_ok=True)

MAX_ADS_PER_GAME = 8
MAX_IMAGES_PER_AD = 8
TOP_PER_GAME = 8


def game_to_local_file(game: str):
    slug = game.lower()
    for a, b in [(':', ''), ("'", ''), ('&', 'and'), (',', ''), ('.', ''), (' ', '-')]:
        slug = slug.replace(a, b)
    exact = [p for p in PLAYFIELDS.glob(f"{slug}.*") if '_700.' not in p.name and '_1400.' not in p.name]
    if exact:
        return exact[0]
    starts = [p for p in PLAYFIELDS.iterdir() if p.is_file() and p.name.startswith(slug) and '_700.' not in p.name and '_1400.' not in p.name]
    return starts[0] if starts else None


def fetch(url: str):
    h = hashlib.sha1(url.encode()).hexdigest()
    out = CACHE / f"{h}.img"
    if out.exists() and out.stat().st_size > 0:
        return out
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://pinside.com/'
    })
    with urlopen(req, timeout=12) as r:
        out.write_bytes(r.read())
    return out


def hashes(path: Path):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        ph = imagehash.phash(im, hash_size=16)
        dh = imagehash.dhash(im, hash_size=16)
        w, h = im.size
        c = im.crop((int(w*0.1), int(h*0.1), int(w*0.9), int(h*0.9))) if w > 200 and h > 200 else im
        cph = imagehash.phash(c, hash_size=16)
    return {'ph': ph, 'dh': dh, 'cph': cph}


def score(a, b):
    return min((a['ph']-b['ph']) + 0.8*(a['dh']-b['dh']), 0.9*(a['cph']-b['cph']) + 0.4*(a['dh']-b['dh']))


def main():
    targets = []
    with TARGETS.open(newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            game = r['game'].strip()
            lf = game_to_local_file(game)
            if game and lf:
                targets.append({'game': game, 'local_file': str(lf)})

    ads_by_game = defaultdict(list)
    with SHORTLIST.open(newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if int(r['priority']) <= MAX_ADS_PER_GAME:
                ads_by_game[r['game']].append(r['ad_url'])

    images_by_ad = defaultdict(list)
    title_by_ad = {}
    with FLAT.open(newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            g, ad = r['game'], r['ad_url']
            if ad in ads_by_game[g]:
                images_by_ad[(g, ad)].append(r['image_url'])
                title_by_ad[(g, ad)] = r['page_title']

    out_rows = []
    out_json = []

    for i, t in enumerate(targets, 1):
        game = t['game']
        local_h = hashes(Path(t['local_file']))
        cands = []
        total_imgs = 0
        ok_imgs = 0
        for ad in ads_by_game[game][:MAX_ADS_PER_GAME]:
            imgs = images_by_ad[(game, ad)][:MAX_IMAGES_PER_AD]
            best = None
            checked = 0
            for u in imgs:
                total_imgs += 1
                try:
                    rh = hashes(fetch(u))
                    s = float(score(local_h, rh))
                    checked += 1
                    ok_imgs += 1
                    if best is None or s < best['score']:
                        best = {'score': round(s,3), 'u': u}
                except Exception:
                    continue
            if best:
                cands.append({
                    'game': game,
                    'score': best['score'],
                    'checked_images': checked,
                    'ad_url': ad,
                    'ad_title': title_by_ad.get((game, ad), ''),
                    'best_image_url': best['u'],
                    'local_file': t['local_file'],
                })
        cands.sort(key=lambda x: (x['score'], -x['checked_images']))
        top = cands[:TOP_PER_GAME]
        out_rows.extend(top)
        out_json.append({'game': game, 'matches': top})
        print(f"[{i}/{len(targets)}] {game}: ads={len(ads_by_game[game][:MAX_ADS_PER_GAME])} images={total_imgs} ok={ok_imgs} matches={len(top)}", flush=True)

    with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['game','score','checked_images','ad_url','ad_title','best_image_url','local_file'])
        w.writeheader(); w.writerows(out_rows)
    OUT_JSON.write_text(json.dumps(out_json, indent=2), encoding='utf-8')
    print(f"wrote {OUT_CSV}")
    print(f"wrote {OUT_JSON}")


if __name__ == '__main__':
    main()
