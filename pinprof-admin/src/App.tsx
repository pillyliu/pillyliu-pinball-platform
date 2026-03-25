import { type FormEvent, Fragment, type PointerEvent as ReactPointerEvent, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import VenueStudio from "./VenueStudio";

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
  catalogSourcePath: string;
};

type FilterPayload = {
  manufacturers: string[];
  manufacturerGroups?: Array<{
    label: string;
    manufacturers: string[];
  }>;
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
  gameinfoLocalPath: string | null;
  hasAdminOverride: boolean;
};

type ControlBoardItem = {
  practiceIdentity: string;
  opdbMachineId: string | null;
  opdbGroupId: string | null;
  slug: string;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  primaryImageUrl: string | null;
  playfieldImageUrl: string | null;
  membership: {
    libraryEntryId: string | null;
    sourceId: string | null;
    sourceName: string | null;
    sourceType: string | null;
    area: string | null;
    areaOrder: number | null;
    groupNumber: number | null;
    position: number | null;
    bank: number | null;
    count: number;
    playfieldImageUrl: string | null;
    rulesheetUrl: string | null;
  };
  coverage: {
    hasOpdbPlayfield: boolean;
    hasOpdbBackglass: boolean;
    hasBuiltInPlayfield: boolean;
    hasBuiltInRulesheet: boolean;
    hasBuiltInGameinfo: boolean;
    hasAdminOverride: boolean;
    hasAdminPlayfield: boolean;
    hasAdminRulesheet: boolean;
    hasAdminGameinfo: boolean;
    hasEffectivePlayfield: boolean;
    hasEffectiveBackglass: boolean;
    hasEffectiveRulesheet: boolean;
    hasEffectiveGameinfo: boolean;
  };
  videos: {
    builtInCount: number;
    catalogCount: number;
    overrideCount: number;
    tutorialCount: number;
    gameplayCount: number;
    competitionCount: number;
  };
  rulesheets: {
    builtInCount: number;
    catalogCount: number;
    overrideCount: number;
  };
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
  playfieldSourcePageUrl: string;
  playfieldSourceNote: string;
  rulesheetLocalPath: string | null;
  rulesheetSourceUrl: string;
  rulesheetSourceNote: string;
  gameinfoLocalPath: string | null;
  notes: string;
  updatedAt: string | null;
};

type VideoLinkEntry = {
  provider?: string;
  kind: string;
  label: string;
  url: string;
  priority: number;
};

type RulesheetLinkEntry = {
  provider?: string;
  label: string;
  url: string;
  priority: number;
};

type MaskPoint = {
  x: number;
  y: number;
};

type MaskStageMetrics = {
  stageWidth: number;
  stageHeight: number;
  imageLeft: number;
  imageTop: number;
  imageWidth: number;
  imageHeight: number;
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
      label: string;
      slug: string;
      name: string;
      variant: string | null;
      primaryImageUrl: string | null;
      playfieldImageUrl: string | null;
      updatedAt: string | null;
    }>;
    backglassAssets: Array<{
      backglassAssetId: number;
      sourceAliasId: string;
      sourceAliasLabel: string;
      localPath: string | null;
      originalLocalPath: string | null;
      referenceLocalPath: string | null;
      sourceUrl: string | null;
      sourcePageUrl: string | null;
      sourcePageSnapshotPath: string | null;
      sourceNote: string | null;
      web1400LocalPath: string | null;
      web700LocalPath: string | null;
      updatedAt: string | null;
    }>;
    playfieldAssets: Array<{
      playfieldAssetId: number;
      sourceAliasId: string;
      sourceAliasLabel: string;
      localPath: string | null;
      originalLocalPath: string | null;
      referenceLocalPath: string | null;
      sourceUrl: string | null;
      sourcePageUrl: string | null;
      sourcePageSnapshotPath: string | null;
      sourceNote: string | null;
      web1400LocalPath: string | null;
      web700LocalPath: string | null;
      maskPolygonPoints: MaskPoint[] | null;
      updatedAt: string | null;
    }>;
    assets: {
      backglass: {
        effectiveKind: "opdb" | "pillyliu" | "external" | "missing";
        effectiveLabel: string;
        effectiveUrl: string | null;
        targetAliasId: string;
        targetAliasLabel: string;
        targetFilename: string;
        localPath: string | null;
        localOriginalPath: string | null;
        localReferencePath: string | null;
        localSourceUrl: string | null;
        localSourcePageUrl: string | null;
        localSourcePageSnapshotPath: string | null;
        localSourceNote: string | null;
        localWeb1400Path: string | null;
        localWeb700Path: string | null;
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
        localOriginalPath: string | null;
        localReferencePath: string | null;
        localSourceUrl: string | null;
        localSourcePageUrl: string | null;
        localSourcePageSnapshotPath: string | null;
        localSourceNote: string | null;
        localWeb1400Path: string | null;
        localWeb700Path: string | null;
        localMaskPolygonPoints: MaskPoint[] | null;
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
  memberships?: Array<{
    libraryEntryId: string;
    sourceId: string;
    sourceName: string;
    sourceType: string;
    practiceIdentity: string | null;
    opdbId: string | null;
    area: string | null;
    areaOrder: number | null;
    groupNumber: number | null;
    position: number | null;
    bank: number | null;
    name: string;
    variant: string | null;
    manufacturer: string | null;
    year: number | null;
    slug: string | null;
    primaryImageUrl: string | null;
    primaryImageLargeUrl: string | null;
    playfieldImageUrl: string | null;
    playfieldLocalPath: string | null;
    playfieldSourceLabel: string | null;
    rulesheetLocalPath: string | null;
    gameinfoLocalPath: string | null;
    builtInVideoLinks: VideoLinkEntry[];
    builtInRulesheetLinks: RulesheetLinkEntry[];
  }>;
  links?: {
    catalogVideos: VideoLinkEntry[];
    overrideVideos: VideoLinkEntry[];
    catalogRulesheetLinks: RulesheetLinkEntry[];
    overrideRulesheetLinks: RulesheetLinkEntry[];
  };
};

type ControlBoardResponse = {
  items: ControlBoardItem[];
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
  playfieldSourcePageUrl: string;
  playfieldSourceNote: string;
  rulesheetSourceUrl: string;
  rulesheetSourceNote: string;
  notes: string;
};

type VideoKind = "tutorial" | "gameplay" | "competition";

type VideoOverrideDraft = {
  draftId: string;
  kind: VideoKind;
  label: string;
  url: string;
};

type ControlBoardViewMode = "manufacturer" | "source" | "all";

type ControlBoardStatusFilter =
  | "used_in_app"
  | "has_override"
  | "missing_playfield"
  | "missing_backglass"
  | "missing_rulesheet"
  | "missing_videos";

type PinsidePhotoBrowserSession = {
  active: boolean;
  status: "idle" | "starting" | "running" | "exited" | "failed";
  practiceIdentity: string | null;
  searchTerm: string | null;
  searchMode: "machine-key" | "machine-slug" | "game-search" | null;
  machineKey: string | null;
  machineSlug: string | null;
  resolvedBy: string | null;
  machineSlugCandidates: string[];
  viewerUrl: string;
  logPath: string | null;
  manifestPath: string | null;
  stateFilePath: string | null;
  launchedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  latestSavedFinal: {
    adId: string;
    adTitle: string | null;
    adUrl: string | null;
    photoIndex: number | null;
    filename: string | null;
    previewUrl: string | null;
    fullUrl: string | null;
    originalUrl: string | null;
    selectedAt: string | null;
    savedAt: string | null;
  } | null;
  recentLogLines: string[];
};

type Toast = {
  tone: "ok" | "error";
  message: string;
};

type MachineSortOption = "name" | "year_asc" | "year_desc" | "source_position";
type ThemePreference = "system" | "dark" | "light";
type MachinePanelKey = "playfield" | "backglass" | "rulesheet" | "gameinfoAliases" | "memberships" | "videoLinks" | "assetStack" | "metadata";
type MachinePanelCollapseState = Record<MachinePanelKey, boolean>;
type AdminWorkspaceView = "control-board" | "venue-studio";

const PAGE_SIZE = 20;
const MASK_POINT_MIN = 0;
const MASK_POINT_MAX = 1;
const MASK_DRAG_MOVEMENT_RATIO = 2;
const MASK_MAGNIFIER_ZOOM = 3;
const THEME_PREFERENCE_KEY = "pinprof-admin-theme-preference";
const DEFAULT_MACHINE_PANEL_COLLAPSE_STATE: MachinePanelCollapseState = {
  playfield: true,
  backglass: true,
  rulesheet: true,
  gameinfoAliases: true,
  memberships: true,
  videoLinks: true,
  assetStack: true,
  metadata: true,
};
const CONTROL_BOARD_VIEW_OPTIONS: Array<{ value: ControlBoardViewMode; label: string }> = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "source", label: "Source / Location" },
  { value: "all", label: "All" },
];
const CONTROL_BOARD_STATUS_OPTIONS: Array<{ value: ControlBoardStatusFilter; label: string }> = [
  { value: "used_in_app", label: "Used in app" },
  { value: "has_override", label: "Has override" },
  { value: "missing_playfield", label: "Missing playfield" },
  { value: "missing_backglass", label: "Missing backglass" },
  { value: "missing_rulesheet", label: "Missing rulesheet" },
  { value: "missing_videos", label: "Missing videos" },
];

const emptyOverridePayload = (): SaveOverridePayload => ({
  nameOverride: "",
  variantOverride: "",
  manufacturerOverride: "",
  yearOverride: "",
  backglassSourceUrl: "",
  backglassSourceNote: "",
  playfieldAliasId: "",
  playfieldSourceUrl: "",
  playfieldSourcePageUrl: "",
  playfieldSourceNote: "",
  rulesheetSourceUrl: "",
  rulesheetSourceNote: "",
  notes: "",
});

function parseWorkspaceView(hash: string): AdminWorkspaceView {
  return hash === "#venue-studio" ? "venue-studio" : "control-board";
}

function workspaceViewHash(view: AdminWorkspaceView): string {
  return view === "venue-studio" ? "#venue-studio" : "";
}

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

function displayTitle(item: ControlBoardItem | MachineListItem | MachineDetail["machine"]) {
  return [item.name, item.variant].filter(Boolean).join(" • ");
}

function displayImage(detail: MachineDetail | null): string | null {
  if (!detail) return null;
  return detail.sources.assets.playfield.effectiveUrl ?? detail.machine.playfieldImageUrl;
}

function buildWebUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return path;
}

function withCacheBust(url: string | null, version: string | number) {
  if (!url) return null;
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

function fileName(path: string | null): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampMaskCoordinate(value: number) {
  return Math.max(MASK_POINT_MIN, Math.min(MASK_POINT_MAX, value));
}

function measureMaskStage(stage: HTMLDivElement | null, image: HTMLImageElement | null): MaskStageMetrics | null {
  if (!stage || !image) return null;
  const stageRect = stage.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height || !imageRect.width || !imageRect.height) return null;
  return {
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    imageLeft: imageRect.left - stageRect.left,
    imageTop: imageRect.top - stageRect.top,
    imageWidth: imageRect.width,
    imageHeight: imageRect.height,
  };
}

function pointToStagePosition(point: MaskPoint, metrics: MaskStageMetrics | null) {
  if (!metrics) return null;
  return {
    x: metrics.imageLeft + point.x * metrics.imageWidth,
    y: metrics.imageTop + point.y * metrics.imageHeight,
  };
}

function eventToMaskPoint(
  event: PointerEvent | ReactPointerEvent<Element>,
  stage: HTMLDivElement | null,
  image: HTMLImageElement | null,
): MaskPoint | null {
  const metrics = measureMaskStage(stage, image);
  if (!metrics || !stage) return null;
  const stageRect = stage.getBoundingClientRect();
  return {
    x: clampMaskCoordinate((event.clientX - metrics.imageLeft - stageRect.left) / metrics.imageWidth),
    y: clampMaskCoordinate((event.clientY - metrics.imageTop - stageRect.top) / metrics.imageHeight),
  };
}

function buildPlayfieldEditorSourceUrl(practiceIdentity: string | null, aliasId: string | null, cacheKey: string) {
  if (!practiceIdentity || !aliasId) return null;
  const params = new URLSearchParams({
    machineAliasId: aliasId,
    cache: cacheKey,
  });
  return `api/machines/${practiceIdentity}/playfield/editor-source?${params.toString()}`;
}

function buildMaskClipPath(points: MaskPoint[]) {
  if (points.length < 3) return null;
  return `polygon(${points.map((point) => `${(point.x * 100).toFixed(3)}% ${(point.y * 100).toFixed(3)}%`).join(", ")})`;
}

function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveThemePreference(preference: ThemePreference): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function assetKindClass(kind: "opdb" | "pillyliu" | "external" | "missing") {
  if (kind === "pillyliu") return "tag accent";
  if (kind === "opdb") return "tag";
  if (kind === "external") return "tag info";
  return "tag muted-tag";
}

function videoKindSummary(links: VideoLinkEntry[]) {
  const counts = links.reduce(
    (result, link) => {
      if (link.kind === "tutorial") result.tutorial += 1;
      if (link.kind === "gameplay") result.gameplay += 1;
      if (link.kind === "competition") result.competition += 1;
      return result;
    },
    { tutorial: 0, gameplay: 0, competition: 0 },
  );
  return [
    counts.tutorial ? `${counts.tutorial} tutorial` : null,
    counts.gameplay ? `${counts.gameplay} gameplay` : null,
    counts.competition ? `${counts.competition} competition` : null,
  ].filter((value): value is string => Boolean(value));
}

function createDraftId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDraftVideoKind(kind: string): VideoKind {
  if (kind === "gameplay" || kind === "competition") return kind;
  return "tutorial";
}

function createVideoOverrideDraft(video?: Partial<Pick<VideoLinkEntry, "kind" | "label" | "url">>): VideoOverrideDraft {
  return {
    draftId: createDraftId(),
    kind: normalizeDraftVideoKind(String(video?.kind ?? "tutorial")),
    label: video?.label ?? "",
    url: video?.url ?? "",
  };
}

function controlBoardGroupLabel(item: ControlBoardItem, viewMode: ControlBoardViewMode) {
  if (viewMode === "manufacturer") {
    return item.manufacturer || "Unknown manufacturer";
  }
  if (viewMode === "source") {
    return item.membership.sourceName || "Unplaced / OPDB only";
  }
  return "All rows";
}

function pinsideStatusSummary(session: PinsidePhotoBrowserSession | null, detail: MachineDetail | null) {
  if (!session) return null;
  const scopeLabel =
    session.practiceIdentity && detail && session.practiceIdentity === detail.machine.practiceIdentity
      ? "for this game"
      : session.searchTerm
        ? `for ${session.searchTerm}`
        : "";

  if (session.status === "starting") {
    return `Starting archived browser ${scopeLabel}.`;
  }
  if (session.status === "running") {
    const logLine = session.recentLogLines[session.recentLogLines.length - 1];
    if (logLine && /waiting \d+ seconds/i.test(logLine)) {
      return `Playwright is waiting for your Pinside login ${scopeLabel}.`;
    }
    if (logLine && /wrote manifest/i.test(logLine)) {
      return `Archived viewer ready ${scopeLabel}.`;
    }
    return `Archived scraper running ${scopeLabel}.`;
  }
  if (session.status === "failed") {
    const logLine = session.recentLogLines[session.recentLogLines.length - 1];
    if (logLine && /no archived ad urls found|no ads for this game/i.test(logLine)) {
      return `No archived ads were found ${scopeLabel}.`;
    }
    return `Archived scraper failed ${scopeLabel}.`;
  }
  if (session.status === "exited") {
    const logLine = session.recentLogLines[session.recentLogLines.length - 1];
    if (logLine && /wrote manifest/i.test(logLine)) {
      return `Archived manifest completed ${scopeLabel}.`;
    }
    return `Archived scraper finished ${scopeLabel}.`;
  }
  return `Archived browser idle ${scopeLabel}.`;
}

function pinsideViewerHref(session: PinsidePhotoBrowserSession | null) {
  if (!session) return "#";
  if (!session.launchedAt) return session.viewerUrl;
  const separator = session.viewerUrl.includes("?") ? "&" : "?";
  return `${session.viewerUrl}${separator}launch=${encodeURIComponent(session.launchedAt)}`;
}

function pinsideProcessLabel(session: PinsidePhotoBrowserSession | null) {
  if (!session) return "No archived process";
  if (session.active) return "Python process active";
  if (session.status === "failed") return "Python process failed";
  if (session.status === "exited") return "Python process stopped";
  if (session.status === "starting") return "Python process starting";
  return "No archived process";
}

function controlBoardRowKey(item: ControlBoardItem) {
  return item.membership.libraryEntryId ?? item.practiceIdentity;
}

export default function App() {
  const [workspaceView, setWorkspaceView] = useState<AdminWorkspaceView>(() =>
    typeof window === "undefined" ? "control-board" : parseWorkspaceView(window.location.hash),
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getStoredThemePreference());
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [filters, setFilters] = useState<FilterPayload>({ manufacturers: [] });
  const [workspaceNotes, setWorkspaceNotes] = useState("");
  const [workspaceNotesUpdatedAt, setWorkspaceNotesUpdatedAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<GlobalActivityEntry[]>([]);
  const [pinsideBrowserSession, setPinsideBrowserSession] = useState<PinsidePhotoBrowserSession | null>(null);
  const [machines, setMachines] = useState<ControlBoardItem[]>([]);
  const [totalMachines, setTotalMachines] = useState(0);
  const [notebookCollapsed, setNotebookCollapsed] = useState(true);
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(true);
  const [viewFiltersCollapsed, setViewFiltersCollapsed] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [viewMode, setViewMode] = useState<ControlBoardViewMode>("manufacturer");
  const [statusFilters, setStatusFilters] = useState<ControlBoardStatusFilter[]>([]);
  const [sortOrder, setSortOrder] = useState<MachineSortOption>("name");
  const [pendingPageSelection, setPendingPageSelection] = useState<"first" | "last" | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<MachineDetail | null>(null);
  const [overrideForm, setOverrideForm] = useState<SaveOverridePayload>(emptyOverridePayload);
  const [videoOverrideDrafts, setVideoOverrideDrafts] = useState<VideoOverrideDraft[]>([]);
  const [rulesheetMarkdown, setRulesheetMarkdown] = useState("");
  const [gameinfoMarkdown, setGameinfoMarkdown] = useState("");
  const [password, setPassword] = useState("");
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [playfieldMaskDraft, setPlayfieldMaskDraft] = useState<MaskPoint[]>([]);
  const [playfieldMaskImageVersion, setPlayfieldMaskImageVersion] = useState(0);
  const [playfieldPublishedPreviewVersion, setPlayfieldPublishedPreviewVersion] = useState(() => Date.now());
  const [maskEditorOverlayOpen, setMaskEditorOverlayOpen] = useState(false);
  const [machinePanelCollapsed, setMachinePanelCollapsed] = useState<MachinePanelCollapseState>(DEFAULT_MACHINE_PANEL_COLLAPSE_STATE);
  const [draggingMaskPointIndex, setDraggingMaskPointIndex] = useState<number | null>(null);
  const lastAppliedPinsideSaveRef = useRef<string | null>(null);
  const maskDragOriginRef = useRef<{ cursorPoint: MaskPoint; point: MaskPoint } | null>(null);
  const maskStageRef = useRef<HTMLDivElement | null>(null);
  const maskStageImageRef = useRef<HTMLImageElement | null>(null);
  const maskMagnifierCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [maskImageLoadedAt, setMaskImageLoadedAt] = useState(0);
  const [maskStageMetrics, setMaskStageMetrics] = useState<MaskStageMetrics | null>(null);

  const selectedMachine = useMemo(() => machines.find((item) => controlBoardRowKey(item) === selectedRowKey) ?? null, [machines, selectedRowKey]);
  const selectedMachineIndex = useMemo(
    () => machines.findIndex((item) => controlBoardRowKey(item) === selectedRowKey),
    [machines, selectedRowKey],
  );
  const selectedPlayfieldAlias = useMemo(
    () => detail?.sources.aliases.find((alias) => alias.opdbMachineId === overrideForm.playfieldAliasId) ?? detail?.sources.aliases[0] ?? null,
    [detail, overrideForm.playfieldAliasId],
  );
  const selectedPlayfieldAsset = useMemo(
    () => detail?.sources.playfieldAssets.find((asset) => asset.sourceAliasId === overrideForm.playfieldAliasId) ?? null,
    [detail, overrideForm.playfieldAliasId],
  );
  const currentPlayfieldPublishedPath = selectedPlayfieldAsset?.localPath ?? detail?.override.playfieldLocalPath ?? detail?.machine.playfieldLocalPath ?? null;
  const currentPlayfieldOriginalPath = selectedPlayfieldAsset?.originalLocalPath ?? detail?.sources.assets.playfield.localOriginalPath ?? null;
  const currentPlayfieldReferencePath = selectedPlayfieldAsset?.referenceLocalPath ?? detail?.sources.assets.playfield.localReferencePath ?? null;
  const currentPlayfieldSnapshotPath = selectedPlayfieldAsset?.sourcePageSnapshotPath ?? detail?.sources.assets.playfield.localSourcePageSnapshotPath ?? null;
  const selectedMaskAliasId = overrideForm.playfieldAliasId || selectedPlayfieldAsset?.sourceAliasId || null;
  const selectedMaskUsesPrimaryPlayfieldAsset = detail?.sources.assets.playfield.targetAliasId === selectedMaskAliasId;
  const savedMaskPoints =
    selectedPlayfieldAsset?.maskPolygonPoints ??
    (selectedMaskUsesPrimaryPlayfieldAsset ? detail?.sources.assets.playfield.localMaskPolygonPoints ?? null : null);
  const maskEditorImageUrl = useMemo(
    () => buildPlayfieldEditorSourceUrl(selectedIdentity, selectedMaskAliasId, String(playfieldMaskImageVersion)),
    [playfieldMaskImageVersion, selectedIdentity, selectedMaskAliasId],
  );
  const maskEditorEnabled = Boolean(selectedPlayfieldAsset && maskEditorImageUrl);
  const activeMaskPoint = draggingMaskPointIndex != null ? playfieldMaskDraft[draggingMaskPointIndex] ?? null : null;
  const maskPreviewClipPath = useMemo(() => buildMaskClipPath(playfieldMaskDraft), [playfieldMaskDraft]);
  const publishedPlayfieldPreviewUrl = useMemo(
    () =>
      withCacheBust(
        buildWebUrl(currentPlayfieldPublishedPath),
        `${playfieldPublishedPreviewVersion}-${selectedPlayfieldAsset?.updatedAt ?? detail?.override.updatedAt ?? detail?.machine.playfieldLocalPath ?? "preview"}`,
      ),
    [currentPlayfieldPublishedPath, detail?.machine.playfieldLocalPath, detail?.override.updatedAt, playfieldPublishedPreviewVersion, selectedPlayfieldAsset?.updatedAt],
  );
  const maskStagePoints = useMemo(
    () => playfieldMaskDraft.map((point) => pointToStagePosition(point, maskStageMetrics)).filter((point): point is { x: number; y: number } => Boolean(point)),
    [maskStageMetrics, playfieldMaskDraft],
  );
  const activeMaskStagePoint = activeMaskPoint ? pointToStagePosition(activeMaskPoint, maskStageMetrics) : null;
  const maskDraftKey = JSON.stringify(playfieldMaskDraft);
  const savedMaskKey = JSON.stringify(savedMaskPoints ?? []);
  const maskSourceContextKey = JSON.stringify({
    selectedIdentity,
    aliasId: selectedMaskAliasId,
    assetId: selectedPlayfieldAsset?.playfieldAssetId ?? null,
    assetUpdatedAt: selectedPlayfieldAsset?.updatedAt ?? null,
    sourcePath: selectedPlayfieldAsset?.originalLocalPath ?? selectedPlayfieldAsset?.localPath ?? null,
    primaryAssetUpdatedAt: selectedMaskUsesPrimaryPlayfieldAsset ? detail?.sources.assets.playfield.localPath ?? null : null,
    maskEditorImageUrl,
  });
  const maskDraftChanged = maskDraftKey !== savedMaskKey;
  const groupedMachines = useMemo(() => {
    if (viewMode === "all") {
      return [{ key: "all", label: "All rows", items: machines }];
    }

    const groups = new Map<string, { key: string; label: string; items: ControlBoardItem[] }>();
    for (const item of machines) {
      const label = controlBoardGroupLabel(item, viewMode);
      const existing = groups.get(label) ?? { key: label.toLowerCase(), label, items: [] };
      existing.items.push(item);
      groups.set(label, existing);
    }

    return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
  }, [machines, viewMode]);
  const pageCount = Math.max(1, Math.ceil(totalMachines / PAGE_SIZE));
  const manufacturerGroups = filters.manufacturerGroups?.length
    ? filters.manufacturerGroups
    : [{ label: "Manufacturers", manufacturers: filters.manufacturers }];

  function buildControlBoardParams(nextPage: number) {
    const params = new URLSearchParams({
      query: deferredSearch,
      manufacturer: manufacturerFilter,
      sort: sortOrder,
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
    });
    for (const status of statusFilters) {
      params.append("status", status);
    }
    return params;
  }

  function refreshPinsideBrowserSession() {
    return apiFetch<PinsidePhotoBrowserSession>("api/tools/pinside-photo-browser").then(setPinsideBrowserSession);
  }

  function refreshSelectedMachineDetail(practiceIdentity: string) {
    return apiFetch<MachineDetail>(`api/machines/${practiceIdentity}`).then((payload) => {
      setDetail(payload);
      return payload;
    });
  }

  function changeWorkspaceView(nextView: AdminWorkspaceView) {
    setWorkspaceView(nextView);
    if (typeof window === "undefined") return;
    const nextHash = workspaceViewHash(nextView);
    if (window.location.hash === nextHash) return;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, "", nextUrl);
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const nextTheme = resolveThemePreference(themePreference);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.dataset.themePreference = themePreference;
      document.documentElement.style.colorScheme = nextTheme;
    };

    if (themePreference === "system") {
      window.localStorage.removeItem(THEME_PREFERENCE_KEY);
    } else {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    }

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleHashChange = () => {
      setWorkspaceView(parseWorkspaceView(window.location.hash));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
    refreshPinsideBrowserSession().catch((error) => setToast({ tone: "error", message: extractMessage(error) }));
  }, [session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;
    if (!pinsideBrowserSession?.active && pinsideBrowserSession?.status !== "starting" && pinsideBrowserSession?.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshPinsideBrowserSession().catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [pinsideBrowserSession?.active, pinsideBrowserSession?.status, session?.authenticated]);

  useEffect(() => {
    const latestSavedFinal = pinsideBrowserSession?.latestSavedFinal;
    if (!latestSavedFinal || !selectedIdentity) return;
    if (pinsideBrowserSession?.practiceIdentity !== selectedIdentity) return;
    const nextSourceUrl = latestSavedFinal.originalUrl ?? latestSavedFinal.fullUrl ?? "";
    if (!nextSourceUrl) return;
    const saveKey = [
      pinsideBrowserSession?.launchedAt ?? "",
      latestSavedFinal.savedAt ?? "",
      latestSavedFinal.adId ?? "",
      latestSavedFinal.photoIndex ?? "",
      nextSourceUrl,
    ].join("|");
    if (lastAppliedPinsideSaveRef.current === saveKey) return;
    lastAppliedPinsideSaveRef.current = saveKey;
    setOverrideForm((current) => ({
      ...current,
      playfieldSourceUrl: nextSourceUrl,
      playfieldSourcePageUrl: latestSavedFinal.adUrl ?? current.playfieldSourcePageUrl,
      playfieldSourceNote: latestSavedFinal.filename ?? current.playfieldSourceNote,
    }));
    setToast({ tone: "ok", message: "Saved Pinside final loaded into the playfield source fields." });
  }, [pinsideBrowserSession?.latestSavedFinal, pinsideBrowserSession?.launchedAt, pinsideBrowserSession?.practiceIdentity, selectedIdentity]);

  useEffect(() => {
    if (!session?.authenticated) return;

    setLoadingMachines(true);
    const params = buildControlBoardParams(page);

    apiFetch<ControlBoardResponse>(`api/control-board?${params.toString()}`)
      .then((payload) => {
        setMachines(payload.items);
        setTotalMachines(payload.total);
        if ((!selectedIdentity || !selectedRowKey) && payload.items[0]) {
          const nextItem = payload.items[0];
          startTransition(() => {
            setSelectedIdentity(nextItem.practiceIdentity);
            setSelectedRowKey(controlBoardRowKey(nextItem));
          });
        }
        if (pendingPageSelection && selectedRowKey && !payload.items.some((item) => controlBoardRowKey(item) === selectedRowKey) && payload.items[0]) {
          const nextItem =
            pendingPageSelection === "last" ? payload.items[payload.items.length - 1] ?? payload.items[0] : payload.items[0];
          startTransition(() => {
            setSelectedIdentity(nextItem.practiceIdentity);
            setSelectedRowKey(controlBoardRowKey(nextItem));
          });
        }
        setPendingPageSelection(null);
      })
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }))
      .finally(() => setLoadingMachines(false));
  }, [deferredSearch, manufacturerFilter, page, pendingPageSelection, selectedIdentity, selectedRowKey, session?.authenticated, sortOrder, statusFilters]);

  useEffect(() => {
    if (!session?.authenticated || !selectedIdentity) return;
    setLoadingDetail(true);
    refreshSelectedMachineDetail(selectedIdentity)
      .then((payload) => {
        setOverrideForm({
          nameOverride: payload.override.nameOverride,
          variantOverride: payload.override.variantOverride,
          manufacturerOverride: payload.override.manufacturerOverride,
          yearOverride: payload.override.yearOverride,
          backglassSourceUrl: payload.override.backglassSourceUrl,
          backglassSourceNote: payload.override.backglassSourceNote,
          playfieldAliasId: payload.override.playfieldAliasId,
          playfieldSourceUrl: payload.override.playfieldSourceUrl,
          playfieldSourcePageUrl: payload.override.playfieldSourcePageUrl,
          playfieldSourceNote: payload.override.playfieldSourceNote,
          rulesheetSourceUrl: payload.override.rulesheetSourceUrl,
          rulesheetSourceNote: payload.override.rulesheetSourceNote,
          notes: payload.override.notes,
        });
        setVideoOverrideDrafts((payload.links?.overrideVideos ?? []).map((link) => createVideoOverrideDraft(link)));
        setRulesheetMarkdown(payload.rulesheetContent);
        setGameinfoMarkdown(payload.gameinfoContent);
      })
      .catch((error) => setToast({ tone: "error", message: extractMessage(error) }))
      .finally(() => setLoadingDetail(false));
  }, [selectedIdentity, session?.authenticated]);

  useEffect(() => {
    setPlayfieldMaskDraft(savedMaskPoints ?? []);
    setDraggingMaskPointIndex(null);
    maskDragOriginRef.current = null;
  }, [maskSourceContextKey, savedMaskKey, savedMaskPoints]);

  useEffect(() => {
    setMaskEditorOverlayOpen(false);
    setMachinePanelCollapsed(DEFAULT_MACHINE_PANEL_COLLAPSE_STATE);
    lastAppliedPinsideSaveRef.current = null;
  }, [selectedIdentity]);

  useEffect(() => {
    if (!maskEditorOverlayOpen || typeof window === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaskEditorOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [maskEditorOverlayOpen]);

  useEffect(() => {
    const updateMetrics = () => {
      setMaskStageMetrics(measureMaskStage(maskStageRef.current, maskStageImageRef.current));
    };

    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    return () => window.removeEventListener("resize", updateMetrics);
  }, [maskImageLoadedAt, maskEditorImageUrl]);

  useEffect(() => {
    if (draggingMaskPointIndex == null) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      const cursorPoint = eventToMaskPoint(event, maskStageRef.current, maskStageImageRef.current);
      const origin = maskDragOriginRef.current;
      if (!cursorPoint || !origin) return;
      const nextPoint = {
        x: clampMaskCoordinate(origin.point.x + (cursorPoint.x - origin.cursorPoint.x) / MASK_DRAG_MOVEMENT_RATIO),
        y: clampMaskCoordinate(origin.point.y + (cursorPoint.y - origin.cursorPoint.y) / MASK_DRAG_MOVEMENT_RATIO),
      };
      setPlayfieldMaskDraft((current) =>
        current.map((point, index) => (index === draggingMaskPointIndex ? nextPoint : point)),
      );
    };

    const handlePointerUp = () => {
      setDraggingMaskPointIndex(null);
      maskDragOriginRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingMaskPointIndex]);

  useEffect(() => {
    if (!activeMaskPoint) return;
    const image = maskStageImageRef.current;
    const canvas = maskMagnifierCanvasRef.current;
    if (!image || !canvas || !image.complete || !image.naturalWidth || !image.naturalHeight) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const zoom = MASK_MAGNIFIER_ZOOM;
    const canvasSize = canvas.width;
    const sourceWidth = canvasSize / zoom;
    const sourceHeight = canvasSize / zoom;
    const centerX = activeMaskPoint.x * image.naturalWidth;
    const centerY = activeMaskPoint.y * image.naturalHeight;
    const sourceX = centerX - sourceWidth / 2;
    const sourceY = centerY - sourceHeight / 2;
    const cropX = Math.max(0, sourceX);
    const cropY = Math.max(0, sourceY);
    const cropRight = Math.min(image.naturalWidth, sourceX + sourceWidth);
    const cropBottom = Math.min(image.naturalHeight, sourceY + sourceHeight);
    const cropWidth = Math.max(0, cropRight - cropX);
    const cropHeight = Math.max(0, cropBottom - cropY);
    const destX = ((cropX - sourceX) / sourceWidth) * canvas.width;
    const destY = ((cropY - sourceY) / sourceHeight) * canvas.height;
    const destWidth = (cropWidth / sourceWidth) * canvas.width;
    const destHeight = (cropHeight / sourceHeight) * canvas.height;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    if (cropWidth > 0 && cropHeight > 0) {
      context.drawImage(image, cropX, cropY, cropWidth, cropHeight, destX, destY, destWidth, destHeight);
    }
  }, [activeMaskPoint, maskImageLoadedAt]);

  function refreshSummary() {
    return apiFetch<SummaryPayload>("api/summary").then(setSummary);
  }

  function refreshActivity() {
    return apiFetch<ActivityResponse>("api/activity?limit=40").then((payload) => setActivity(payload.items));
  }

  function refreshMachines() {
    const params = buildControlBoardParams(page);
    return apiFetch<ControlBoardResponse>(`api/control-board?${params.toString()}`).then((payload) => {
      setMachines(payload.items);
      setTotalMachines(payload.total);
    });
  }

  function selectRelativeMachine(direction: "previous" | "next") {
    if (!machines.length) return;
    if (selectedMachineIndex < 0) {
      const fallback = direction === "next" ? machines[0] : machines[machines.length - 1];
      if (fallback) {
        startTransition(() => {
          setSelectedIdentity(fallback.practiceIdentity);
          setSelectedRowKey(controlBoardRowKey(fallback));
        });
      }
      return;
    }
    if (direction === "previous") {
      if (selectedMachineIndex > 0) {
        const nextItem = machines[selectedMachineIndex - 1] ?? null;
        startTransition(() => {
          setSelectedIdentity(nextItem?.practiceIdentity ?? null);
          setSelectedRowKey(nextItem ? controlBoardRowKey(nextItem) : null);
        });
        return;
      }
      if (page > 1) {
        setPendingPageSelection("last");
        setPage((value) => Math.max(1, value - 1));
      }
      return;
    }
    if (selectedMachineIndex < machines.length - 1) {
      const nextItem = machines[selectedMachineIndex + 1] ?? null;
      startTransition(() => {
        setSelectedIdentity(nextItem?.practiceIdentity ?? null);
        setSelectedRowKey(nextItem ? controlBoardRowKey(nextItem) : null);
      });
      return;
    }
    if (page < pageCount) {
      setPendingPageSelection("first");
      setPage((value) => Math.min(pageCount, value + 1));
    }
  }

  function controlBoardAssetIndicators(item: ControlBoardItem) {
    return [
      item.coverage.hasAdminOverride ? { label: "OVR", tone: "accent" as const } : null,
      item.coverage.hasEffectivePlayfield ? { label: "PF", tone: "accent" as const } : null,
      item.coverage.hasEffectiveBackglass ? { label: "BG", tone: "tag" as const } : null,
      item.coverage.hasEffectiveRulesheet ? { label: "RS", tone: "info" as const } : null,
      item.coverage.hasEffectiveGameinfo ? { label: "GI", tone: "tag" as const } : null,
    ].filter((value): value is { label: string; tone: "accent" | "info" | "tag" } => Boolean(value));
  }

  function toggleStatusFilter(filter: ControlBoardStatusFilter) {
    setStatusFilters((current) => {
      const next = current.includes(filter) ? current.filter((value) => value !== filter) : [...current, filter];
      return next;
    });
    setPage(1);
    setPendingPageSelection(null);
  }

  function toggleMachinePanel(panel: MachinePanelKey) {
    setMachinePanelCollapsed((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }

  function changeViewMode(nextViewMode: ControlBoardViewMode) {
    setViewMode(nextViewMode);
    setPage(1);
    setPendingPageSelection(null);
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
        playfieldSourcePageUrl: payload.override.playfieldSourcePageUrl,
        playfieldSourceNote: payload.override.playfieldSourceNote,
        rulesheetSourceUrl: payload.override.rulesheetSourceUrl,
        rulesheetSourceNote: payload.override.rulesheetSourceNote,
        notes: payload.override.notes,
      });
      setVideoOverrideDrafts((payload.links?.overrideVideos ?? []).map((link) => createVideoOverrideDraft(link)));
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
        setPinsideBrowserSession(null);
        setVideoOverrideDrafts([]);
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
        playfieldSourcePageUrl: asset?.sourcePageUrl ?? "",
        playfieldSourceNote: asset?.sourceNote ?? "",
      };
    });
  }

  function addMaskPoint(event: ReactPointerEvent<HTMLDivElement>) {
    if (!maskEditorEnabled) return;
    if (event.target instanceof Element && event.target.closest("[data-mask-point='true']")) {
      return;
    }
    const nextPoint = eventToMaskPoint(event, maskStageRef.current, maskStageImageRef.current);
    if (!nextPoint) return;
    setPlayfieldMaskDraft((current) => [...current, nextPoint]);
  }

  function startMaskPointDrag(event: ReactPointerEvent<SVGCircleElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();
    const startPoint = playfieldMaskDraft[index];
    if (!startPoint) return;
    maskDragOriginRef.current = {
      cursorPoint: eventToMaskPoint(event, maskStageRef.current, maskStageImageRef.current) ?? startPoint,
      point: startPoint,
    };
    setDraggingMaskPointIndex(index);
  }

  function resetMaskDraft() {
    setPlayfieldMaskDraft(savedMaskPoints ?? []);
    setDraggingMaskPointIndex(null);
  }

  function removeLastMaskPoint() {
    setPlayfieldMaskDraft((current) => current.slice(0, -1));
  }

  async function handleSavePlayfieldMask() {
    if (!selectedIdentity || !overrideForm.playfieldAliasId) return;
    await runAction(
      "save-playfield-mask",
      async () => {
        await apiFetch(`api/machines/${selectedIdentity}/playfield/mask`, {
          method: "PUT",
          body: JSON.stringify({
            machineAliasId: overrideForm.playfieldAliasId,
            maskPolygonPoints: playfieldMaskDraft,
          }),
        });
        setPlayfieldMaskImageVersion((value) => value + 1);
        await refreshSelectedMachineDetail(selectedIdentity);
        setPlayfieldPublishedPreviewVersion(Date.now());
      },
      "Polygon mask saved and playfield regenerated.",
    );
  }

  async function handleClearPlayfieldMask() {
    if (!selectedIdentity || !overrideForm.playfieldAliasId) return;
    await runAction(
      "clear-playfield-mask",
      async () => {
        await apiFetch(`api/machines/${selectedIdentity}/playfield/mask`, {
          method: "PUT",
          body: JSON.stringify({
            machineAliasId: overrideForm.playfieldAliasId,
            maskPolygonPoints: [],
          }),
        });
        setPlayfieldMaskDraft([]);
        setPlayfieldMaskImageVersion((value) => value + 1);
        await refreshSelectedMachineDetail(selectedIdentity);
        setPlayfieldPublishedPreviewVersion(Date.now());
      },
      "Polygon mask cleared and playfield regenerated.",
    );
  }

  function addVideoOverrideDraft() {
    setVideoOverrideDrafts((current) => [...current, createVideoOverrideDraft()]);
  }

  function updateVideoOverrideDraft(draftId: string, patch: Partial<Omit<VideoOverrideDraft, "draftId">>) {
    setVideoOverrideDrafts((current) =>
      current.map((draft) => (draft.draftId === draftId ? { ...draft, ...patch } : draft)),
    );
  }

  function removeVideoOverrideDraft(draftId: string) {
    setVideoOverrideDrafts((current) => current.filter((draft) => draft.draftId !== draftId));
  }

  function moveVideoOverrideDraft(draftId: string, direction: "up" | "down") {
    setVideoOverrideDrafts((current) => {
      const index = current.findIndex((draft) => draft.draftId === draftId);
      if (index < 0) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  async function handleSaveVideoOverrides() {
    if (!selectedIdentity) return;
    await runAction(
      "save-video-overrides",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/videos`, {
          method: "PUT",
          body: JSON.stringify({
            videos: videoOverrideDrafts.map((draft) => ({
              kind: draft.kind,
              label: draft.label,
              url: draft.url,
            })),
          }),
        }),
      videoOverrideDrafts.length ? "Manual video overrides saved." : "Manual video overrides cleared.",
    );
  }

  async function handleLaunchPinsideBrowser() {
    if (!selectedIdentity || !detail) return;
    setBusyAction("launch-pinside-browser");
    setToast(null);
    try {
      const payload = await apiFetch<PinsidePhotoBrowserSession>(`api/machines/${selectedIdentity}/pinside-photo-browser/launch`, {
        method: "POST",
      });
      setPinsideBrowserSession(payload);
      await refreshActivity();
      const viewerHref = pinsideViewerHref(payload);
      setToast({
        tone: "ok",
        message: `Pinside launch started for ${payload.searchTerm ?? displayTitle(detail.machine)}. The browser worker is opening and the viewer will be available at ${viewerHref}.`,
      });
      window.setTimeout(() => {
        void refreshPinsideBrowserSession().catch(() => undefined);
      }, 1500);
    } catch (error) {
      setToast({ tone: "error", message: extractMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStopPinsideBrowser() {
    await runAction(
      "stop-pinside-browser",
      async () => {
        const payload = await apiFetch<PinsidePhotoBrowserSession>("api/tools/pinside-photo-browser/stop", {
          method: "POST",
        });
        setPinsideBrowserSession(payload);
        await refreshActivity();
      },
      "Archived playfield search stopped.",
    );
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
            sourcePageUrl: overrideForm.playfieldSourcePageUrl,
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

  async function handleSaveGameinfo() {
    if (!selectedIdentity) return;
    await runAction(
      "save-gameinfo",
      () =>
        apiFetch(`api/machines/${selectedIdentity}/gameinfo/save`, {
          method: "POST",
          body: JSON.stringify({
            markdown: gameinfoMarkdown,
          }),
        }),
      "Game info markdown saved.",
    );
  }

  async function handleUploadGameinfo(file: File | null) {
    if (!selectedIdentity || !file) return;
    await runAction(
      "upload-gameinfo",
      async () => {
        const markdown = await file.text();
        await apiFetch(`api/machines/${selectedIdentity}/gameinfo/save`, {
          method: "POST",
          body: JSON.stringify({
            markdown,
          }),
        });
      },
      "Game info uploaded from file.",
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
            sourcePageUrl: overrideForm.playfieldSourcePageUrl.trim(),
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
        body.append("sourcePageUrl", overrideForm.playfieldSourcePageUrl);
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
        <div className="topbar-brand">
          <p className="eyebrow">PinProf Admin</p>
          <h1>OPDB catalog + override workspace</h1>
          <div className="workspace-switcher" role="group" aria-label="Workspace view">
            <button
              type="button"
              className={`secondary-button workspace-switcher-button ${workspaceView === "control-board" ? "active" : ""}`}
              onClick={() => changeWorkspaceView("control-board")}
            >
              Control Board
            </button>
            <button
              type="button"
              className={`secondary-button workspace-switcher-button ${workspaceView === "venue-studio" ? "active" : ""}`}
              onClick={() => changeWorkspaceView("venue-studio")}
            >
              Venue Studio
            </button>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              type="button"
              className={`secondary-button theme-option ${themePreference === "system" ? "active" : ""}`}
              onClick={() => setThemePreference("system")}
              aria-pressed={themePreference === "system"}
            >
              Auto
            </button>
            <button
              type="button"
              className={`secondary-button theme-option ${themePreference === "dark" ? "active" : ""}`}
              onClick={() => setThemePreference("dark")}
              aria-pressed={themePreference === "dark"}
            >
              Dark
            </button>
            <button
              type="button"
              className={`secondary-button theme-option ${themePreference === "light" ? "active" : ""}`}
              onClick={() => setThemePreference("light")}
              aria-pressed={themePreference === "light"}
            >
              Light
            </button>
          </div>
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

      {workspaceView === "venue-studio" ? (
        <main className="workspace-shell venue-studio-workspace">
          <section className="editor venue-studio-editor-surface">
            <VenueStudio
              onOpenMachine={(practiceIdentity) => {
                startTransition(() => {
                  setSelectedIdentity(practiceIdentity);
                  setSelectedRowKey(null);
                  changeWorkspaceView("control-board");
                });
              }}
            />
          </section>
        </main>
      ) : (
      <main className="workspace-shell">
        <button
          className={`sidebar-toggle sidebar-toggle-left ${searchCollapsed ? "collapsed" : ""}`}
          onClick={() => setSearchCollapsed((current) => !current)}
          type="button"
          aria-label={searchCollapsed ? "Expand search sidebar" : "Collapse search sidebar"}
        >
          <span>{searchCollapsed ? ">" : "<"}</span>
          <small>Search</small>
        </button>
        {!searchCollapsed && (
          <aside className="sidebar sidebar-left">
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
            <section className="sidebar-block notebook-block">
              <div className="panel-header slim notebook-header">
                <h2>Notebook</h2>
                <div className="sidebar-block-actions">
                  {!notebookCollapsed && (
                    <button
                      className="secondary-button"
                      onClick={handleSaveWorkspaceNotes}
                      disabled={busyAction === "save-workspace-notes"}
                    >
                      {busyAction === "save-workspace-notes" ? "Saving…" : "Save"}
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    onClick={() => setNotebookCollapsed((current) => !current)}
                    type="button"
                  >
                    {notebookCollapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!notebookCollapsed && (
                <>
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
                </>
              )}
            </section>
            <label className="field">
              Search machines
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setPendingPageSelection(null);
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
                  setPendingPageSelection(null);
                }}
            >
              <option value="">All manufacturers</option>
              {manufacturerGroups.map((group, groupIndex) => (
                <Fragment key={group.label}>
                  {groupIndex > 0 && (
                    <option disabled value={`__divider-${group.label}`}>
                      ──────────
                    </option>
                  )}
                  <option disabled value={`__label-${group.label}`}>
                    {group.label}
                  </option>
                  {group.manufacturers.map((manufacturer) => (
                    <option key={`${group.label}-${manufacturer}`} value={manufacturer}>
                      {manufacturer}
                    </option>
                  ))}
                </Fragment>
              ))}
            </select>
          </label>
            <label className="field">
              Sort
              <select
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as MachineSortOption);
                  setPage(1);
                  setPendingPageSelection(null);
                }}
              >
                <option value="name">A-Z</option>
                <option value="year_asc">Old to New</option>
                <option value="year_desc">New to Old</option>
                <option value="source_position">Venue / Position</option>
              </select>
            </label>
            <section className="sidebar-block control-board-toolbar">
              <div className="panel-header slim notebook-header">
                <h2>View & filters</h2>
                <div className="sidebar-block-actions">
                  {!viewFiltersCollapsed && statusFilters.length > 0 && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setStatusFilters([]);
                        setPage(1);
                        setPendingPageSelection(null);
                      }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    onClick={() => setViewFiltersCollapsed((current) => !current)}
                    type="button"
                  >
                    {viewFiltersCollapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!viewFiltersCollapsed && (
                <>
                  <div className="panel-header slim">
                    <div>
                      <h2>View</h2>
                      <p className="muted">Switch between spreadsheet-style groupings without losing the same OPDB control board rows.</p>
                    </div>
                  </div>
                  <div className="view-toggle-row">
                    {CONTROL_BOARD_VIEW_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`secondary-button view-toggle ${viewMode === option.value ? "active" : ""}`}
                        onClick={() => changeViewMode(option.value)}
                        aria-pressed={viewMode === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="panel-header slim control-board-filter-header">
                    <div>
                      <h2>Quick filters</h2>
                      <p className="muted">Narrow the queue to games that still need attention.</p>
                    </div>
                  </div>
                  <div className="filter-chip-row">
                    {CONTROL_BOARD_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`secondary-button filter-chip ${statusFilters.includes(option.value) ? "active" : ""}`}
                        onClick={() => toggleStatusFilter(option.value)}
                        aria-pressed={statusFilters.includes(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
            <div className="control-board-table-wrap">
              {loadingMachines ? (
                <p className="muted">Loading machines…</p>
              ) : (
                groupedMachines.some((group) => group.items.length > 0) ? (
                  <table className="control-board-table">
                    <thead>
                      <tr>
                        <th>Game</th>
                        <th>Maker</th>
                        <th>Year</th>
                        <th>Source</th>
                        <th>Slot</th>
                        <th>Assets</th>
                        <th>Video</th>
                        <th>Rules</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedMachines.map((group) => (
                        <Fragment key={group.key}>
                          {viewMode !== "all" && (
                            <tr className="control-board-group-row">
                              <td colSpan={9}>
                                <div className="control-board-group-label">
                                  <strong>{group.label}</strong>
                                  <span className="muted">{group.items.length} row{group.items.length === 1 ? "" : "s"}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {group.items.map((item) => {
                            const rowKey = controlBoardRowKey(item);
                            const selected = rowKey === selectedRowKey;
                            const slotParts = [
                              item.membership.area ? `A${item.membership.area}` : null,
                              item.membership.groupNumber != null ? `G${item.membership.groupNumber}` : null,
                              item.membership.position != null ? `P${item.membership.position}` : null,
                              item.membership.bank != null ? `B${item.membership.bank}` : null,
                            ].filter(Boolean);
                            const assetIndicators = controlBoardAssetIndicators(item);
                            return (
                              <tr
                                key={rowKey}
                                className={selected ? "selected" : ""}
                                tabIndex={0}
                                onClick={() =>
                                  startTransition(() => {
                                    setSelectedIdentity(item.practiceIdentity);
                                    setSelectedRowKey(rowKey);
                                  })
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    startTransition(() => {
                                      setSelectedIdentity(item.practiceIdentity);
                                      setSelectedRowKey(rowKey);
                                    });
                                  }
                                }}
                              >
                                <td>
                                  <div className="table-title-cell">
                                    <strong>{displayTitle(item)}</strong>
                                    {item.variant && <span className="muted">{item.variant}</span>}
                                  </div>
                                </td>
                                <td>{item.manufacturer || "Unknown"}</td>
                                <td>{item.year ?? "—"}</td>
                                <td>
                                  <div className="table-title-cell">
                                    <strong>{item.membership.sourceName || "Unplaced"}</strong>
                                    <span className="muted">{item.membership.count ? `${item.membership.count} memberships` : "OPDB only"}</span>
                                  </div>
                                </td>
                                <td>{slotParts.join(" · ") || "—"}</td>
                                <td>
                                  <div className="row-tags compact-tags">
                                    {assetIndicators.length ? (
                                      assetIndicators.map((indicator) => (
                                        <span
                                          key={`${rowKey}-${indicator.label}`}
                                          className={indicator.tone === "accent" ? "tag accent" : indicator.tone === "info" ? "tag info" : "tag"}
                                        >
                                          {indicator.label}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="tag muted-tag">None</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="row-tags compact-tags">
                                    {item.videos.tutorialCount > 0 && <span className="tag muted-tag">T {item.videos.tutorialCount}</span>}
                                    {item.videos.gameplayCount > 0 && <span className="tag muted-tag">G {item.videos.gameplayCount}</span>}
                                    {item.videos.competitionCount > 0 && <span className="tag muted-tag">C {item.videos.competitionCount}</span>}
                                    {item.videos.tutorialCount + item.videos.gameplayCount + item.videos.competitionCount === 0 && (
                                      <span className="tag muted-tag">0</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="row-tags compact-tags">
                                    {item.rulesheets.builtInCount > 0 && <span className="tag info">Built {item.rulesheets.builtInCount}</span>}
                                    {item.rulesheets.catalogCount > 0 && <span className="tag">Cat {item.rulesheets.catalogCount}</span>}
                                    {item.rulesheets.overrideCount > 0 && <span className="tag accent">Ovr {item.rulesheets.overrideCount}</span>}
                                    {item.rulesheets.builtInCount + item.rulesheets.catalogCount + item.rulesheets.overrideCount === 0 && (
                                      <span className="tag muted-tag">0</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <code>{item.membership.libraryEntryId || item.opdbGroupId || item.practiceIdentity}</code>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">No matching control-board rows.</p>
                )
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
          </aside>
        )}

        <section className="editor">
          {!selectedIdentity && <div className="empty-state">Pick a machine to edit overrides.</div>}
          {selectedIdentity && loadingDetail && <div className="empty-state">Loading machine details…</div>}
          {detail && !loadingDetail && (
            <>
              <div className="editor-grid">
                <section className="panel hero-panel panel-span-full">
                  <div className="hero-copy">
                    <p className="eyebrow">Machine</p>
                    <div className="machine-title-row">
                      <h2>{displayTitle(detail.machine)}</h2>
                      <div className="machine-nav">
                        <button
                          className="secondary-button nav-button"
                          onClick={() => selectRelativeMachine("previous")}
                          disabled={selectedMachineIndex <= 0 && page <= 1}
                          type="button"
                          aria-label="Previous game"
                        >
                          {"<"}
                        </button>
                        <button
                          className="secondary-button nav-button"
                          onClick={() => selectRelativeMachine("next")}
                          disabled={selectedMachineIndex === machines.length - 1 && page >= pageCount}
                          type="button"
                          aria-label="Next game"
                        >
                          {">"}
                        </button>
                      </div>
                    </div>
                    <div className="machine-detail-meta">
                      <span>{detail.machine.manufacturer || "Unknown maker"}</span>
                      <span>{detail.machine.year ?? "—"}</span>
                    </div>
                    <div className="row-tags">
                      <span className={assetKindClass(detail.sources.assets.playfield.effectiveKind)}>
                        {detail.sources.assets.playfield.effectiveLabel}
                      </span>
                      <span className={assetKindClass(detail.sources.assets.backglass.effectiveKind)}>
                        {detail.sources.assets.backglass.effectiveLabel}
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
                        <code>{summary?.catalogSourcePath ?? "—"}</code>
                      </div>
                      <div>
                        <small>Override Store</small>
                        <code>{summary?.adminDbPath ?? "—"}</code>
                      </div>
                    </div>
                  </div>
                  <div className="hero-media-grid">
                    <div className="hero-image-frame hero-image-frame-backglass">
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
                    <div className="hero-image-frame hero-image-frame-playfield">
                      {displayImage(detail) ? (
                        <img
                          key={withCacheBust(buildWebUrl(displayImage(detail)), playfieldPublishedPreviewVersion) ?? ""}
                          src={withCacheBust(buildWebUrl(displayImage(detail)), playfieldPublishedPreviewVersion) ?? ""}
                          alt={`${displayTitle(detail.machine)} playfield`}
                        />
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

                <section className="panel panel-span-full playfield-panel">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Replace playfield image</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("playfield")} type="button">
                          {machinePanelCollapsed.playfield ? "Expand" : "Collapse"}
                        </button>
                      </div>
                    </div>
                    <div className="panel-header-actions">
                      <button className="secondary-button" onClick={handleLaunchPinsideBrowser} disabled={busyAction === "launch-pinside-browser"}>
                        {busyAction === "launch-pinside-browser" ? "Launching archived browser…" : "Find archived playfields"}
                      </button>
                      <button onClick={handleBindPlayfieldSource} disabled={busyAction === "bind-playfield-source"}>
                        {busyAction === "bind-playfield-source" ? "Saving…" : "Bind existing local file"}
                      </button>
                      <button onClick={handleImportPlayfieldUrl} disabled={busyAction === "import-playfield-url"}>
                        {busyAction === "import-playfield-url" ? "Importing…" : "Import from URL"}
                      </button>
                    </div>
                  </div>
                  {!machinePanelCollapsed.playfield && (
                    <>
                      <p className="muted">
                        Raw finds stay in the local asset package for reference. The app uses a processed black-background WebP plus 1400 and 700 derivatives.
                      </p>
                      <div className="playfield-workbench">
                        <div className="playfield-workbench-main">
                      {detail.sources.playfieldAssets.length > 0 && (
                        <div className="playfield-source-list">
                          {detail.sources.playfieldAssets.map((asset) => (
                            <article key={asset.playfieldAssetId} className="asset-card">
                              <div className="asset-card-head">
                                <h3>{asset.sourceAliasLabel}</h3>
                                <span className="tag accent">local source</span>
                              </div>
                              <p className="muted asset-card-summary">
                                {fileName(asset.localPath ?? asset.originalLocalPath) ?? "No saved file yet"}
                                {asset.sourceNote ? ` · ${asset.sourceNote}` : ""}
                              </p>
                              <button
                                className="secondary-button"
                                onClick={() => {
                                  setOverrideForm((current) => ({
                                    ...current,
                                    playfieldAliasId: asset.sourceAliasId,
                                    playfieldSourceUrl: asset.sourceUrl ?? "",
                                    playfieldSourcePageUrl: asset.sourcePageUrl ?? "",
                                    playfieldSourceNote: asset.sourceNote ?? "",
                                  }));
                                }}
                              >
                                Edit this asset
                              </button>
                              {(asset.originalLocalPath || asset.referenceLocalPath || asset.sourceUrl || asset.sourcePageUrl) && (
                                <details className="compact-details">
                                  <summary>More details</summary>
                                  <div className="path-list compact-path-list">
                                    {asset.originalLocalPath && (
                                      <div>
                                        <small>Original source file</small>
                                        <code>{asset.originalLocalPath}</code>
                                      </div>
                                    )}
                                    {asset.referenceLocalPath && (
                                      <div>
                                        <small>Reference manifest</small>
                                        <code>{asset.referenceLocalPath}</code>
                                      </div>
                                    )}
                                    {asset.sourceUrl && (
                                      <div>
                                        <small>Source image URL</small>
                                        <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
                                          {asset.sourceUrl}
                                        </a>
                                      </div>
                                    )}
                                    {asset.sourcePageUrl && (
                                      <div>
                                        <small>Source ad URL</small>
                                        <a href={asset.sourcePageUrl} target="_blank" rel="noreferrer">
                                          {asset.sourcePageUrl}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </article>
                          ))}
                        </div>
                      )}
                      <div className="form-grid">
                        <label className="field">
                          Source alias
                          <select
                            value={overrideForm.playfieldAliasId}
                            onChange={(event) => loadPlayfieldForm(event.target.value)}
                          >
                            {detail.sources.aliases.map((alias) => (
                              <option key={alias.opdbMachineId} value={alias.opdbMachineId}>
                                {alias.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="field static-field">
                          <small>Current published file</small>
                          <code>
                            {fileName(currentPlayfieldPublishedPath) ?? "No saved file yet"}
                          </code>
                        </div>
                        <label className="field wide">
                          Source image URL
                          <input
                            value={overrideForm.playfieldSourceUrl}
                            onChange={(event) => setOverrideForm((current) => ({ ...current, playfieldSourceUrl: event.target.value }))}
                            placeholder="https://o.pinside.com/...jpeg"
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
                      <div className="inline-button-row">
                        <button
                          className="secondary-button"
                          onClick={() => setMaskEditorOverlayOpen(true)}
                          disabled={!selectedPlayfieldAsset}
                        >
                          Open polygon editor
                        </button>
                        {savedMaskPoints?.length ? <span className="tag info">Saved mask</span> : <span className="tag">No saved mask</span>}
                      </div>
                      <details className="compact-details">
                        <summary>Optional source details</summary>
                        <div className="form-grid">
                          <label className="field wide">
                            Source ad URL
                            <input
                              value={overrideForm.playfieldSourcePageUrl}
                              onChange={(event) => setOverrideForm((current) => ({ ...current, playfieldSourcePageUrl: event.target.value }))}
                              placeholder="https://pinside.com/pinball/market/classifieds/archive/..."
                            />
                          </label>
                          <label className="field wide">
                            Source note
                            <input
                              value={overrideForm.playfieldSourceNote}
                              onChange={(event) => setOverrideForm((current) => ({ ...current, playfieldSourceNote: event.target.value }))}
                              placeholder="Seller, crop notes, or anything worth remembering"
                            />
                          </label>
                        </div>
                      </details>
                      <details className="compact-details">
                        <summary>Current asset details</summary>
                        <div className="path-list compact-path-list">
                          <div>
                            <small>Source alias</small>
                            <code>{selectedPlayfieldAlias?.label ?? detail.sources.assets.playfield.targetAliasLabel}</code>
                          </div>
                          <div>
                            <small>Published WebP</small>
                            <code>{currentPlayfieldPublishedPath ?? "None"}</code>
                          </div>
                          {(selectedPlayfieldAsset?.web1400LocalPath ?? detail.sources.assets.playfield.localWeb1400Path) && (
                            <div>
                              <small>1400 WebP</small>
                              <code>{selectedPlayfieldAsset?.web1400LocalPath ?? detail.sources.assets.playfield.localWeb1400Path}</code>
                            </div>
                          )}
                          {(selectedPlayfieldAsset?.web700LocalPath ?? detail.sources.assets.playfield.localWeb700Path) && (
                            <div>
                              <small>700 WebP</small>
                              <code>{selectedPlayfieldAsset?.web700LocalPath ?? detail.sources.assets.playfield.localWeb700Path}</code>
                            </div>
                          )}
                          {currentPlayfieldOriginalPath && (
                            <div>
                              <small>Original source file</small>
                              <code>{currentPlayfieldOriginalPath}</code>
                            </div>
                          )}
                          {currentPlayfieldReferencePath && (
                            <div>
                              <small>Reference manifest</small>
                              <code>{currentPlayfieldReferencePath}</code>
                            </div>
                          )}
                          {currentPlayfieldSnapshotPath && (
                            <div>
                              <small>Ad snapshot</small>
                              <code>{currentPlayfieldSnapshotPath}</code>
                            </div>
                          )}
                        </div>
                      </details>
                      {pinsideBrowserSession && (
                        <div className="pinside-status-card">
                          <div className="asset-card-head">
                            <div>
                              <h3>Archived image search</h3>
                              <p className="muted pinside-process-line">{pinsideProcessLabel(pinsideBrowserSession)}</p>
                            </div>
                            <div className="inline-button-row">
                              <span className={pinsideBrowserSession.status === "failed" ? "tag muted-tag" : pinsideBrowserSession.active ? "tag accent" : "tag info"}>
                                {pinsideBrowserSession.status}
                              </span>
                              <button
                                className="secondary-button"
                                onClick={handleStopPinsideBrowser}
                                disabled={!pinsideBrowserSession.active || busyAction === "stop-pinside-browser"}
                              >
                                {busyAction === "stop-pinside-browser" ? "Stopping archived search…" : "Stop archived playfields"}
                              </button>
                            </div>
                          </div>
                          <p className="muted">{pinsideStatusSummary(pinsideBrowserSession, detail)}</p>
                          <div className="path-list">
                            <div>
                              <small>Process</small>
                              <code>{pinsideProcessLabel(pinsideBrowserSession)}</code>
                            </div>
                            <div>
                              <small>Viewer</small>
                              <a href={pinsideViewerHref(pinsideBrowserSession)} target="_blank" rel="noreferrer">
                                {pinsideViewerHref(pinsideBrowserSession)}
                              </a>
                            </div>
                            <div>
                              <small>Session</small>
                              <code>
                                {[
                                  pinsideBrowserSession.practiceIdentity === detail.machine.practiceIdentity ? "This game" : pinsideBrowserSession.searchTerm,
                                  pinsideBrowserSession.launchedAt
                                    ? new Date(pinsideBrowserSession.launchedAt).toLocaleTimeString()
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </code>
                            </div>
                            <div>
                              <small>Lookup</small>
                              <code>
                                {[
                                  pinsideBrowserSession.searchMode,
                                  pinsideBrowserSession.machineKey ? `key ${pinsideBrowserSession.machineKey}` : null,
                                  pinsideBrowserSession.machineSlug ? `slug ${pinsideBrowserSession.machineSlug}` : null,
                                  pinsideBrowserSession.resolvedBy,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </code>
                            </div>
                          </div>
                          {pinsideBrowserSession.recentLogLines.length > 0 && (
                            <div className="log-preview">
                              {pinsideBrowserSession.recentLogLines.slice(-4).map((line, index) => (
                                <code key={`${index}-${line}`}>{line}</code>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                        </div>
                      </div>
                    </>
                  )}
                </section>

                <section className="panel compact-panel">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Replace backglass image</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("backglass")} type="button">
                          {machinePanelCollapsed.backglass ? "Expand" : "Collapse"}
                        </button>
                      </div>
                    </div>
                    <div className="panel-header-actions">
                      <button onClick={handleImportBackglassUrl} disabled={busyAction === "import-backglass-url"}>
                        {busyAction === "import-backglass-url" ? "Importing…" : "Import from URL"}
                      </button>
                    </div>
                  </div>
                  {!machinePanelCollapsed.backglass && (
                    <>
                  <div className="form-grid">
                    <label className="field wide">
                      Remote backglass URL
                      <input
                        value={overrideForm.backglassSourceUrl}
                        onChange={(event) => setOverrideForm((current) => ({ ...current, backglassSourceUrl: event.target.value }))}
                        placeholder="https://img.opdb.org/... or better source"
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
                    </>
                  )}
                </section>

                <section className="panel panel-span-full rulesheet-panel">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Replace rulesheet</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("rulesheet")} type="button">
                          {machinePanelCollapsed.rulesheet ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      <p className="muted">Paste better markdown or import a local `.md` file to override what the library currently uses.</p>
                    </div>
                    <button onClick={handleSaveRulesheet} disabled={busyAction === "save-rulesheet"}>
                      {busyAction === "save-rulesheet" ? "Saving…" : "Save markdown"}
                    </button>
                  </div>
                  {!machinePanelCollapsed.rulesheet && (
                    <>
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
                    </>
                  )}
                </section>

                <section className="panel two-up-panel panel-span-full">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Game info & aliases</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("gameinfoAliases")} type="button">
                          {machinePanelCollapsed.gameinfoAliases ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      <p className="muted">PinProf markdown tied to the OPDB group, with alias context on the side.</p>
                    </div>
                    <button onClick={handleSaveGameinfo} disabled={busyAction === "save-gameinfo"}>
                      {busyAction === "save-gameinfo" ? "Saving…" : "Save game info"}
                    </button>
                  </div>
                  {!machinePanelCollapsed.gameinfoAliases && (
                    <>
                  <div>
                    <div className="panel-header slim">
                      <div>
                        <h2>Game info markdown</h2>
                        <p className="muted">This is the canonical PinProf game info asset for the OPDB group.</p>
                      </div>
                    </div>
                    <label className="field upload-field">
                      Upload markdown file from browser
                      <input
                        type="file"
                        accept=".md,.markdown,.txt,text/markdown,text/plain"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleUploadGameinfo(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <label className="field">
                      Markdown
                      <textarea
                        rows={16}
                        value={gameinfoMarkdown}
                        onChange={(event) => setGameinfoMarkdown(event.target.value)}
                        placeholder="# Game info"
                      />
                    </label>
                    <div className="path-list">
                      <div>
                        <small>Game info markdown path</small>
                        <code>{detail.override.gameinfoLocalPath ?? detail.sources.assets.gameinfo.localPath ?? "None"}</code>
                      </div>
                    </div>
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
                    </>
                  )}
                </section>

                <section className="panel panel-span-full">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Memberships</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("memberships")} type="button">
                          {machinePanelCollapsed.memberships ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      <p className="muted">Venue and library rows currently attached to this OPDB game.</p>
                    </div>
                    <span className="pill">{detail.memberships?.length ?? 0} rows</span>
                  </div>
                  {!machinePanelCollapsed.memberships &&
                    (detail.memberships?.length ? (
                    <div className="membership-grid">
                      {detail.memberships.map((membership) => (
                        <article key={membership.libraryEntryId} className="asset-card membership-card">
                          <div className="asset-card-head">
                            <h3>{membership.sourceName}</h3>
                            <span className="tag">{membership.libraryEntryId}</span>
                          </div>
                          <p className="muted">
                            {[
                              membership.area ? `Area ${membership.area}` : null,
                              membership.groupNumber != null ? `Group ${membership.groupNumber}` : null,
                              membership.position != null ? `Position ${membership.position}` : null,
                              membership.bank != null ? `Bank ${membership.bank}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No placement metadata"}
                          </p>
                          <div className="row-tags compact-tags">
                            {membership.playfieldLocalPath && <span className="tag accent">PF local</span>}
                            {membership.rulesheetLocalPath && <span className="tag info">RS local</span>}
                            {membership.gameinfoLocalPath && <span className="tag">GI local</span>}
                            {videoKindSummary(membership.builtInVideoLinks).map((summary) => (
                              <span key={`${membership.libraryEntryId}-${summary}`} className="tag muted-tag">
                                {summary}
                              </span>
                            ))}
                          </div>
                          {membership.builtInRulesheetLinks.length > 0 && (
                            <div className="link-list">
                              {membership.builtInRulesheetLinks.map((link) => (
                                <a key={`${membership.libraryEntryId}-${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                                  {link.label}
                                </a>
                              ))}
                            </div>
                          )}
                          {membership.builtInVideoLinks.length > 0 && (
                            <div className="link-list">
                              {membership.builtInVideoLinks.map((link) => (
                                <a key={`${membership.libraryEntryId}-${link.kind}-${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                                  {link.label}
                                </a>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No venue or library memberships yet.</p>
                  ))}
                </section>

                <section className="panel panel-span-full">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Video & Link Sources</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("videoLinks")} type="button">
                          {machinePanelCollapsed.videoLinks ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      <p className="muted">Machine-wide links from catalog providers and manual overrides.</p>
                    </div>
                  </div>
                  {!machinePanelCollapsed.videoLinks && (
                    <div className="link-source-grid">
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Catalog Videos</h3>
                        <span className="pill">{detail.links?.catalogVideos.length ?? 0}</span>
                      </div>
                      {detail.links?.catalogVideos.length ? (
                        <>
                          <div className="row-tags compact-tags">
                            {videoKindSummary(detail.links.catalogVideos).map((summary) => (
                              <span key={`catalog-${summary}`} className="tag muted-tag">
                                {summary}
                              </span>
                            ))}
                          </div>
                          <div className="link-list">
                            {detail.links.catalogVideos.map((link) => (
                              <a key={`catalog-${link.provider}-${link.kind}-${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                                {link.provider ? `${link.provider} · ${link.label}` : link.label}
                              </a>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="muted">No catalog videos yet.</p>
                      )}
                    </article>
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Override Videos</h3>
                        <span className="pill">{videoOverrideDrafts.length}</span>
                      </div>
                      <p className="muted">Add the manual tutorial, gameplay, and competition links that should ship with this game.</p>
                      <div className="inline-button-row">
                        <button type="button" className="secondary-button" onClick={addVideoOverrideDraft}>
                          Add video
                        </button>
                        <button type="button" onClick={handleSaveVideoOverrides} disabled={busyAction === "save-video-overrides"}>
                          {busyAction === "save-video-overrides" ? "Saving…" : "Save videos"}
                        </button>
                      </div>
                      {videoOverrideDrafts.length ? (
                        <div className="video-override-list">
                          {videoOverrideDrafts.map((draft, index) => (
                            <div key={draft.draftId} className="video-override-row">
                              <div className="form-grid">
                                <label className="field">
                                  Kind
                                  <select
                                    value={draft.kind}
                                    onChange={(event) =>
                                      updateVideoOverrideDraft(draft.draftId, { kind: event.target.value as VideoKind })
                                    }
                                  >
                                    <option value="tutorial">Tutorial</option>
                                    <option value="gameplay">Gameplay</option>
                                    <option value="competition">Competition</option>
                                  </select>
                                </label>
                                <label className="field">
                                  Label
                                  <input
                                    value={draft.label}
                                    onChange={(event) => updateVideoOverrideDraft(draft.draftId, { label: event.target.value })}
                                    placeholder="Match Play tutorial / Bowen gameplay / finals match"
                                  />
                                </label>
                                <label className="field wide">
                                  URL
                                  <input
                                    value={draft.url}
                                    onChange={(event) => updateVideoOverrideDraft(draft.draftId, { url: event.target.value })}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                  />
                                </label>
                              </div>
                              <div className="video-override-controls">
                                <span className="pill">#{index + 1}</span>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => moveVideoOverrideDraft(draft.draftId, "up")}
                                  disabled={index === 0}
                                >
                                  Up
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => moveVideoOverrideDraft(draft.draftId, "down")}
                                  disabled={index === videoOverrideDrafts.length - 1}
                                >
                                  Down
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => removeVideoOverrideDraft(draft.draftId)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No manual override videos yet.</p>
                      )}
                    </article>
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Catalog Rulesheets</h3>
                        <span className="pill">{detail.links?.catalogRulesheetLinks.length ?? 0}</span>
                      </div>
                      {detail.links?.catalogRulesheetLinks.length ? (
                        <div className="link-list">
                          {detail.links.catalogRulesheetLinks.map((link) => (
                            <a key={`catalog-rulesheet-${link.provider}-${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                              {link.provider ? `${link.provider} · ${link.label}` : link.label}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No catalog rulesheet links yet.</p>
                      )}
                    </article>
                    <article className="asset-card">
                      <div className="asset-card-head">
                        <h3>Override Rulesheets</h3>
                        <span className="pill">{detail.links?.overrideRulesheetLinks.length ?? 0}</span>
                      </div>
                      {detail.links?.overrideRulesheetLinks.length ? (
                        <div className="link-list">
                          {detail.links.overrideRulesheetLinks.map((link) => (
                            <a key={`override-rulesheet-${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                              {link.label}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No manual override rulesheet links yet.</p>
                      )}
                    </article>
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Current asset stack</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("assetStack")} type="button">
                          {machinePanelCollapsed.assetStack ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      <p className="muted">See exactly what the web/app would use right now, and where it came from.</p>
                    </div>
                    <span className="pill">{detail.sources.aliases.length} OPDB aliases</span>
                  </div>
                  {!machinePanelCollapsed.assetStack && (
                    <div className="asset-grid">
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
                  )}
                </section>

                <section className="panel compact-panel">
                  <div className="panel-header">
                    <div className="panel-header-title-group">
                      <div className="panel-header-title-row">
                        <h2>Metadata overrides</h2>
                        <button className="secondary-button" onClick={() => toggleMachinePanel("metadata")} type="button">
                          {machinePanelCollapsed.metadata ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      <p className="muted">These fields reapply into the generated seed DB after every sync.</p>
                    </div>
                    <button onClick={handleSaveMetadata} disabled={busyAction === "save-metadata"}>
                      {busyAction === "save-metadata" ? "Saving…" : "Save metadata"}
                    </button>
                  </div>
                  {!machinePanelCollapsed.metadata && (
                    <>
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
                    </>
                  )}
                </section>
              </div>
            </>
          )}
          {!detail && !loadingDetail && selectedMachine && (
            <div className="empty-state">Unable to load {displayTitle(selectedMachine)}.</div>
          )}
        </section>
        {!activityCollapsed && (
          <aside className="sidebar sidebar-right">
            <section className="sidebar-block activity-block">
              <div className="panel-header slim">
                <h2>Recent activity</h2>
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
        )}
        <button
          className={`sidebar-toggle sidebar-toggle-right ${activityCollapsed ? "collapsed" : ""}`}
          onClick={() => setActivityCollapsed((current) => !current)}
          type="button"
          aria-label={activityCollapsed ? "Expand recent activity sidebar" : "Collapse recent activity sidebar"}
        >
          <span>{activityCollapsed ? "<" : ">"}</span>
          <small>Activity</small>
        </button>
      </main>
      )}
      {detail && maskEditorOverlayOpen && (
        <div
          className="playfield-mask-overlay"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setMaskEditorOverlayOpen(false);
            }
          }}
        >
          <div className="playfield-mask-dialog" role="dialog" aria-modal="true" aria-label="Polygon mask editor">
            <div className="playfield-mask-dialog-header">
              <div>
                <h2>Polygon mask editor</h2>
                <p className="muted">
                  Click around the playfield outline to build a polygon. The inside is kept; the inverse is replaced with black.
                </p>
              </div>
              <div className="panel-header-actions">
                <span className="tag info">
                  {playfieldMaskDraft.length} point{playfieldMaskDraft.length === 1 ? "" : "s"}
                </span>
                <button className="secondary-button" onClick={() => setMaskEditorOverlayOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="playfield-mask-dialog-grid">
              <div className="playfield-mask-panel playfield-mask-editor-card">
                <div className="asset-card-head">
                  <h3>Mask editor</h3>
                  <span className="tag info">
                    {playfieldMaskDraft.length} point{playfieldMaskDraft.length === 1 ? "" : "s"}
                  </span>
                </div>
                {maskEditorEnabled && maskEditorImageUrl ? (
                  <>
                    <div
                      ref={maskStageRef}
                      className="playfield-mask-stage"
                      onPointerDown={addMaskPoint}
                    >
                      <div className="playfield-mask-image-shell">
                        <img
                          ref={maskStageImageRef}
                          src={maskEditorImageUrl}
                          alt={`${displayTitle(detail.machine)} editor source`}
                          onLoad={() => setMaskImageLoadedAt(Date.now())}
                        />
                      </div>
                      <svg
                        viewBox={`0 0 ${maskStageMetrics?.stageWidth ?? 100} ${maskStageMetrics?.stageHeight ?? 100}`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {playfieldMaskDraft.length >= 3 && maskStagePoints.length === playfieldMaskDraft.length && (
                          <polygon
                            points={maskStagePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                            className="mask-polygon"
                          />
                        )}
                        {playfieldMaskDraft.map((point, index) => (
                          <Fragment key={`${index}-${point.x}-${point.y}`}>
                            {index > 0 && maskStagePoints[index - 1] && maskStagePoints[index] && (
                              <line
                                x1={maskStagePoints[index - 1].x}
                                y1={maskStagePoints[index - 1].y}
                                x2={maskStagePoints[index].x}
                                y2={maskStagePoints[index].y}
                                className="mask-edge"
                              />
                            )}
                            {index === 0 && playfieldMaskDraft.length >= 3 && maskStagePoints[playfieldMaskDraft.length - 1] && maskStagePoints[0] && (
                              <line
                                x1={maskStagePoints[playfieldMaskDraft.length - 1].x}
                                y1={maskStagePoints[playfieldMaskDraft.length - 1].y}
                                x2={maskStagePoints[0].x}
                                y2={maskStagePoints[0].y}
                                className="mask-edge"
                              />
                            )}
                            <circle
                              cx={maskStagePoints[index]?.x ?? 0}
                              cy={maskStagePoints[index]?.y ?? 0}
                              r={7}
                              className="mask-point"
                              data-mask-point="true"
                              onPointerDown={(event) => startMaskPointDrag(event, index)}
                            />
                          </Fragment>
                        ))}
                      </svg>
                      {activeMaskStagePoint && (
                        <div
                          className="mask-magnifier"
                          style={{
                            left: `${activeMaskStagePoint.x + (activeMaskStagePoint.x > (maskStageMetrics?.stageWidth ?? 0) - 170 ? -154 : 18)}px`,
                            top: `${activeMaskStagePoint.y + (activeMaskStagePoint.y > (maskStageMetrics?.stageHeight ?? 0) - 170 ? -154 : 18)}px`,
                          }}
                        >
                          <canvas ref={maskMagnifierCanvasRef} width={160} height={160} />
                          <div className="mask-magnifier-crosshair" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="playfield-mask-actions">
                      <button
                        className="secondary-button"
                        onClick={removeLastMaskPoint}
                        disabled={!playfieldMaskDraft.length || busyAction === "save-playfield-mask" || busyAction === "clear-playfield-mask"}
                      >
                        Remove last point
                      </button>
                      <button
                        className="secondary-button"
                        onClick={resetMaskDraft}
                        disabled={!maskDraftChanged || busyAction === "save-playfield-mask" || busyAction === "clear-playfield-mask"}
                      >
                        Reset draft
                      </button>
                      <button
                        className="secondary-button"
                        onClick={handleClearPlayfieldMask}
                        disabled={busyAction === "save-playfield-mask" || busyAction === "clear-playfield-mask"}
                      >
                        {busyAction === "clear-playfield-mask" ? "Clearing…" : "Clear mask"}
                      </button>
                      <button
                        onClick={handleSavePlayfieldMask}
                        disabled={playfieldMaskDraft.length < 3 || !maskDraftChanged || busyAction === "save-playfield-mask" || busyAction === "clear-playfield-mask"}
                      >
                        {busyAction === "save-playfield-mask" ? "Saving mask…" : "Save mask"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="image-fallback">Import or upload a local source image for this alias before editing a polygon mask.</div>
                )}
              </div>
              <div className="playfield-preview-card">
                <div className="asset-card-head">
                  <h3>Masked preview</h3>
                  <span className="tag info">Draft</span>
                </div>
                {maskEditorEnabled && maskEditorImageUrl ? (
                  maskPreviewClipPath ? (
                    <div className="playfield-mask-preview-frame">
                      <img
                        src={maskEditorImageUrl}
                        alt={`${displayTitle(detail.machine)} masked draft preview`}
                        className="playfield-mask-preview-image"
                        style={{ clipPath: maskPreviewClipPath }}
                      />
                    </div>
                  ) : (
                    <div className="image-fallback">Add at least 3 points to preview the masked result.</div>
                  )
                ) : (
                  <div className="image-fallback">A local source image is required for preview.</div>
                )}
                <p className="muted">This preview shows the inside of your polygon on a black background before regeneration.</p>
              </div>
              <div className="playfield-preview-card">
                <div className="asset-card-head">
                  <h3>Current published</h3>
                  <span className="tag accent">Saved</span>
                </div>
                {publishedPlayfieldPreviewUrl ? (
                  <div className="playfield-mask-preview-frame">
                    <img
                      key={publishedPlayfieldPreviewUrl}
                      src={publishedPlayfieldPreviewUrl}
                      alt={`${displayTitle(detail.machine)} current published playfield`}
                      className="playfield-mask-preview-image"
                    />
                  </div>
                ) : (
                  <div className="image-fallback">No published playfield exists yet for this alias.</div>
                )}
                <p className="muted">After you save the mask, this published version refreshes and becomes the site-ready output.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
