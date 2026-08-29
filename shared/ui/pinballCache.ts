type ManifestEntry = {
  hash: string;
  size: number;
  mtimeMs: number;
  contentType: string;
  contentPath?: string;
};

type CohortFile = {
  path: string;
  contentPath: string;
  hash: string;
  size: number;
  contentType: string;
  priority: number;
};

type ManifestCohort = {
  revision: string;
  atomic: boolean;
  files: CohortFile[];
};

type Manifest = {
  schemaVersion: number;
  generatedAt: string;
  totalFiles: number;
  mirrors?: string[];
  files: Record<string, ManifestEntry>;
  cohorts?: Record<string, ManifestCohort>;
};

type ActiveCohortPointer = {
  revision: string;
  files: Record<string, Pick<CohortFile, "contentPath" | "hash" | "size">>;
};

const MANIFEST_PATH = "/pinball/cache-manifest.json";
const STATIC_DATA_ORIGINS = Object.freeze([
  "https://data.pinprof.com",
  "https://pillyliu.com",
]);
const STORAGE_PREFIX = "pinball-cache:v1";
const ASSET_CACHE = "pinball-assets-v1";
const COHORT_CACHE = "pinball-cohorts-v1";
const EXTERNAL_ASSET_CACHE = "pinball-external-assets-v1";
const TEXT_COHORT_NAMES = new Set(["catalogContent", "leagueCommunity"]);

let manifestPromise: Promise<Manifest | null> | null = null;
const cohortPromises = new Map<string, Promise<boolean>>();
const runtimePointers = new Map<string, ActiveCohortPointer>();
const runtimeText = new Map<string, Map<string, string>>();

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

function assetUrls(path: string): string[] {
  const primary = normalizePath(path);
  const urls = [primary];
  const alt = fallbackPath(primary);
  if (alt !== primary) urls.push(alt);
  return urls;
}

function networkUrls(path: string, mirrors: string[] = []): string[] {
  const normalized = normalizePath(path);
  const urls: string[] = [];
  for (const mirror of [...mirrors, ...STATIC_DATA_ORIGINS]) {
    if (!/^https?:\/\//i.test(mirror)) continue;
    try {
      urls.push(new URL(normalized, `${mirror.replace(/\/$/, "")}/`).href);
    } catch {
      // Ignore malformed optional mirrors and keep the remaining routes.
    }
  }
  urls.push(...assetUrls(normalized));
  return Array.from(new Set(urls));
}

function storageKey(kind: string, path: string): string {
  return `${STORAGE_PREFIX}:${kind}:${normalizePath(path)}`;
}

function activeCohortStorageKey(name: string): string {
  return `${STORAGE_PREFIX}:cohort:${name}:active`;
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

async function fetchResponseNetwork(
  path: string,
  mirrors: string[] = []
): Promise<{ response: Response; resolvedPath: string }> {
  const primary = normalizePath(path);
  const urls = networkUrls(primary, mirrors);

  let lastError: Error | null = null;
  for (const url of urls) {
    for (const cacheMode of ["no-store", "default"] as const) {
      try {
        const response = await fetch(url, { cache: cacheMode });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return { response, resolvedPath: url };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error ?? "unknown"));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${primary}`);
}

async function readTextAssetCache(path: string): Promise<string | null> {
  if (!("caches" in window)) return null;

  const urls = networkUrls(path);
  try {
    const cache = await caches.open(ASSET_CACHE);
    for (const url of urls) {
      const cached = await cache.match(url);
      if (cached) return await cached.text();
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchTextNetwork(path: string): Promise<string> {
  const { response } = await fetchResponseNetwork(path);
  return response.text();
}

function textHashStateKey(): string {
  return `${STORAGE_PREFIX}:asset-hashes:text`;
}

function persistTextAsset(path: string, text: string, hash: string | null) {
  const normalized = normalizePath(path);
  try {
    localStorage.setItem(
      storageKey("text", normalized),
      JSON.stringify({ hash, text, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Storage is an optimization; network reads remain available.
  }
}

function clearStoredTextAsset(path: string) {
  const normalized = normalizePath(path);
  try {
    localStorage.removeItem(storageKey("text", normalized));
    const hashState = parseJson<Record<string, string>>(localStorage.getItem(textHashStateKey())) ?? {};
    if (Object.hasOwn(hashState, normalized)) {
      delete hashState[normalized];
      localStorage.setItem(textHashStateKey(), JSON.stringify(hashState));
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}

async function deleteTextAssetCache(path: string): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(ASSET_CACHE);
    await Promise.all(
      networkUrls(path).map((url) => cache.delete(url).then(() => undefined).catch(() => undefined))
    );
  } catch {
    // Ignore cache cleanup failures.
  }
}

async function resetTextAssetState(path: string): Promise<void> {
  clearStoredTextAsset(path);
  await deleteTextAssetCache(path);
}

function validHexDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function validatedCohort(manifest: Manifest, name: string): ManifestCohort | null {
  const cohort = manifest.cohorts?.[name];
  if (!cohort || cohort.atomic !== true || !validHexDigest(cohort.revision)) return null;
  if (!Array.isArray(cohort.files) || cohort.files.length === 0) return null;

  const paths = new Set<string>();
  for (const file of cohort.files) {
    const normalized = normalizePath(file?.path ?? "");
    const manifestFile = manifest.files[normalized];
    if (
      !normalized ||
      paths.has(normalized) ||
      !file?.contentPath ||
      !validHexDigest(file.hash) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      !manifestFile ||
      manifestFile.hash !== file.hash ||
      manifestFile.size !== file.size ||
      manifestFile.contentPath !== file.contentPath
    ) {
      return null;
    }
    paths.add(normalized);
  }
  return cohort;
}

function textCohortForPath(
  manifest: Manifest,
  path: string
): { name: string; cohort: ManifestCohort } | null {
  const normalized = normalizePath(path);
  for (const name of TEXT_COHORT_NAMES) {
    const cohort = validatedCohort(manifest, name);
    if (cohort?.files.some((file) => normalizePath(file.path) === normalized)) {
      return { name, cohort };
    }
  }
  return null;
}

function pointerForCohort(name: string): ActiveCohortPointer | null {
  const runtime = runtimePointers.get(name);
  if (runtime) return runtime;
  try {
    const stored = parseJson<ActiveCohortPointer>(localStorage.getItem(activeCohortStorageKey(name)));
    if (!stored || !validHexDigest(stored.revision) || !stored.files) return null;
    runtimePointers.set(name, stored);
    return stored;
  } catch {
    return null;
  }
}

function persistActivePointer(name: string, pointer: ActiveCohortPointer) {
  runtimePointers.set(name, pointer);
  try {
    localStorage.setItem(activeCohortStorageKey(name), JSON.stringify(pointer));
  } catch {
    // The in-memory pointer still preserves atomicity for this page session.
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 verification is unavailable in this browser context.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyCohortBytes(file: CohortFile, bytes: ArrayBuffer): Promise<void> {
  if (bytes.byteLength !== file.size) {
    throw new Error(`Size mismatch for ${file.path}: expected ${file.size}, received ${bytes.byteLength}`);
  }
  const digest = await sha256Hex(bytes);
  if (digest !== file.hash.toLowerCase()) {
    throw new Error(`SHA-256 mismatch for ${file.path}`);
  }
}

async function cachedCohortBytes(file: CohortFile): Promise<ArrayBuffer | null> {
  if (!("caches" in window)) return null;
  const cache = await caches.open(COHORT_CACHE);
  const cached = await cache.match(normalizePath(file.contentPath));
  if (!cached) return null;
  const bytes = await cached.arrayBuffer();
  try {
    await verifyCohortBytes(file, bytes);
    return bytes;
  } catch {
    await cache.delete(normalizePath(file.contentPath));
    return null;
  }
}

async function storeCohortBytes(file: CohortFile, bytes: ArrayBuffer): Promise<void> {
  if (!("caches" in window)) return;
  const headers = new Headers({ "content-type": file.contentType || "application/octet-stream" });
  const cache = await caches.open(COHORT_CACHE);
  await cache.put(normalizePath(file.contentPath), new Response(bytes, { status: 200, headers }));
}

async function readActiveCohortText(name: string, path: string): Promise<string | null> {
  const normalized = normalizePath(path);
  const memory = runtimeText.get(name)?.get(normalized);
  if (memory != null) return memory;

  const pointer = pointerForCohort(name);
  const file = pointer?.files?.[normalized];
  if (!file || !("caches" in window)) return null;
  try {
    const cache = await caches.open(COHORT_CACHE);
    const cached = await cache.match(normalizePath(file.contentPath));
    return cached ? await cached.text() : null;
  } catch {
    return null;
  }
}

async function activeCohortIsComplete(name: string, cohort: ManifestCohort): Promise<boolean> {
  const pointer = pointerForCohort(name);
  if (pointer?.revision !== cohort.revision) return false;
  for (const file of cohort.files) {
    const normalized = normalizePath(file.path);
    const active = pointer.files[normalized];
    if (!active || active.hash !== file.hash || active.contentPath !== file.contentPath) return false;
    if (runtimeText.get(name)?.has(normalized)) continue;
    if (!("caches" in window)) return false;
    const cache = await caches.open(COHORT_CACHE);
    if (!(await cache.match(normalizePath(file.contentPath)))) return false;
  }
  return true;
}

async function stageCohort(
  manifest: Manifest,
  name: string,
  cohort: ManifestCohort,
  forceRefresh = false
): Promise<boolean> {
  if (!forceRefresh && await activeCohortIsComplete(name, cohort)) return true;

  const stagedText = new Map<string, string>();
  const decoder = new TextDecoder();
  for (const file of [...cohort.files].sort((left, right) => left.priority - right.priority)) {
    let bytes = forceRefresh ? null : await cachedCohortBytes(file);
    if (!bytes) {
      const { response } = await fetchResponseNetwork(file.contentPath, manifest.mirrors ?? []);
      bytes = await response.arrayBuffer();
      await verifyCohortBytes(file, bytes);
      await storeCohortBytes(file, bytes);
    }
    if (!("caches" in window)) {
      stagedText.set(normalizePath(file.path), decoder.decode(bytes));
    }
  }

  const pointer: ActiveCohortPointer = {
    revision: cohort.revision,
    files: Object.fromEntries(
      cohort.files.map((file) => [
        normalizePath(file.path),
        { contentPath: normalizePath(file.contentPath), hash: file.hash, size: file.size },
      ])
    ),
  };
  if (!("caches" in window)) runtimeText.set(name, stagedText);
  persistActivePointer(name, pointer);
  return true;
}

async function ensureCohort(
  manifest: Manifest,
  name: string,
  cohort: ManifestCohort,
  forceRefresh = false
): Promise<boolean> {
  const existing = cohortPromises.get(name);
  if (existing && !forceRefresh) return existing;

  const promise = stageCohort(manifest, name, cohort, forceRefresh);
  cohortPromises.set(name, promise);
  try {
    return await promise;
  } finally {
    if (cohortPromises.get(name) === promise) cohortPromises.delete(name);
  }
}

async function refreshTextAsset(path: string): Promise<string> {
  const normalized = normalizePath(path);
  const [text, manifest] = await Promise.all([fetchTextNetwork(normalized), loadManifest()]);
  const nextHash = manifest?.files?.[normalized]?.hash ?? null;
  persistTextAsset(normalized, text, nextHash);
  return text;
}

export async function loadManifest(): Promise<Manifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const { response } = await fetchResponseNetwork(MANIFEST_PATH, [
          ...STATIC_DATA_ORIGINS,
        ]);
        return (await response.json()) as Manifest;
      } catch {
        return null;
      }
    })();
  }
  const manifest = await manifestPromise;
  if (!manifest) manifestPromise = null;
  return manifest;
}

export async function fetchPinballText(path: string): Promise<string> {
  const normalized = normalizePath(path);
  const manifest = await loadManifest();
  const cohortMatch = manifest ? textCohortForPath(manifest, normalized) : null;
  if (manifest && cohortMatch) {
    try {
      await ensureCohort(manifest, cohortMatch.name, cohortMatch.cohort);
    } catch (error) {
      const lastKnownGood = await readActiveCohortText(cohortMatch.name, normalized);
      if (lastKnownGood != null) return lastKnownGood;
      throw error;
    }
    const active = await readActiveCohortText(cohortMatch.name, normalized);
    if (active != null) return active;
    throw new Error(`Atomic cohort ${cohortMatch.name} activated without ${normalized}`);
  }

  const cacheKey = storageKey("text", normalized);
  const cached = parseJson<{ hash: string | null; text: string }>(localStorage.getItem(cacheKey));
  const nextHash = manifest?.files?.[normalized]?.hash ?? null;
  if (cached && nextHash && cached.hash === nextHash) return cached.text;

  try {
    const text = await fetchTextNetwork(normalized);
    persistTextAsset(normalized, text, nextHash);
    return text;
  } catch (error) {
    const cachedAssetText = await readTextAssetCache(normalized);
    if (cachedAssetText) return cachedAssetText;
    if (cached?.text) return cached.text;
    throw error;
  }
}

export async function fetchPinballJson<T>(path: string): Promise<T> {
  const normalized = normalizePath(path);
  const text = await fetchPinballText(normalized);
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const manifest = await loadManifest();
    if (manifest && textCohortForPath(manifest, normalized)) {
      throw new Error(`Invalid JSON in verified atomic cohort for ${normalized}`, { cause: error });
    }
    console.warn(`Invalid cached pinball JSON for ${normalized}; retrying from network.`, error);
    await resetTextAssetState(normalized);
    manifestPromise = null;
    const refreshedText = await refreshTextAsset(normalized);
    try {
      return JSON.parse(refreshedText) as T;
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError ?? "unknown");
      throw new Error(`Invalid JSON returned for ${normalized}: ${message}`);
    }
  }
}

export async function prefetchPinballTextAssets(pathPrefixes: string[] = []): Promise<void> {
  const manifest = await loadManifest();
  if (!manifest) return;

  const normalizePrefix = (p: string) => (p.endsWith("/") ? p : `${p}/`);
  const normalizedPrefixes = pathPrefixes.map(normalizePrefix);
  const isRequested = (path: string) =>
    normalizedPrefixes.length === 0 || normalizedPrefixes.some((prefix) => path.startsWith(prefix));

  const cohortPaths = new Set<string>();
  for (const name of TEXT_COHORT_NAMES) {
    const cohort = validatedCohort(manifest, name);
    if (!cohort) continue;
    for (const file of cohort.files) cohortPaths.add(normalizePath(file.path));
    if (cohort.files.some((file) => isRequested(normalizePath(file.path)))) {
      await ensureCohort(manifest, name, cohort).catch(() => false);
    }
  }

  if (!("caches" in window)) return;
  const hashStateKey = textHashStateKey();
  const previous = parseJson<Record<string, string>>(localStorage.getItem(hashStateKey)) ?? {};
  const next: Record<string, string> = {};
  const cache = await caches.open(ASSET_CACHE);
  const writes: Promise<void>[] = [];

  for (const [path, entry] of Object.entries(manifest.files)) {
    const isDefaultTextAsset =
      path.includes("/pinball/data/") ||
      path.includes("/pinball/rulesheets/") ||
      path.includes("/pinball/gameinfo/");
    if (!isDefaultTextAsset || !isRequested(path) || cohortPaths.has(path)) continue;

    next[path] = entry.hash;
    if (previous[path] === entry.hash) continue;
    writes.push(
      fetchResponseNetwork(path)
        .then(({ response, resolvedPath }) => cache.put(resolvedPath, response.clone()))
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
  const request = isSameOrigin ? new Request(url) : new Request(url, { mode: "no-cors" });

  try {
    const cache = await caches.open(cacheName);
    const existing = await cache.match(request);
    if (existing) return;
    const response = await fetch(request);
    await cache.put(request, response.clone());
  } catch {
    // Best-effort cache warmup only.
  }
}
