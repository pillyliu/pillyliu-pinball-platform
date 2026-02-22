import csv, json, hashlib, socket
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
socket.setdefaulttimeout(4)

MAX_ADS_PER_GAME = 5
MAX_IMAGES_PER_AD = 4
TOP_PER_GAME = 5


def game_to_file(game):
    s=game.lower()
    for a,b in [(':',''),("'",''),('&','and'),(',',''),('.',''),(' ','-')]: s=s.replace(a,b)
    c=[p for p in PLAYFIELDS.glob(f"{s}.*") if '_700.' not in p.name and '_1400.' not in p.name]
    if c: return c[0]
    c=[p for p in PLAYFIELDS.iterdir() if p.is_file() and p.name.startswith(s) and '_700.' not in p.name and '_1400.' not in p.name]
    return c[0] if c else None


def fetch(url):
    h=hashlib.sha1(url.encode()).hexdigest(); p=CACHE/f'{h}.img'
    if p.exists() and p.stat().st_size>0: return p
    req=Request(url, headers={'User-Agent':'Mozilla/5.0','Referer':'https://pinside.com/'})
    with urlopen(req, timeout=4) as r: p.write_bytes(r.read())
    return p


def h(path):
    with Image.open(path) as im:
        im=ImageOps.exif_transpose(im).convert('RGB')
        ph=imagehash.phash(im, hash_size=12)
        dh=imagehash.dhash(im, hash_size=12)
    return ph,dh


def sc(a,b):
    return (a[0]-b[0]) + 0.8*(a[1]-b[1])


def main():
    targets=[]
    with TARGETS.open(newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            lf=game_to_file(r['game'].strip())
            if lf: targets.append((r['game'].strip(), str(lf)))

    ads=defaultdict(list)
    with SHORTLIST.open(newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if int(r['priority'])<=MAX_ADS_PER_GAME: ads[r['game']].append(r['ad_url'])

    imgs=defaultdict(list); titles={}
    with FLAT.open(newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f):
            k=(r['game'],r['ad_url'])
            if r['ad_url'] in ads[r['game']]:
                imgs[k].append(r['image_url']); titles[k]=r['page_title']

    rows=[]; jout=[]
    for i,(game,lf) in enumerate(targets,1):
        lh=h(Path(lf)); c=[]; total=0; ok=0
        for ad in ads[game][:MAX_ADS_PER_GAME]:
            best=None; chk=0
            for u in imgs[(game,ad)][:MAX_IMAGES_PER_AD]:
                total+=1
                try:
                    rh=h(fetch(u)); s=float(sc(lh,rh)); ok+=1; chk+=1
                    if best is None or s<best[0]: best=(s,u)
                except Exception:
                    continue
            if best:
                c.append({'game':game,'score':round(best[0],3),'checked_images':chk,'ad_url':ad,'ad_title':titles.get((game,ad),''),'best_image_url':best[1],'local_file':lf})
        c.sort(key=lambda x:(x['score'],-x['checked_images']))
        top=c[:TOP_PER_GAME]; rows.extend(top); jout.append({'game':game,'matches':top})
        print(f"[{i}/{len(targets)}] {game}: total={total} ok={ok} matches={len(top)}", flush=True)

    with OUT_CSV.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f, fieldnames=['game','score','checked_images','ad_url','ad_title','best_image_url','local_file'])
        w.writeheader(); w.writerows(rows)
    OUT_JSON.write_text(json.dumps(jout, indent=2), encoding='utf-8')
    print('wrote',OUT_CSV)
    print('wrote',OUT_JSON)

if __name__=='__main__': main()
