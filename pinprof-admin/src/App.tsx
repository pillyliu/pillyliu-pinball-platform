import { FormEvent, startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

type SessionPayload = {
  authenticated: boolean;
  passwordConfigured: boolean;
};

type SummaryPayload = {
  totalMachines: number;
  totalOpdbRows?: number;
  overriddenMachines: number;
  playfieldOverrides: number;
  rulesheetOverrides: number;
  adminDbPath: string;
  seedDbPath: string;
};

type FilterPayload = {
  manufacturers: string[];
};

type WorkspaceNotePayload = {
  notes: string;
  updatedAt: string | null;
};

type GlobalActivityEntry = {
  activityId: number;
  practiceIdentity: string;
  machineTitle: string;
  actionType: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  createdAt: string;
};

type ActivityResponse = {
  items: GlobalActivityEntry[];
};

type MachineListItem = {
  practiceIdentity: string;
  opdbMachineId: string | null;
  slug: string;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  playfieldImageUrl: string | null;
  primaryImageUrl: string | null;
  playfieldLocalPath: string | null;
  rulesheetLocalPath: string | null;
  gameinfoLocalPath: string | null;
  hasAdminOverride: boolean;
};

type MachineOverride = {
  nameOverride: string;
  variantOverride: string;
  manufacturerOverride: string;
  yearOverride: string;
  backglassLocalPath: string | null;
  backglassSourceUrl: string;
  backglassSourceNote: string;
  playfieldAliasId: string;
  playfieldLocalPath: string | null;
  playfieldSourceUrl: string;
  playfieldSourceNote: string;
  rulesheetLocalPath: string | null;
  rulesheetSourceUrl: string;
  rulesheetSourceNote: string;
  gameinfoLocalPath: string | null;
  notes: string;
  updatedAt: string | null;
};

type MachineDetail = {
  machine: {
    practiceIdentity: string;
    opdbMachineId: string | null;
    opdbGroupId: string | null;
    slug: string;
    name: string;
    variant: string | null;
    manufacturer: string | null;
    year: number | null;
    playfieldImageUrl: string | null;
    primaryImageUrl: string | null;
    playfieldLocalPath: string | null;
    rulesheetLocalPath: string | null;
  };
  sources: {
    builtIn: {
      sourceId: string | null;
      sourceName: string | null;
      sourceType: string | null;
    };
    aliases: Array<{
      opdbMachineId: string;
      slug: string;
      variant: string | null;
      primaryImageUrl: string | null;
      playfieldImageUrl: string | null;
      updatedAt: string | null;
    }>;
    playfieldAssets: Array<{
      playfieldAssetId: number;
      sourceAliasId: string;
      sourceAliasLabel: string;
      localPath: string | null;
      sourceUrl: string | null;
      sourceNote: string | null;
      updatedAt: string | null;
    }>;
    assets: {
      backglass: {
        effectiveKind: "opdb" | "pillyliu" | "external" | "missing";
        effectiveLabel: string;
        effectiveUrl: string | null;
        localPath?: string | null;
        localSourceUrl?: string | null;
        localSourceNote?: string | null;
        fallbackOpdbUrl: string | null;
      };
      playfield: {
        effectiveKind: "opdb" | "pillyliu" | "external" | "missing";
        effectiveLabel: string;
        effectiveUrl: string | null;
        targetAliasId: string;
        targetAliasLabel: string;
        targetFilename: string;
        localPath: string | null;
        localSourceUrl: string | null;
        localSourceNote: string | null;
        fallbackOpdbUrl: string | null;
      };
      rulesheet: {
        effectiveKind: "opdb" | "pillyliu" | "external" | "missing";
        effectiveLabel: string;
        effectiveUrl: string | null;
        localPath: string | null;
        sourceUrl: string | null;
        sourceNote: string | null;
      };
      gameinfo: {
        effectiveKind: "opdb" | "pillyliu" | "external" | "missing";
        effectiveLabel: string;
        effectiveUrl: string | null;
        localPath: string | null;
      };
    };
  };
  playfieldTarget?: {
    aliasId: string;
    aliasLabel: string;
    filenameBase: string;
  };
  override: MachineOverride;
  rulesheetContent: string;
  gameinfoContent: string;
};

type MachinesResponse = {
  items: MachineListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type SaveOverridePayload = {
  nameOverride: string;
  variantOverride: string;
  manufacturerOverride: string;
  yearOverride: string;
  backglassSourceUrl: string;
  backglassSourceNote: string;
  playfieldAliasId: string;
  playfieldSourceUrl: string;
  playfieldSourceNote: string;
  rulesheetSourceUrl: string;
  rulesheetSourceNote: string;
  notes: string;
};

type Toast = {
  tone: "ok" | "error";
  message: string;
};

const PAGE_SIZE = 40;

const emptyOverridePayload = (): SaveOverridePayload => ({
  nameOverride: "",
  variantOverride: "",
  manufacturerOverride: "",
  yearOverride: "",
  backglassSourceUrl: "",
  backglassSourceNote: "",
  playfieldAliasId: "",
  playfieldSourceUrl: "",
  playfieldSourceNote: "",
  rulesheetSourceUrl: "",
  rulesheetSourceNote: "",
  notes: "",
});

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
}

function displayTitle(item: MachineListItem | MachineDetail["machine"]) {
  return [item.name, item.variant].filter(Boolean).join(" • ");
}

function aliasTitle(alias: MachineDetail["sources"]["aliases"][number], fallbackName: string) {
  return [alias.variant || fallbackName, alias.opdbMachineId].filter(Boolean).join(" · ");
}

function displayImage(detail: MachineDetail | null): string | null {
  if (!detail) return null;
  return detail.sources.assets.playfield.effectiveUrl ?? detail.machine.playfieldImageUrl ?? detail.machine.primaryImageUrl;
}

function buildWebUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return path;
}

function assetKindClass(kind: "opdb" | "pillyliu" | "external" | "missing") {
  if (kind === "pillyliu") return "tag accent";
  if (kind === "opdb") return "tag";
  if (kind === "external") return "tag info";
  return "tag muted-tag";
}

export default function App() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [filters, setFilters] = useState<FilterPayload>({ manufacturers: [] });
  const [workspaceNotes, setWorkspaceNotes] = useState("");
  const [workspaceNotesUpdatedAt, setWorkspaceNotesUpdatedAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<GlobalActivityEntry[]>([]);
  const [machines, setMachines] = useState<MachineListItem[]>([]);
  const [totalMachines, setTotalMachines] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [detail, setDetail] = useState<MachineDetail | null>(null);
  const [overrideForm, setOverrideForm] = useState<SaveOverridePayload>(emptyOverridePayload);
  const [rulesheetMarkdown, setRulesheetMarkdown] = useState("");
  const [password, setPassword] = useState("");
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const selectedMachine = useMemo(() => machines.find((item) => item.practiceIdentity === selectedIdentity) ?? null, [machines, selectedIdentity]);
  const selectedPlayfieldAlias = useMemo(
    () => detail?.sources.aliases.find((alias) => alias.opdbMachineId === overrideForm.playfieldAliasId) ?? detail?.sources.aliases[0] ?? null,
    [detail, overrideForm.playfieldAliasId],
  );
  const selectedPlayfieldAsset = useMemo(
    () => detail?.sources.playfieldAssets.find((asset) => asset.sourceAliasId === overrideForm.playfieldAliasId) ?? null,
    [detail, overrideForm.playfieldAliasId],
  );
  const pageCount = Math.max(1, Math.ceil(totalMachines / PAGE_SIZE));

  useEffect(() => {
    apiFetch<SessionPayload>("api/session")
      .then(setSession)
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }));
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    apiFetch<SummaryPayload>("api/summary")
      .then(setSummary)
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }));
  }, [session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;
    apiFetch<FilterPayload>("api/filters")
      .then(setFilters)
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }));
  }, [session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;
    apiFetch<WorkspaceNotePayload>("api/workspace/import-notes")
      .then((payload) => {
        setWorkspaceNotes(payload.notes);
        setWorkspaceNotesUpdatedAt(payload.updatedAt);
      })
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }));
  }, [session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;
    apiFetch<ActivityResponse>("api/activity?limit=40")
      .then((payload) => setActivity(payload.items))
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }));
  }, [session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;

    setLoadingMachines(true);
    const params = new URLSearchParams({
      query: deferredSearch,
      manufacturer: manufacturerFilter,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    apiFetch<MachinesResponse>(`api/machines?${params.toString()}`)
      .then((payload) => {
        setMachines(payload.items);
        setTotalMachines(payload.total);
        if (!selectedIdentity && payload.items[0]) {
          startTransition(() => setSelectedIdentity(payload.items[0].practiceIdentity));
        }
        if (selectedIdentity && !payload.items.some((item) => item.practiceIdentity === selectedIdentity) && payload.items[0]) {
          startTransition(() => setSelectedIdentity(payload.items[0].practiceIdentity));
        }
      })
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }))
      .finally(() => setLoadingMachines(false));
  }, [deferredSearch, manufacturerFilter, page, selectedIdentity, session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated || !selectedIdentity) return;
    setLoadingDetail(true);
    apiFetch<MachineDetail>(`api/machines/${selectedIdentity}`)
      .then((payload) => {
        setDetail(payload);
        setOverrideForm({
          nameOverride: payload.override.nameOverride,
          variantOverride: payload.override.variantOverride,
          manufacturerOverride: payload.override.manufacturerOverride,
          yearOverride: payload.override.yearOverride,
          backglassSourceUrl: payload.override.backglassSourceUrl,
          backglassSourceNote: payload.override.backglassSourceNote,
          playfieldAliasId: payload.override.playfieldAliasId,
          playfieldSourceUrl: payload.override.playfieldSourceUrl,
          playfieldSourceNote: payload.override.playfieldSourceNote,
          rulesheetSourceUrl: payload.override.rulesheetSourceUrl,
          rulesheetSourceNote: payload.override.rulesheetSourceNote,
          notes: payload.override.notes,
        });
        setRulesheetMarkdown(payload.rulesheetContent);
      })
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }))
      .finally(() => setLoadingDetail(false));
  }, [selectedIdentity, session?.authenticated]);

  function refreshSummary() {
    return apiFetch<SummaryPayload>("api/summary").then(setSummary);
  }

  function refreshActivity() {
    return apiFetch<ActivityResponse>("api/activity?limit=40").then((payload) => setActivity(payload.items));
  }

  function refreshMachines() {
    const params = new URLSearchParams({
      query: deferredSearch,
      manufacturer: manufacturerFilter,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    return apiFetch<MachinesResponse>(`api/machines?${params.toString()}`).then((payload) => {
      setMachines(payload.items);
      setTotalMachines(payload.total);
    });
  }

  function machineAssetIndicators(item: MachineListItem) {
    return [
      item.playfieldLocalPath ? { label: "PF", tone: "accent" as const } : null,
      item.rulesheetLocalPath ? { label: "RS", tone: "info" as const } : null,
      item.gameinfoLocalPath ? { label: "GI", tone: "tag" as const } : null,
    ].filter((value): value is { label: string; tone: "accent" | "info" | "tag" } => Boolean(value));
  }

  function refreshDetail() {
    if (!selectedIdentity) return Promise.resolve();
    return apiFetch<MachineDetail>(`api/machines/${selectedIdentity}`).then((payload) => {
      setDetail(payload);
      setRulesheetMarkdown(payload.rulesheetContent);
      setOverrideForm({
        nameOverride: payload.override.nameOverride,
        variantOverride: payload.override.variantOverride,
        manufacturerOverride: payload.override.manufacturerOverride,
        yearOverride: payload.override.yearOverride,
        backglassSourceUrl: payload.override.backglassSourceUrl,
        backglassSourceNote: payload.override.backglassSourceNote,
        playfieldAliasId: payload.override.playfieldAliasId,
        playfieldSourceUrl: payload.override.playfieldSourceUrl,
        playfieldSourceNote: payload.override.playfieldSourceNote,
        rulesheetSourceUrl: payload.override.rulesheetSourceUrl,
        rulesheetSourceNote: payload.override.rulesheetSourceNote,
        notes: payload.override.notes,
      });
    });
  }

  async function runAction<T>(label: string, action: () => Promise<T>, successMessage: string) {
    setBusyAction(label);
    setToast(null);
    try {
      const result = await action();
      await Promise.all([refreshSummary(), refreshMachines(), refreshDetail(), refreshActivity()]);
      setToast({ tone: "ok", message: successMessage });
      return result;
    } catch (error) {
      setToast({ tone: "error", message: extractMessage(error) });
      throw error;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusyAction("login");
    setToast(null);
    try {
      const nextSession = await apiFetch<SessionPayload>("api/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setSession(nextSession);
      setPassword("");
      setToast({ tone: "ok", message: "Signed in." });
    } catch (error) {
      setToast({ tone: "error", message: extractMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLogout() {
    await runAction(
      "logout",
      async () => {
        await apiFetch("api/logout", { method: "POST" });
        setSession({ authenticated: false, passwordConfigured: true });
        setSummary(null);
        setMachines([]);
        setDetail(null);
        setSelectedIdentity(null);
      },
      "Signed out.",
    ).catch(() => undefined);
  }

  async function handleSaveMetadata() {
    if (!selectedIdentity) return;
    await runAction(
      "save-metadata",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/override`, {
          method: "PUT",
          body: JSON.stringify(overrideForm),
        }),
      "Override metadata saved.",
    );
  }

  async function handleSaveWorkspaceNotes() {
    await runAction(
      "save-workspace-notes",
      async () => {
        await apiFetch("api/workspace/import-notes", {
          method: "PUT",
          body: JSON.stringify({ notes: workspaceNotes }),
        });
        const payload = await apiFetch<WorkspaceNotePayload>("api/workspace/import-notes");
        setWorkspaceNotes(payload.notes);
        setWorkspaceNotesUpdatedAt(payload.updatedAt);
      },
      "Import notebook saved.",
    );
  }

  function loadPlayfieldForm(aliasId: string) {
    setOverrideForm((current) => {
      const asset = detail?.sources.playfieldAssets.find((item) => item.sourceAliasId === aliasId) ?? null;
      return {
        ...current,
        playfieldAliasId: aliasId,
        playfieldSourceUrl: asset?.sourceUrl ?? "",
        playfieldSourceNote: asset?.sourceNote ?? "",
      };
    });
  }

  async function handleBindPlayfieldSource() {
    if (!selectedIdentity || !overrideForm.playfieldAliasId) return;
    await runAction(
      "bind-playfield-source",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/playfield/coverage`, {
          method: "PUT",
          body: JSON.stringify({
            machineAliasId: overrideForm.playfieldAliasId,
            sourceUrl: overrideForm.playfieldSourceUrl,
            sourceNote: overrideForm.playfieldSourceNote,
          }),
        }),
      "Playfield source alias saved.",
    );
  }

  async function handleImportBackglassUrl() {
    if (!selectedIdentity || !overrideForm.backglassSourceUrl.trim()) return;
    await runAction(
      "import-backglass-url",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/backglass/import-url`, {
          method: "POST",
          body: JSON.stringify({
            sourceUrl: overrideForm.backglassSourceUrl.trim(),
            sourceNote: overrideForm.backglassSourceNote,
          }),
        }),
      "Backglass imported from remote URL.",
    );
  }

  async function handleUploadBackglass(file: File | null) {
    if (!selectedIdentity || !file) return;
    await runAction(
      "upload-backglass",
      async () => {
        const body = new FormData();
        body.append("image", file);
        body.append("sourceUrl", overrideForm.backglassSourceUrl);
        body.append("sourceNote", overrideForm.backglassSourceNote || file.name);
        const response = await fetch(`api/machines/${selectedIdentity}/backglass/upload`, {
          method: "POST",
          body,
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error((await response.text()) || "Upload failed");
        }
      },
      "Backglass uploaded.",
    );
  }

  async function handleSaveRulesheet() {
    if (!selectedIdentity) return;
    await runAction(
      "save-rulesheet",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/rulesheet/save`, {
          method: "POST",
          body: JSON.stringify({
            markdown: rulesheetMarkdown,
            sourceUrl: overrideForm.rulesheetSourceUrl,
            sourceNote: overrideForm.rulesheetSourceNote,
          }),
        }),
      "Rulesheet markdown saved.",
    );
  }

  async function handleUploadRulesheet(file: File | null) {
    if (!selectedIdentity || !file) return;
    await runAction(
      "upload-rulesheet",
      async () => {
        const body = new FormData();
        body.append("rulesheet", file);
        body.append("sourceUrl", overrideForm.rulesheetSourceUrl);
        body.append("sourceNote", overrideForm.rulesheetSourceNote || file.name);
        const response = await fetch(`api/machines/${selectedIdentity}/rulesheet/upload`, {
          method: "POST",
          body,
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error((await response.text()) || "Upload failed");
        }
      },
      "Rulesheet uploaded from file.",
    );
  }

  async function handleImportPlayfieldUrl() {
    if (!selectedIdentity || !overrideForm.playfieldSourceUrl.trim()) return;
    await runAction(
      "import-playfield-url",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/playfield/import-url`, {
          method: "POST",
          body: JSON.stringify({
            machineAliasId: overrideForm.playfieldAliasId,
            sourceUrl: overrideForm.playfieldSourceUrl.trim(),
            sourceNote: overrideForm.playfieldSourceNote,
          }),
        }),
      "Playfield imported from remote URL.",
    );
  }

  async function handleUploadPlayfield(file: File | null) {
    if (!selectedIdentity || !file) return;
    await runAction(
      "upload-playfield",
      async () => {
        const body = new FormData();
        body.append("image", file);
        body.append("machineAliasId", overrideForm.playfieldAliasId);
        body.append("sourceUrl", overrideForm.playfieldSourceUrl);
        body.append("sourceNote", overrideForm.playfieldSourceNote || file.name);
        const response = await fetch(`api/machines/${selectedIdentity}/playfield/upload`, {
          method: "POST",
          body,
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error((await response.text()) || "Upload failed");
        }
      },
      "Playfield uploaded and processed.",
    );
  }

  if (!session) {
    return <div className="app-shell centered-panel">Loading session…</div>;
  }

  if (!session.authenticated) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <p className="eyebrow">PinProf Admin</p>
          <h1>Manage OPDB machine overrides</h1>
          <p className="muted">
            Search the OPDB-backed catalog, see which assets come from OPDB versus your own overrides, and replace
            playfields, backglasses, and rulesheets when you find something better.
          </p>
          {!session.passwordConfigured && (
            <div className="warning-card">
              <strong>Set your production password hash/config before exposing this on pillyliu.com.</strong>
            </div>
          )}
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit" disabled={busyAction === "login" || !password}>
              {busyAction === "login" ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PinProf Admin</p>
          <h1>OPDB catalog + override workspace</h1>
        </div>
        <div className="topbar-actions">
          {summary && (
            <div className="summary-grid">
              <div>
                <span>{summary.totalMachines}</span>
                <small>practice IDs</small>
              </div>
              <div>
                <span>{summary.overriddenMachines}</span>
                <small>overrides</small>
              </div>
              <div>
                <span>{summary.playfieldOverrides}</span>
                <small>playfields</small>
              </div>
              <div>
                <span>{summary.rulesheetOverrides}</span>
                <small>rulesheets</small>
              </div>
            </div>
          )}
          <button className="secondary-button" onClick={handleLogout} disabled={busyAction === "logout"}>
            Sign out
          </button>
        </div>
      </header>

      {toast && <div className={`toast inline-toast ${toast.tone}`}>{toast.message}</div>}

      <main className="workspace">
        <aside className="sidebar">
          <div className="panel-header">
            <div>
              <h2>Catalog</h2>
              <p className="muted">
                Source: OPDB snapshot + generated seed DB
                {summary?.totalOpdbRows ? ` • ${summary.totalOpdbRows} raw OPDB rows` : ""}
              </p>
            </div>
            <span className="pill">{totalMachines} found</span>
          </div>
          <section className="sidebar-block">
            <div className="panel-header slim">
              <div>
                <h2>Import notebook</h2>
                <p className="muted">Global scratchpad for the whole import pass.</p>
              </div>
              <button
                className="secondary-button"
                onClick={handleSaveWorkspaceNotes}
                disabled={busyAction === "save-workspace-notes"}
              >
                {busyAction === "save-workspace-notes" ? "Saving…" : "Save notes"}
              </button>
            </div>
            <label className="field">
              Notes / to-do
              <textarea
                rows={7}
                value={workspaceNotes}
                onChange={(event) => setWorkspaceNotes(event.target.value)}
                placeholder={"- find better Godzilla Pro playfield\n- import modern Stern Premium/LE images\n- double-check JP 30th rulesheet"}
              />
            </label>
            <p className="timestamp">
              Last notebook save: {workspaceNotesUpdatedAt ? new Date(workspaceNotesUpdatedAt).toLocaleString() : "None yet"}
            </p>
          </section>
          <label className="field">
            Search machines
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="name, manufacturer, practice identity…"
            />
          </label>
          <label className="field">
            Manufacturer
            <select
              value={manufacturerFilter}
              onChange={(event) => {
                setManufacturerFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All manufacturers</option>
              {filters.manufacturers.map((manufacturer) => (
                <option key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </option>
              ))}
            </select>
          </label>
          <div className="machine-list">
            {loadingMachines ? (
              <p className="muted">Loading machines…</p>
            ) : (
              machines.map((item) => {
                const selected = item.practiceIdentity === selectedIdentity;
                return (
                  <button
                    key={item.practiceIdentity}
                    className={`machine-row ${selected ? "selected" : ""}`}
                    onClick={() => startTransition(() => setSelectedIdentity(item.practiceIdentity))}
                  >
                    <div className="machine-row-head">
                      <strong>{displayTitle(item)}</strong>
                      <span className="machine-row-year">{item.year ?? "—"}</span>
                    </div>
                    <span>{item.manufacturer || "Unknown manufacturer"}</span>
                    <code>{item.practiceIdentity}</code>
                    <div className="row-tags compact-tags">
                      {item.hasAdminOverride && <span className="tag accent">OVR</span>}
                      {machineAssetIndicators(item).length ? (
                        machineAssetIndicators(item).map((indicator) => (
                          <span
                            key={indicator.label}
                            className={indicator.tone === "accent" ? "tag accent" : indicator.tone === "info" ? "tag info" : "tag"}
                          >
                            {indicator.label}
                          </span>
                        ))
                      ) : (
                        <span className="tag muted-tag">OPDB</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <span>
              Page {page} / {pageCount}
            </span>
            <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              Next
            </button>
          </div>
          <section className="sidebar-block activity-block">
            <div className="panel-header slim">
              <div>
                <h2>Recent activity</h2>
                <p className="muted">Latest imports and saves across the whole workspace.</p>
              </div>
            </div>
            <div className="activity-list">
              {activity.length ? (
                activity.map((entry) => (
                  <article key={entry.activityId} className="activity-item">
                    <div className="activity-item-head">
                      <strong>{entry.summary}</strong>
                      <span className="tag">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button
                      className="activity-link"
                      onClick={() => startTransition(() => setSelectedIdentity(entry.practiceIdentity))}
                    >
                      {entry.machineTitle}
                    </button>
                    <code>{entry.practiceIdentity}</code>
                    {entry.details.length > 0 && (
                      <div className="activity-detail-list">
                        {entry.details.slice(0, 3).map((detail) => (
                          <div key={`${entry.activityId}-${detail.label}`}>
                            <small>{detail.label}</small>
                            <code>{detail.value}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <p className="muted">No activity yet.</p>
              )}
            </div>
          </section>
        </aside>

        <section className="editor">
          {!selectedIdentity && <div className="empty-state">Pick a machine to edit overrides.</div>}
          {selectedIdentity && loadingDetail && <div className="empty-state">Loading machine details…</div>}
          {detail && !loadingDetail && (
            <>
              <div className="editor-grid">
                <section className="panel hero-panel panel-span-full">
                  <div className="hero-copy">
                    <p className="eyebrow">Machine</p>
                    <h2>{displayTitle(detail.machine)}</h2>
                    <p className="muted">
                      {[detail.machine.manufacturer, detail.machine.year].filter(Boolean).join(" • ") || "Unknown maker"}
                    </p>
                    <div className="row-tags">
                      <span className={assetKindClass(detail.sources.assets.backglass.effectiveKind)}>
                        {detail.sources.assets.backglass.effectiveLabel}
                      </span>
                      <span className={assetKindClass(detail.sources.assets.playfield.effectiveKind)}>
                        {detail.sources.assets.playfield.effectiveLabel}
                      </span>
                      <span className={assetKindClass(detail.sources.assets.rulesheet.effectiveKind)}>
                        {detail.sources.assets.rulesheet.effectiveLabel}
                      </span>
                      <span className={assetKindClass(detail.sources.assets.gameinfo.effectiveKind)}>
                        {detail.sources.assets.gameinfo.effectiveLabel}
                      </span>
                    </div>
                    <div className="hero-meta">
                      <span>
                        <small>Practice ID</small>
                        <code>{detail.machine.practiceIdentity}</code>
                      </span>
                      <span>
                        <small>Slug</small>
                        <code>{detail.machine.slug || "—"}</code>
                      </span>
                      <span>
                        <small>Catalog Source</small>
                        <code>{detail.sources.builtIn.sourceName ?? "OPDB seed"}</code>
                      </span>
                      <span>
                        <small>OPDB Row</small>
                        <code>{detail.machine.opdbMachineId || "—"}</code>
                      </span>
                    </div>
                    <div className="path-list">
                      <div>
                        <small>Catalog Feed</small>
                        <code>{summary?.seedDbPath ?? "—"}</code>
                      </div>
                      <div>
                        <small>Override Store</small>
                        <code>{summary?.adminDbPath ?? "—"}</code>
                      </div>
                    </div>
                  </div>
                  <div className="hero-media-grid">
                    <div className="hero-image-frame">
                      {detail.sources.assets.backglass.effectiveUrl ? (
                        <img src={buildWebUrl(detail.sources.assets.backglass.effectiveUrl) ?? ""} alt={`${displayTitle(detail.machine)} backglass`} />
                      ) : (
                        <div className="image-fallback">No backglass image in OPDB</div>
                      )}
                      <div className="media-caption">
                        <strong>Backglass</strong>
                        <span>{detail.sources.assets.backglass.effectiveLabel}</span>
                      </div>
                    </div>
                    <div className="hero-image-frame">
                      {displayImage(detail) ? (
                        <img src={buildWebUrl(displayImage(detail)) ?? ""} alt={`${displayTitle(detail.machine)} playfield`} />
                      ) : (
                        <div className="image-fallback">No playfield image available</div>
                      )}
                      <div className="media-caption">
                        <strong>Playfield</strong>
                        <span>{detail.sources.assets.playfield.effectiveLabel}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Current asset stack</h2>
                      <p className="muted">See exactly what the web/app would use right now, and where it came from.</p>
                    </div>
                    <span className="pill">{detail.sources.aliases.length} OPDB aliases</span>
                  </div>
                  <div className="asset-grid">
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Backglass</h3>
                        <span className={assetKindClass(detail.sources.assets.backglass.effectiveKind)}>
                          {detail.sources.assets.backglass.effectiveKind}
                        </span>
                      </div>
                      <p className="muted">{detail.sources.assets.backglass.effectiveLabel}</p>
                      <code>{detail.sources.assets.backglass.effectiveUrl ?? "No image"}</code>
                      {detail.sources.assets.backglass.localSourceUrl && (
                        <a href={detail.sources.assets.backglass.localSourceUrl} target="_blank" rel="noreferrer">
                          Source link
                        </a>
                      )}
                      {detail.sources.assets.backglass.localSourceNote && <code>{detail.sources.assets.backglass.localSourceNote}</code>}
                    </article>
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Playfield</h3>
                        <span className={assetKindClass(detail.sources.assets.playfield.effectiveKind)}>
                          {detail.sources.assets.playfield.effectiveKind}
                        </span>
                      </div>
                      <p className="muted">{detail.sources.assets.playfield.effectiveLabel}</p>
                      <code>{detail.sources.assets.playfield.effectiveUrl ?? "No image"}</code>
                      {detail.sources.assets.playfield.localSourceUrl && (
                        <a href={detail.sources.assets.playfield.localSourceUrl} target="_blank" rel="noreferrer">
                          Source link
                        </a>
                      )}
                      {detail.sources.assets.playfield.localSourceNote && <code>{detail.sources.assets.playfield.localSourceNote}</code>}
                    </article>
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Rulesheet</h3>
                        <span className={assetKindClass(detail.sources.assets.rulesheet.effectiveKind)}>
                          {detail.sources.assets.rulesheet.effectiveKind}
                        </span>
                      </div>
                      <p className="muted">{detail.sources.assets.rulesheet.effectiveLabel}</p>
                      <code>{detail.sources.assets.rulesheet.effectiveUrl ?? "No rulesheet"}</code>
                      {detail.sources.assets.rulesheet.sourceUrl && (
                        <a href={detail.sources.assets.rulesheet.sourceUrl} target="_blank" rel="noreferrer">
                          Source link
                        </a>
                      )}
                      {detail.sources.assets.rulesheet.sourceNote && <code>{detail.sources.assets.rulesheet.sourceNote}</code>}
                    </article>
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Game Info</h3>
                        <span className={assetKindClass(detail.sources.assets.gameinfo.effectiveKind)}>
                          {detail.sources.assets.gameinfo.effectiveKind}
                        </span>
                      </div>
                      <p className="muted">{detail.sources.assets.gameinfo.effectiveLabel}</p>
                      <code>{detail.sources.assets.gameinfo.effectiveUrl ?? "No game info"}</code>
                    </article>
                  </div>
                </section>

                <section className="panel compact-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Replace backglass image</h2>
                      <p className="muted">Shows whether you are still on OPDB art or have your own better file layered on top.</p>
                    </div>
                    <button onClick={handleImportBackglassUrl} disabled={busyAction === "import-backglass-url"}>
                      {busyAction === "import-backglass-url" ? "Importing…" : "Import from URL"}
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field wide">
                      Remote backglass URL
                      <input
                        value={overrideForm.backglassSourceUrl}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, backglassSourceUrl: event.target.value }))}
                        placeholder="https://img.opdb.org/... or better source"
                      />
                    </label>
                    <label className="field">
                      Source note
                      <input
                        value={overrideForm.backglassSourceNote}
                        onChange={(event) =>
                          setOverrideForm((current) => ({ ...current, backglassSourceNote: event.target.value }))
                        }
                        placeholder="OPDB alt / flyer scan / your source"
                      />
                    </label>
                  </div>
                  <label className="field upload-field">
                    Upload backglass from browser
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleUploadBackglass(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="path-list">
                    <div>
                      <small>Override image path</small>
                      <code>{detail.override.backglassLocalPath ?? detail.sources.assets.backglass.localPath ?? "None"}</code>
                    </div>
                    {detail.override.backglassSourceUrl && (
                      <div>
                        <small>Source URL</small>
                        <a href={detail.override.backglassSourceUrl} target="_blank" rel="noreferrer">
                          {detail.override.backglassSourceUrl}
                        </a>
                      </div>
                    )}
                    {detail.override.backglassSourceNote && (
                      <div>
                        <small>Source note</small>
                        <code>{detail.override.backglassSourceNote}</code>
                      </div>
                    )}
                  </div>
                </section>

                <section className="panel compact-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Metadata overrides</h2>
                      <p className="muted">These fields reapply into the generated seed DB after every sync.</p>
                    </div>
                    <button onClick={handleSaveMetadata} disabled={busyAction === "save-metadata"}>
                      {busyAction === "save-metadata" ? "Saving…" : "Save metadata"}
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      Name override
                      <input
                        value={overrideForm.nameOverride}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, nameOverride: event.target.value }))}
                      />
                    </label>
                    <label className="field">
                      Variant override
                      <input
                        value={overrideForm.variantOverride}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, variantOverride: event.target.value }))}
                      />
                    </label>
                    <label className="field">
                      Manufacturer override
                      <input
                        value={overrideForm.manufacturerOverride}
                        onChange={(event) =>
                          setOverrideForm((current) => ({ ...current, manufacturerOverride: event.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      Year override
                      <input
                        value={overrideForm.yearOverride}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, yearOverride: event.target.value }))}
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <label className="field">
                    Machine notes
                    <textarea
                      rows={3}
                      value={overrideForm.notes}
                      onChange={(event) => setOverrideForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                  <p className="timestamp">
                    Last override update: {detail.override.updatedAt ? new Date(detail.override.updatedAt).toLocaleString() : "None yet"}
                  </p>
                </section>

                <section className="panel compact-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Replace playfield image</h2>
                      <p className="muted">Pick the OPDB alias this file came from. The app resolves automatically by alias, then machine, then group, so one better local file can replace OPDB across the family until a more specific one exists.</p>
                    </div>
                    <div className="topbar-actions">
                      <button onClick={handleBindPlayfieldSource} disabled={busyAction === "bind-playfield-source"}>
                        {busyAction === "bind-playfield-source" ? "Saving…" : "Bind existing local file"}
                      </button>
                      <button onClick={handleImportPlayfieldUrl} disabled={busyAction === "import-playfield-url"}>
                        {busyAction === "import-playfield-url" ? "Importing…" : "Import from URL"}
                      </button>
                    </div>
                  </div>
                  {detail.sources.playfieldAssets.length > 0 && (
                    <div className="asset-grid">
                      {detail.sources.playfieldAssets.map((asset) => (
                        <article key={asset.playfieldAssetId} className="asset-card">
                          <div className="asset-card-head">
                            <h3>{asset.sourceAliasLabel}</h3>
                            <span className="tag accent">local source</span>
                          </div>
                          <p className="muted">Used automatically for exact alias matches first, then sibling machine/group fallbacks.</p>
                          <div className="path-list">
                            <div>
                              <small>Local file</small>
                              <code>{asset.localPath ?? "None"}</code>
                            </div>
                            {asset.sourceUrl && (
                              <div>
                                <small>Source URL</small>
                                <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
                                  {asset.sourceUrl}
                                </a>
                              </div>
                            )}
                          </div>
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setOverrideForm((current) => ({
                                ...current,
                                playfieldAliasId: asset.sourceAliasId,
                                playfieldSourceUrl: asset.sourceUrl ?? "",
                                playfieldSourceNote: asset.sourceNote ?? "",
                              }));
                            }}
                          >
                            Edit this asset
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="form-grid">
                    <label className="field">
                      Source OPDB alias
                      <select
                        value={overrideForm.playfieldAliasId}
                        onChange={(event) => loadPlayfieldForm(event.target.value)}
                      >
                        {detail.sources.aliases.map((alias) => (
                          <option key={alias.opdbMachineId} value={alias.opdbMachineId}>
                            {aliasTitle(alias, detail.machine.name)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Saved filename
                      <code>{selectedPlayfieldAlias ? `${selectedPlayfieldAlias.opdbMachineId}-playfield` : detail.sources.assets.playfield.targetFilename}</code>
                    </label>
                    <label className="field wide">
                      Remote source URL
                      <input
                        value={overrideForm.playfieldSourceUrl}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, playfieldSourceUrl: event.target.value }))}
                        placeholder="https://o.pinside.com/...jpeg"
                      />
                    </label>
                    <label className="field wide">
                      Source note
                      <input
                        value={overrideForm.playfieldSourceNote}
                        onChange={(event) =>
                          setOverrideForm((current) => ({ ...current, playfieldSourceNote: event.target.value }))
                        }
                        placeholder="Pinside / local filename / comment"
                      />
                    </label>
                  </div>
                  <label className="field upload-field">
                    Upload image from browser
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleUploadPlayfield(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="path-list">
                    <div>
                      <small>Source alias</small>
                      <code>{selectedPlayfieldAlias ? aliasTitle(selectedPlayfieldAlias, detail.machine.name) : detail.sources.assets.playfield.targetAliasLabel}</code>
                    </div>
                    <div>
                      <small>Saved file path</small>
                      <code>{selectedPlayfieldAsset?.localPath ?? detail.override.playfieldLocalPath ?? detail.machine.playfieldLocalPath ?? "None"}</code>
                    </div>
                    <div>
                      <small>Resolution</small>
                      <code>exact alias -&gt; same machine -&gt; same group -&gt; OPDB</code>
                    </div>
                    {(selectedPlayfieldAsset?.sourceUrl ?? detail.override.playfieldSourceUrl) && (
                      <div>
                        <small>Source URL</small>
                        <a href={selectedPlayfieldAsset?.sourceUrl ?? detail.override.playfieldSourceUrl} target="_blank" rel="noreferrer">
                          {selectedPlayfieldAsset?.sourceUrl ?? detail.override.playfieldSourceUrl}
                        </a>
                      </div>
                    )}
                    {(selectedPlayfieldAsset?.sourceNote ?? detail.override.playfieldSourceNote) && (
                      <div>
                        <small>Source note</small>
                        <code>{selectedPlayfieldAsset?.sourceNote ?? detail.override.playfieldSourceNote}</code>
                      </div>
                    )}
                  </div>
                </section>

                <section className="panel panel-span-full rulesheet-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Replace rulesheet</h2>
                      <p className="muted">Paste better markdown or import a local `.md` file to override what the library currently uses.</p>
                    </div>
                    <button onClick={handleSaveRulesheet} disabled={busyAction === "save-rulesheet"}>
                      {busyAction === "save-rulesheet" ? "Saving…" : "Save markdown"}
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field wide">
                      Rulesheet source URL
                      <input
                        value={overrideForm.rulesheetSourceUrl}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, rulesheetSourceUrl: event.target.value }))}
                        placeholder="https://pinside.com/... or https://tiltforums.com/..."
                      />
                    </label>
                    <label className="field wide">
                      Source note
                      <input
                        value={overrideForm.rulesheetSourceNote}
                        onChange={(event) =>
                          setOverrideForm((current) => ({ ...current, rulesheetSourceNote: event.target.value }))
                        }
                        placeholder="supplemental md / copied from local notes"
                      />
                    </label>
                  </div>
                  <label className="field upload-field">
                    Upload markdown file from browser
                    <input
                      type="file"
                      accept=".md,.markdown,.txt,text/markdown,text/plain"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleUploadRulesheet(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <label className="field">
                    Markdown
                    <textarea
                      rows={16}
                      value={rulesheetMarkdown}
                      onChange={(event) => setRulesheetMarkdown(event.target.value)}
                      placeholder="# Supplemental rulesheet"
                    />
                  </label>
                  <div className="path-list">
                    <div>
                      <small>Override markdown path</small>
                      <code>{detail.override.rulesheetLocalPath ?? detail.machine.rulesheetLocalPath ?? "None"}</code>
                    </div>
                    {detail.override.rulesheetSourceUrl && (
                      <div>
                        <small>Source URL</small>
                        <a href={detail.override.rulesheetSourceUrl} target="_blank" rel="noreferrer">
                          {detail.override.rulesheetSourceUrl}
                        </a>
                      </div>
                    )}
                    {detail.override.rulesheetSourceNote && (
                      <div>
                        <small>Source note</small>
                        <code>{detail.override.rulesheetSourceNote}</code>
                      </div>
                    )}
                  </div>
                </section>

                <section className="panel two-up-panel panel-span-full">
                  <div>
                    <div className="panel-header slim">
                      <div>
                        <h2>Game info preview</h2>
                        <p className="muted">Supplemental notes layered on top of the OPDB foundation.</p>
                      </div>
                    </div>
                    <pre className="markdown-preview">{detail.gameinfoContent || "No game info markdown yet."}</pre>
                  </div>
                  <div>
                    <div className="panel-header slim">
                      <div>
                        <h2>OPDB aliases</h2>
                        <p className="muted">These machine rows collapse into this single practice identity override target.</p>
                      </div>
                    </div>
                    <div className="alias-list">
                      {detail.sources.aliases.map((alias) => (
                        <article key={alias.opdbMachineId} className="alias-card">
                          <strong>{alias.variant || detail.machine.name}</strong>
                          <code>{alias.opdbMachineId}</code>
                          <code>{alias.slug}</code>
                          <span className="muted">
                            {alias.updatedAt ? `Updated ${new Date(alias.updatedAt).toLocaleDateString()}` : "No update timestamp"}
                          </span>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          {!detail && !loadingDetail && selectedMachine && (
            <div className="empty-state">Unable to load {displayTitle(selectedMachine)}.</div>
          )}
        </section>
      </main>
    </div>
  );
}
