"""Build only frontends whose source, installed toolchain or output bytes changed."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

SKIP = {'.git', '.DS_Store', '.vite', '.vite-temp', '.cache', 'dist', 'node_modules', '__pycache__'}


def fingerprint(paths, *, outputs=False, packages=False):
    digest = hashlib.sha256()
    def visit(path, parents):
        digest.update(os.fsencode(path) + b'\0')
        if path.is_dir():
            key = path.resolve()
            if key in parents:
                raise ValueError(f'Build input symlink cycle at {path}')
            for item in sorted(path.iterdir()):
                ignored = {'.DS_Store', '.git', '.cache', '.vite', '.vite-temp'} if packages else SKIP
                if outputs or item.name not in ignored:
                    visit(item, parents | {key})
        elif path.is_file():
            with path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(chunk)
        else:
            digest.update(b'missing')
        digest.update(b'\0')
    for path in paths:
        visit(path, set())
    return digest.hexdigest()


def main():
    root = Path.cwd()
    admin = Path(sys.argv[1]).resolve()
    cache = Path(sys.argv[2])
    cache.mkdir(parents=True, exist_ok=True)
    apps = json.loads((root/'package.json').read_text())['workspaces']
    common = [root/'package-lock.json', root/'package.json', root/'.npmrc', root/'shared', Path(__file__),
              *sorted(root.glob('.env*')), root/'node_modules']
    # Workspaces are linked into node_modules. Their own source is accounted
    # for separately. Hash the lock and installed external packages once.
    modules = common.pop()
    versions = [subprocess.check_output([exe, '--version'], text=True).strip() for exe in ('node', 'npm')]
    env = {k:v for k,v in os.environ.items() if k.startswith(('VITE_', 'PINPROF_ADMIN_API_', 'NODE_', 'NPM_CONFIG_'))}
    external = [p for p in sorted(modules.iterdir()) if p.name not in {*apps, '.vite', '.cache', '.vite-temp'}]
    shared = [fingerprint(common), fingerprint(external, packages=True)]
    for name, app in [(name, root/name) for name in apps] + [('admin-ui', admin)]:
        npm = ['npm', '--prefix', str(app), 'run', 'build']
        key = [shared, fingerprint([app]), fingerprint([app/"node_modules"], packages=True), versions, hashlib.sha256(json.dumps(env, sort_keys=True).encode()).hexdigest()]
        receipt = cache/(name+'.json')
        dist = app/'dist'
        try:
            prior = json.loads(receipt.read_bytes())
        except (OSError, ValueError):
            prior = {}
        if dist.is_dir() and prior.get('inputs') == key and prior.get('output') == fingerprint([dist], outputs=True):
            print(f'Frontend {name}: reused verified dist', flush=True)
            continue
        reason = 'missing build receipt or output' if not prior or not dist.is_dir() else 'changed inputs or output'
        print(f'Frontend {name}: building ({reason})', flush=True)
        subprocess.run(npm, check=True)
        if not (dist/'index.html').is_file():
            raise RuntimeError(f'Build produced no index: {dist}')
        with tempfile.NamedTemporaryFile(mode='w', dir=cache, delete=False) as out:
            json.dump(dict(inputs=key, output=fingerprint([dist], outputs=True)), out)
        Path(out.name).replace(receipt)


if __name__ == '__main__':
    main()
