import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

type VenueStudioSource = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  venueLocation: string | null;
  pmLocationId: string | null;
  rowCount: number;
  editedRows: number;
  needsAttentionRows: number;
  missingPlayfieldRows: number;
  missingRulesheetRows: number;
  zeroVideoRows: number;
};

type VenueStudioRow = {
  libraryEntryId: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  venueLocation: string | null;
  pmLocationId: string | null;
  practiceIdentity: string | null;
  opdbId: string | null;
  slug: string | null;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  area: string | null;
  areaOrder: number | null;
  groupNumber: number | null;
  position: number | null;
  bank: number | null;
  links: {
    playfieldImageUrl: string | null;
    rulesheetUrl: string | null;
    tutorial: string[];
    gameplay: string[];
    competition: string[];
  };
  assets: {
    builtInPlayfieldLocalPath: string | null;
    builtInRulesheetLocalPath: string | null;
    builtInGameinfoLocalPath: string | null;
    builtInRulesheetLinks: string[];
    canonicalPlayfieldUrl: string | null;
    canonicalBackglassUrl: string | null;
    primaryImageUrl: string | null;
    adminPlayfieldCount: number;
    adminHasRulesheet: boolean;
    adminHasGameinfo: boolean;
    catalogVideoCount: number;
    overrideVideoCount: number;
    catalogRulesheetCount: number;
    overrideRulesheetCount: number;
  };
  flags: {
    isEdited: boolean;
    needsAttention: boolean;
    hasVenuePlayfield: boolean;
    hasVenueRulesheet: boolean;
    hasVenueVideos: boolean;
    hasEffectivePlayfield: boolean;
    hasEffectiveRulesheet: boolean;
    hasEffectiveGameinfo: boolean;
  };
  updatedAt: string | null;
};

type VenueStudioResponse = {
  sources: VenueStudioSource[];
  rows: VenueStudioRow[];
};

type VenueEntryDraft = {
  area: string;
  areaOrder: string;
  groupNumber: string;
  position: string;
  bank: string;
  name: string;
  variant: string;
  manufacturer: string;
  year: string;
  playfieldImageUrl: string;
  rulesheetUrl: string;
  tutorialLinks: string[];
  gameplayLinks: string[];
  competitionLinks: string[];
};

type VenueStudioProps = {
  onOpenMachine: (practiceIdentity: string) => void;
};

type VenueStudioFilter = "all" | "needs_attention" | "edited";
type VenueStudioGrouping = "layout" | "bank" | "flat";

const VIDEO_SLOT_COUNT = 4;

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

function venueDisplayTitle(row: Pick<VenueStudioRow, "name" | "variant">) {
  return [row.name, row.variant].filter(Boolean).join(" • ");
}

function slotLabel(row: Pick<VenueStudioRow, "area" | "groupNumber" | "position" | "bank">) {
  return [
    row.area ? `A${row.area}` : null,
    row.groupNumber != null ? `G${row.groupNumber}` : null,
    row.position != null ? `P${row.position}` : null,
    row.bank != null ? `B${row.bank}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function imageCandidate(row: VenueStudioRow) {
  return row.assets.primaryImageUrl ?? row.links.playfieldImageUrl ?? row.assets.canonicalPlayfieldUrl ?? row.assets.canonicalBackglassUrl ?? null;
}

function withFixedSlots(values: string[]) {
  return Array.from({ length: VIDEO_SLOT_COUNT }, (_, index) => values[index] ?? "");
}

function hydrateDraft(row: VenueStudioRow): VenueEntryDraft {
  return {
    area: row.area ?? "",
    areaOrder: row.areaOrder != null ? String(row.areaOrder) : "",
    groupNumber: row.groupNumber != null ? String(row.groupNumber) : "",
    position: row.position != null ? String(row.position) : "",
    bank: row.bank != null ? String(row.bank) : "",
    name: row.name,
    variant: row.variant ?? "",
    manufacturer: row.manufacturer ?? "",
    year: row.year != null ? String(row.year) : "",
    playfieldImageUrl: row.links.playfieldImageUrl ?? "",
    rulesheetUrl: row.links.rulesheetUrl ?? "",
    tutorialLinks: withFixedSlots(row.links.tutorial),
    gameplayLinks: withFixedSlots(row.links.gameplay),
    competitionLinks: withFixedSlots(row.links.competition),
  };
}

function normalizeUrlSlots(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeDraftForSave(draft: VenueEntryDraft) {
  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    area: draft.area.trim() || null,
    areaOrder: parseOptionalNumber(draft.areaOrder),
    groupNumber: parseOptionalNumber(draft.groupNumber),
    position: parseOptionalNumber(draft.position),
    bank: parseOptionalNumber(draft.bank),
    name: draft.name.trim(),
    variant: draft.variant.trim() || null,
    manufacturer: draft.manufacturer.trim() || null,
    year: parseOptionalNumber(draft.year),
    playfieldImageUrl: draft.playfieldImageUrl.trim() || null,
    rulesheetUrl: draft.rulesheetUrl.trim() || null,
    tutorialLinks: normalizeUrlSlots(draft.tutorialLinks),
    gameplayLinks: normalizeUrlSlots(draft.gameplayLinks),
    competitionLinks: normalizeUrlSlots(draft.competitionLinks),
  };
}

function draftMatchesRow(draft: VenueEntryDraft, row: VenueStudioRow) {
  const normalized = normalizeDraftForSave(draft);
  return (
    normalized.area === row.area &&
    normalized.areaOrder === row.areaOrder &&
    normalized.groupNumber === row.groupNumber &&
    normalized.position === row.position &&
    normalized.bank === row.bank &&
    normalized.name === row.name &&
    normalized.variant === row.variant &&
    normalized.manufacturer === row.manufacturer &&
    normalized.year === row.year &&
    normalized.playfieldImageUrl === row.links.playfieldImageUrl &&
    normalized.rulesheetUrl === row.links.rulesheetUrl &&
    JSON.stringify(normalized.tutorialLinks) === JSON.stringify(row.links.tutorial) &&
    JSON.stringify(normalized.gameplayLinks) === JSON.stringify(row.links.gameplay) &&
    JSON.stringify(normalized.competitionLinks) === JSON.stringify(row.links.competition)
  );
}

function compareVenueRows(left: VenueStudioRow, right: VenueStudioRow) {
  return (
    (left.areaOrder ?? Number.MAX_SAFE_INTEGER) - (right.areaOrder ?? Number.MAX_SAFE_INTEGER) ||
    (left.area ?? "zzz").localeCompare(right.area ?? "zzz", undefined, { sensitivity: "base" }) ||
    (left.groupNumber ?? Number.MAX_SAFE_INTEGER) - (right.groupNumber ?? Number.MAX_SAFE_INTEGER) ||
    (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER) ||
    (left.bank ?? Number.MAX_SAFE_INTEGER) - (right.bank ?? Number.MAX_SAFE_INTEGER) ||
    venueDisplayTitle(left).localeCompare(venueDisplayTitle(right), undefined, { sensitivity: "base" })
  );
}

function groupRows(rows: VenueStudioRow[], grouping: VenueStudioGrouping) {
  if (grouping === "flat") {
    return [{ key: "all", label: "All games", rows: [...rows].sort(compareVenueRows) }];
  }

  const buckets = new Map<string, { key: string; label: string; rows: VenueStudioRow[]; sortValue: string }>();
  for (const row of rows) {
    const label =
      grouping === "bank"
        ? row.bank != null
          ? `Bank ${row.bank}`
          : "No bank"
        : [row.area ? `Area ${row.area}` : "No area", row.groupNumber != null ? `Group ${row.groupNumber}` : "No group"]
            .filter(Boolean)
            .join(" • ");
    const sortValue =
      grouping === "bank"
        ? `${String(row.bank ?? Number.MAX_SAFE_INTEGER).padStart(6, "0")}:${label}`
        : `${String(row.areaOrder ?? Number.MAX_SAFE_INTEGER).padStart(6, "0")}:${row.area ?? "zzz"}:${String(row.groupNumber ?? Number.MAX_SAFE_INTEGER).padStart(6, "0")}`;
    const existing = buckets.get(label) ?? { key: label.toLowerCase(), label, rows: [], sortValue };
    existing.rows.push(row);
    existing.sortValue = sortValue;
    buckets.set(label, existing);
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.sortValue.localeCompare(right.sortValue))
    .map((group) => ({ ...group, rows: group.rows.sort(compareVenueRows) }));
}

function emptySnapshot(): VenueStudioResponse {
  return { sources: [], rows: [] };
}

export default function VenueStudio({ onOpenMachine }: VenueStudioProps) {
  const [snapshot, setSnapshot] = useState<VenueStudioResponse>(emptySnapshot);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [draft, setDraft] = useState<VenueEntryDraft | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<VenueStudioFilter>("all");
  const [grouping, setGrouping] = useState<VenueStudioGrouping>("layout");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function refreshVenueStudio() {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<VenueStudioResponse>("api/venue-studio");
      setSnapshot(payload);
    } catch (fetchError) {
      setError(extractMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshVenueStudio();
  }, []);

  useEffect(() => {
    if (!snapshot.sources.length) {
      setSelectedSourceId("");
      return;
    }
    if (!selectedSourceId || !snapshot.sources.some((source) => source.sourceId === selectedSourceId)) {
      setSelectedSourceId(snapshot.sources[0].sourceId);
    }
  }, [selectedSourceId, snapshot.sources]);

  const selectedSource = useMemo(
    () => snapshot.sources.find((source) => source.sourceId === selectedSourceId) ?? null,
    [selectedSourceId, snapshot.sources],
  );

  const visibleRows = useMemo(() => {
    const rows = snapshot.rows.filter((row) => row.sourceId === selectedSourceId);
    return rows.filter((row) => {
      if (filter === "needs_attention" && !row.flags.needsAttention) return false;
      if (filter === "edited" && !row.flags.isEdited) return false;
      if (!deferredSearch) return true;
      const haystack = [
        row.name,
        row.variant,
        row.manufacturer,
        row.practiceIdentity,
        row.opdbId,
        row.area,
        row.slug,
        slotLabel(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, filter, selectedSourceId, snapshot.rows]);

  const groupedRows = useMemo(() => groupRows(visibleRows, grouping), [grouping, visibleRows]);

  useEffect(() => {
    if (!visibleRows.length) {
      setSelectedRowId("");
      setDraft(null);
      return;
    }
    if (!selectedRowId || !visibleRows.some((row) => row.libraryEntryId === selectedRowId)) {
      const nextRow = visibleRows[0];
      setSelectedRowId(nextRow.libraryEntryId);
      setDraft(hydrateDraft(nextRow));
    }
  }, [selectedRowId, visibleRows]);

  const selectedRow = useMemo(
    () => visibleRows.find((row) => row.libraryEntryId === selectedRowId) ?? snapshot.rows.find((row) => row.libraryEntryId === selectedRowId) ?? null,
    [selectedRowId, snapshot.rows, visibleRows],
  );

  useEffect(() => {
    if (!selectedRow) return;
    setDraft(hydrateDraft(selectedRow));
  }, [selectedRowId, selectedRow?.updatedAt]);

  const draftDirty = Boolean(selectedRow && draft && !draftMatchesRow(draft, selectedRow));
  const visibleCount = visibleRows.length;
  const editedVisibleCount = visibleRows.filter((row) => row.flags.isEdited).length;
  const attentionVisibleCount = visibleRows.filter((row) => row.flags.needsAttention).length;

  async function handleSave() {
    if (!selectedRow || !draft) return;
    setBusyAction("save-row");
    setError(null);
    try {
      const payload = normalizeDraftForSave(draft);
      const result = await apiFetch<{ item?: VenueStudioRow; reset: boolean }>(`api/venue-studio/entries/${selectedRow.libraryEntryId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await refreshVenueStudio();
      setToast(result.reset ? "Row reset to the current seed data." : "Venue row saved.");
    } catch (saveError) {
      setError(extractMessage(saveError));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReset() {
    if (!selectedRow) return;
    setBusyAction("reset-row");
    setError(null);
    try {
      await apiFetch(`api/venue-studio/entries/${selectedRow.libraryEntryId}`, {
        method: "DELETE",
      });
      await refreshVenueStudio();
      setToast("Venue row reset.");
    } catch (resetError) {
      setError(extractMessage(resetError));
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="venue-studio-page">
      <section className="panel venue-studio-hero">
        <div className="venue-studio-hero-copy">
          <p className="eyebrow">Venue Studio</p>
          <h2>Venue-first game editing, built to replace the sheet workflow.</h2>
          <p className="muted">
            Pick a venue, scan grouped machine rows the way you do in Google Sheets, and edit the row-level links and placement details without
            leaving admin.
          </p>
        </div>
        <div className="venue-studio-hero-toolbar">
          <label className="field venue-studio-search">
            Search rows
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="game, variant, area, practice ID..." />
          </label>
          <div className="venue-studio-toggle-stack">
            <div className="view-toggle-row">
              {[
                { value: "all", label: "All" },
                { value: "needs_attention", label: "Needs Attention" },
                { value: "edited", label: "Edited" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`secondary-button view-toggle ${filter === option.value ? "active" : ""}`}
                  onClick={() => setFilter(option.value as VenueStudioFilter)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="view-toggle-row">
              {[
                { value: "layout", label: "Layout" },
                { value: "bank", label: "Bank" },
                { value: "flat", label: "Flat" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`secondary-button view-toggle ${grouping === option.value ? "active" : ""}`}
                  onClick={() => setGrouping(option.value as VenueStudioGrouping)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="venue-source-grid">
          {snapshot.sources.map((source) => (
            <button
              key={source.sourceId}
              type="button"
              className={`venue-source-card ${source.sourceId === selectedSourceId ? "active" : ""}`}
              onClick={() =>
                startTransition(() => {
                  setSelectedSourceId(source.sourceId);
                  const firstRow = snapshot.rows.find((row) => row.sourceId === source.sourceId);
                  if (firstRow) {
                    setSelectedRowId(firstRow.libraryEntryId);
                    setDraft(hydrateDraft(firstRow));
                  }
                })
              }
            >
              <div className="venue-source-card-head">
                <div>
                  <strong>{source.sourceName}</strong>
                  <span>{source.venueLocation ?? "Venue source"}</span>
                </div>
                {source.editedRows > 0 && <span className="tag accent">{source.editedRows} edited</span>}
              </div>
              <div className="venue-source-metrics">
                <div>
                  <span>{source.rowCount}</span>
                  <small>rows</small>
                </div>
                <div>
                  <span>{source.needsAttentionRows}</span>
                  <small>attention</small>
                </div>
                <div>
                  <span>{source.zeroVideoRows}</span>
                  <small>no videos</small>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {toast && <div className="toast inline-toast ok">{toast}</div>}
      {error && <div className="toast inline-toast error">{error}</div>}

      <div className="venue-studio-layout">
        <section className="panel venue-studio-list-panel">
          <div className="panel-header">
            <div className="panel-header-title-group">
              <div className="panel-header-title-row">
                <h2>{selectedSource?.sourceName ?? "Venue rows"}</h2>
              </div>
              <p className="muted">
                {selectedSource?.venueLocation ?? "Select a source"} {selectedSource?.pmLocationId ? `• PM ${selectedSource.pmLocationId}` : ""}
              </p>
            </div>
            {selectedSource && (
              <a className="secondary-button" href={`api/venue-studio/export/${encodeURIComponent(selectedSource.sourceId)}.csv`}>
                Export CSV
              </a>
            )}
          </div>

          <div className="venue-studio-summary-strip">
            <div>
              <span>{visibleCount}</span>
              <small>visible rows</small>
            </div>
            <div>
              <span>{attentionVisibleCount}</span>
              <small>need attention</small>
            </div>
            <div>
              <span>{editedVisibleCount}</span>
              <small>edited here</small>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading venue rows…</div>
          ) : groupedRows.length ? (
            <div className="venue-row-groups">
              {groupedRows.map((group) => (
                <section key={group.key} className="venue-row-group">
                  <div className="venue-row-group-head">
                    <strong>{group.label}</strong>
                    <span className="muted">{group.rows.length} row{group.rows.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="venue-row-list">
                    {group.rows.map((row) => {
                      const selected = row.libraryEntryId === selectedRowId;
                      const totalVideos = row.links.tutorial.length + row.links.gameplay.length + row.links.competition.length;
                      return (
                        <button
                          key={row.libraryEntryId}
                          type="button"
                          className={`venue-row-card ${selected ? "selected" : ""}`}
                          onClick={() =>
                            startTransition(() => {
                              setSelectedRowId(row.libraryEntryId);
                              setDraft(hydrateDraft(row));
                            })
                          }
                        >
                          <div className="venue-row-card-top">
                            <div>
                              <strong>{venueDisplayTitle(row)}</strong>
                              <span>{[row.manufacturer, row.year].filter(Boolean).join(" • ") || "No maker metadata"}</span>
                            </div>
                            <span className="pill">{slotLabel(row) || "Unslotted"}</span>
                          </div>
                          <div className="row-tags compact-tags">
                            <span className={row.flags.hasEffectivePlayfield ? "tag info" : "tag muted-tag"}>{row.flags.hasVenuePlayfield ? "Venue PF" : row.assets.adminPlayfieldCount > 0 || row.assets.builtInPlayfieldLocalPath ? "Local PF" : "PF missing"}</span>
                            <span className={row.flags.hasEffectiveRulesheet ? "tag info" : "tag muted-tag"}>{row.flags.hasVenueRulesheet ? "Venue rules" : row.assets.builtInRulesheetLocalPath || row.assets.adminHasRulesheet ? "Local rules" : "Rules missing"}</span>
                            <span className={row.flags.hasEffectiveGameinfo ? "tag" : "tag muted-tag"}>{row.flags.hasEffectiveGameinfo ? "Game info" : "No info"}</span>
                            <span className={totalVideos > 0 ? "tag accent" : "tag muted-tag"}>{totalVideos ? `${totalVideos} videos` : "No videos"}</span>
                            {row.flags.isEdited && <span className="tag accent">Edited</span>}
                          </div>
                          <div className="venue-row-card-footer">
                            <code>{row.libraryEntryId}</code>
                            {row.practiceIdentity && <code>{row.practiceIdentity}</code>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">No venue rows match this filter.</div>
          )}
        </section>

        <section className="panel venue-studio-editor-panel">
          {!selectedRow || !draft ? (
            <div className="empty-state">Pick a venue row to edit.</div>
          ) : (
            <>
              <div className="venue-editor-header">
                <div className="venue-editor-hero">
                  <div className="venue-editor-image-frame">
                    {imageCandidate(selectedRow) ? (
                      <img src={imageCandidate(selectedRow) ?? ""} alt={venueDisplayTitle(selectedRow)} />
                    ) : (
                      <div className="image-fallback">No image available</div>
                    )}
                  </div>
                  <div className="venue-editor-copy">
                    <p className="eyebrow">{selectedRow.sourceName}</p>
                    <h2>{venueDisplayTitle(selectedRow)}</h2>
                    <div className="machine-detail-meta">
                      <span>{selectedRow.manufacturer || "Unknown maker"}</span>
                      <span>{selectedRow.year ?? "—"}</span>
                      <span>{slotLabel(selectedRow) || "Unslotted"}</span>
                    </div>
                    <div className="row-tags">
                      <span className={selectedRow.flags.hasEffectivePlayfield ? "tag info" : "tag muted-tag"}>{selectedRow.flags.hasEffectivePlayfield ? "Playfield covered" : "Playfield missing"}</span>
                      <span className={selectedRow.flags.hasEffectiveRulesheet ? "tag info" : "tag muted-tag"}>{selectedRow.flags.hasEffectiveRulesheet ? "Rulesheet covered" : "Rulesheet missing"}</span>
                      <span className={selectedRow.flags.hasVenueVideos ? "tag accent" : "tag muted-tag"}>{selectedRow.flags.hasVenueVideos ? "Videos attached" : "Needs videos"}</span>
                      {selectedRow.flags.isEdited && <span className="tag accent">Override saved</span>}
                    </div>
                    <div className="hero-meta">
                      <span>
                        <small>Library Row</small>
                        <code>{selectedRow.libraryEntryId}</code>
                      </span>
                      <span>
                        <small>Practice ID</small>
                        <code>{selectedRow.practiceIdentity ?? "—"}</code>
                      </span>
                      <span>
                        <small>OPDB ID</small>
                        <code>{selectedRow.opdbId ?? "—"}</code>
                      </span>
                      <span>
                        <small>Location</small>
                        <code>{selectedRow.venueLocation ?? "—"}</code>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="venue-editor-actions sticky-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setDraft(hydrateDraft(selectedRow))}
                    disabled={!draftDirty || busyAction === "save-row" || busyAction === "reset-row"}
                  >
                    Revert draft
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handleReset}
                    disabled={!selectedRow.flags.isEdited || busyAction === "save-row" || busyAction === "reset-row"}
                  >
                    {busyAction === "reset-row" ? "Resetting…" : "Reset saved override"}
                  </button>
                  {selectedRow.practiceIdentity && (
                    <button className="secondary-button" type="button" onClick={() => onOpenMachine(selectedRow.practiceIdentity!)}>
                      Open machine editor
                    </button>
                  )}
                  <button type="button" onClick={handleSave} disabled={!draftDirty || busyAction === "save-row" || busyAction === "reset-row"}>
                    {busyAction === "save-row" ? "Saving…" : "Save venue row"}
                  </button>
                </div>
              </div>

              <div className="venue-editor-grid">
                <section className="venue-editor-section">
                  <div className="panel-header slim">
                    <h3>Placement</h3>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      Area
                      <input value={draft.area} onChange={(event) => setDraft((current) => current ? { ...current, area: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Area order
                      <input value={draft.areaOrder} inputMode="numeric" onChange={(event) => setDraft((current) => current ? { ...current, areaOrder: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Group
                      <input value={draft.groupNumber} inputMode="numeric" onChange={(event) => setDraft((current) => current ? { ...current, groupNumber: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Position
                      <input value={draft.position} inputMode="numeric" onChange={(event) => setDraft((current) => current ? { ...current, position: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Bank
                      <input value={draft.bank} inputMode="numeric" onChange={(event) => setDraft((current) => current ? { ...current, bank: event.target.value } : current)} />
                    </label>
                  </div>
                </section>

                <section className="venue-editor-section">
                  <div className="panel-header slim">
                    <h3>Display row</h3>
                  </div>
                  <div className="form-grid">
                    <label className="field wide">
                      Game
                      <input value={draft.name} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Variant
                      <input value={draft.variant} onChange={(event) => setDraft((current) => current ? { ...current, variant: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Manufacturer
                      <input value={draft.manufacturer} onChange={(event) => setDraft((current) => current ? { ...current, manufacturer: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      Year
                      <input value={draft.year} inputMode="numeric" onChange={(event) => setDraft((current) => current ? { ...current, year: event.target.value } : current)} />
                    </label>
                  </div>
                </section>

                <section className="venue-editor-section venue-editor-section-wide">
                  <div className="panel-header slim">
                    <h3>Primary asset links</h3>
                  </div>
                  <div className="form-grid">
                    <label className="field wide">
                      Playfield image URL
                      <input value={draft.playfieldImageUrl} onChange={(event) => setDraft((current) => current ? { ...current, playfieldImageUrl: event.target.value } : current)} placeholder="https://..." />
                    </label>
                    <label className="field wide">
                      Rulesheet URL
                      <input value={draft.rulesheetUrl} onChange={(event) => setDraft((current) => current ? { ...current, rulesheetUrl: event.target.value } : current)} placeholder="https://..." />
                    </label>
                  </div>
                </section>

                {[
                  { key: "tutorialLinks", label: "Tutorial links" },
                  { key: "gameplayLinks", label: "Gameplay links" },
                  { key: "competitionLinks", label: "Competition links" },
                ].map((group) => (
                  <section key={group.key} className="venue-editor-section venue-editor-section-wide">
                    <div className="panel-header slim">
                      <h3>{group.label}</h3>
                    </div>
                    <div className="venue-link-grid">
                      {Array.from({ length: VIDEO_SLOT_COUNT }, (_, index) => (
                        <label key={`${group.key}-${index}`} className="field">
                          {`${group.label.replace(" links", "")} ${index + 1}`}
                          <input
                            value={draft[group.key as keyof VenueEntryDraft][index] as string}
                            onChange={(event) =>
                              setDraft((current) => {
                                if (!current) return current;
                                const nextValues = [...(current[group.key as keyof VenueEntryDraft] as string[])];
                                nextValues[index] = event.target.value;
                                return { ...current, [group.key]: nextValues };
                              })
                            }
                            placeholder="https://..."
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}

                <section className="venue-editor-section venue-editor-section-wide">
                  <div className="panel-header slim">
                    <h3>Coverage stack</h3>
                  </div>
                  <div className="path-list venue-stack-list">
                    <div>
                      <small>Built-in local playfield</small>
                      <code>{selectedRow.assets.builtInPlayfieldLocalPath ?? "None"}</code>
                    </div>
                    <div>
                      <small>Built-in local rulesheet</small>
                      <code>{selectedRow.assets.builtInRulesheetLocalPath ?? "None"}</code>
                    </div>
                    <div>
                      <small>Built-in game info</small>
                      <code>{selectedRow.assets.builtInGameinfoLocalPath ?? "None"}</code>
                    </div>
                    <div>
                      <small>Canonical playfield fallback</small>
                      <code>{selectedRow.assets.canonicalPlayfieldUrl ?? "None"}</code>
                    </div>
                    <div>
                      <small>Canonical backglass fallback</small>
                      <code>{selectedRow.assets.canonicalBackglassUrl ?? "None"}</code>
                    </div>
                    <div>
                      <small>Machine-level video extras</small>
                      <code>{`Catalog ${selectedRow.assets.catalogVideoCount} • Override ${selectedRow.assets.overrideVideoCount}`}</code>
                    </div>
                    <div>
                      <small>Machine-level rulesheet extras</small>
                      <code>{`Catalog ${selectedRow.assets.catalogRulesheetCount} • Override ${selectedRow.assets.overrideRulesheetCount}`}</code>
                    </div>
                    <div>
                      <small>Last venue-row save</small>
                      <code>{selectedRow.updatedAt ? new Date(selectedRow.updatedAt).toLocaleString() : "Seed only"}</code>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
