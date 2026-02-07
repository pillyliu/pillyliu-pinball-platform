type ManifestEntry = {
  hash: string;
  size: number;
  mtimeMs: number;
  contentType: string;
};

type Manifest = {
  schemaVersion: number;
  generatedAt: string;
  totalFiles: number;
  files: Record<string, ManifestEntry>;
};

const MANIFEST_URL = "/pinball/cache-manifest.json";
const STORAGE_PREFIX = "pinball-cache:v1";
const ASSET_CACHE = "pinball-assets-v1";
const EXTERNAL_ASSET_CACHE = "pinball-external-assets-v1";

let manifestPromise: Promise<Manifest | null> | null = null;

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

function storageKey(kind: string, path: string): string {
  return `${STORAGE_PREFIX}:${kind}:${normalizePath(path)}`;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fallbackPath(path: string): string {
  const p = normalizePath(path);
  try {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin);
    return new URL(p.replace(/^\//, ""), base).pathname;
  } catch {
    return p;
  }
}

async function fetchResponseNetwork(path: string): Promise<{ response: Response; resolvedPath: string }> {
  const primary = normalizePath(path);
  const urls = [primary];
  const alt = fallbackPath(primary);
  if (alt !== primary) urls.push(alt);

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return { response: res, resolvedPath: url };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e ?? "unknown"));
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${primary}`);
}

async function fetchTextNetwork(path: string): Promise<string> {
  const { response } = await fetchResponseNetwork(path);
  return response.text();
}

export async function loadManifest(): Promise<Manifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(MANIFEST_URL, { cache: "no-store" });
        if (!res.ok) return null;
        const json = (await res.json()) as Manifest;
        return json;
      } catch {
        return null;
      }
    })();
  }
  return manifestPromise;
}

export async function fetchPinballText(path: string): Promise<string> {
  const normalized = normalizePath(path);
  const cacheKey = storageKey("text", normalized);
  const cached = parseJson<{ hash: string | null; text: string }>(
    localStorage.getItem(cacheKey)
  );

  const manifest = await loadManifest();
  const nextHash = manifest?.files?.[normalized]?.hash ?? null;

  if (cached && (!nextHash || cached.hash === nextHash)) {
    return cached.text;
  }

  try {
    const text = await fetchTextNetwork(normalized);
    const payload = { hash: nextHash, text, updatedAt: new Date().toISOString() };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
    return text;
  } catch (error) {
    if (cached?.text) return cached.text;
    throw error;
  }
}

export async function fetchPinballJson<T>(path: string): Promise<T> {
  const text = await fetchPinballText(path);
  return JSON.parse(text) as T;
}

export async function prefetchPinballTextAssets(pathPrefixes: string[] = []): Promise<void> {
  if (!("caches" in window)) return;
  const manifest = await loadManifest();
  if (!manifest) return;

  const hashStateKey = `${STORAGE_PREFIX}:asset-hashes:text`;
  const previous = parseJson<Record<string, string>>(localStorage.getItem(hashStateKey)) ?? {};
  const next: Record<string, string> = {};

  const cache = await caches.open(ASSET_CACHE);
  const writes: Promise<void>[] = [];
  const normalizePrefix = (p: string) => (p.endsWith("/") ? p : `${p}/`);
  const normalizedPrefixes = pathPrefixes.map(normalizePrefix);

  for (const [path, entry] of Object.entries(manifest.files)) {
    const isDefaultTextAsset =
      path.includes("/pinball/data/") ||
      path.includes("/pinball/rulesheets/") ||
      path.includes("/pinball/gameinfo/");
    const inRequestedPrefix =
      normalizedPrefixes.length === 0 ||
      normalizedPrefixes.some((prefix) => path.startsWith(prefix));
    if (!isDefaultTextAsset || !inRequestedPrefix) continue;

    next[path] = entry.hash;
    if (previous[path] === entry.hash) continue;

    writes.push(
      fetchResponseNetwork(path)
        .then(({ response, resolvedPath }) => {
          return cache.put(resolvedPath, response.clone());
        })
        .then(() => undefined)
        .catch(() => undefined)
    );
  }

  for (const oldPath of Object.keys(previous)) {
    if (!next[oldPath]) {
      writes.push(cache.delete(oldPath).then(() => undefined).catch(() => undefined));
    }
  }

  await Promise.all(writes);
  localStorage.setItem(hashStateKey, JSON.stringify(next));
}

export async function cacheAssetUrl(url: string): Promise<void> {
  if (!("caches" in window) || !url) return;

  const isSameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
  const cacheName = isSameOrigin ? ASSET_CACHE : EXTERNAL_ASSET_CACHE;
  const req = isSameOrigin ? new Request(url) : new Request(url, { mode: "no-cors" });

  try {
    const cache = await caches.open(cacheName);
    const existing = await cache.match(req);
    if (existing) return;
    const res = await fetch(req);
    await cache.put(req, res.clone());
  } catch {
    // Best-effort cache warmup only
  }
}
