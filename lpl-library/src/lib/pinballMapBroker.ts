const PINBALL_MAP_BROKER_URL = "https://pinprof.com/pinball/api/pinball-map.php";
const PINBALL_MAP_BROKER_SCHEMA_VERSION = 1;

export type PinballMapMappingStatus = "mapped_exact" | "missing_opdb_id" | "catalog_record_missing";

export type PinballMapBrokerVenue = {
  id: number;
  name: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number | null;
  machineCount: number;
  dateLastUpdated: string | null;
  updatedAt: string | null;
};

export type PinballMapBrokerMachine = {
  pinballMapId: number;
  opdbId: string | null;
  name: string | null;
  manufacturer: string | null;
  year: number | null;
  mappingStatus: PinballMapMappingStatus;
};

export type PinballMapBrokerRoster = {
  location: PinballMapBrokerVenue;
  machines: PinballMapBrokerMachine[];
  mappedOpdbIds: string[];
  unmappedCount: number;
  rosterComplete: boolean;
};

type BrokerEnvelope<T> = {
  schemaVersion?: number;
  requestId?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    retryAfterSeconds?: number | null;
  };
};

export class PinballMapBrokerError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    code: string,
    retryable: boolean,
    retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = "PinballMapBrokerError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizedNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mappingStatus(value: unknown): PinballMapMappingStatus | null {
  return value === "mapped_exact" || value === "missing_opdb_id" || value === "catalog_record_missing"
    ? value
    : null;
}

function decodeVenue(value: unknown): PinballMapBrokerVenue | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = normalizedNumber(raw.id);
  const name = normalizedString(raw.name);
  if (id == null || id <= 0 || !name) return null;
  return {
    id,
    name,
    street: normalizedString(raw.street),
    city: normalizedString(raw.city),
    state: normalizedString(raw.state),
    zip: normalizedString(raw.zip),
    latitude: normalizedNumber(raw.latitude),
    longitude: normalizedNumber(raw.longitude),
    distanceMiles: normalizedNumber(raw.distanceMiles),
    machineCount: Math.max(0, Math.trunc(normalizedNumber(raw.machineCount) ?? 0)),
    dateLastUpdated: normalizedString(raw.dateLastUpdated),
    updatedAt: normalizedString(raw.updatedAt),
  };
}

function decodeMachine(value: unknown): PinballMapBrokerMachine | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const pinballMapId = normalizedNumber(raw.pinballMapId);
  const status = mappingStatus(raw.mappingStatus);
  if (pinballMapId == null || pinballMapId <= 0 || !status) return null;
  const opdbId = normalizedString(raw.opdbId);
  if ((status === "mapped_exact") !== Boolean(opdbId)) return null;
  return {
    pinballMapId,
    opdbId,
    name: normalizedString(raw.name),
    manufacturer: normalizedString(raw.manufacturer),
    year: normalizedNumber(raw.year),
    mappingStatus: status,
  };
}

async function postBroker<T>(action: string, input: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(PINBALL_MAP_BROKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      body: JSON.stringify({
        schemaVersion: PINBALL_MAP_BROKER_SCHEMA_VERSION,
        action,
        input,
        client: { surface: "pillyliu-library" },
      }),
    });
    let root: BrokerEnvelope<T>;
    try {
      root = await response.json() as BrokerEnvelope<T>;
    } catch {
      throw new PinballMapBrokerError("Pinball Map returned an unreadable response.", "INVALID_RESPONSE", true, null);
    }
    if (root.schemaVersion !== PINBALL_MAP_BROKER_SCHEMA_VERSION) {
      throw new PinballMapBrokerError("Pinball Map returned an unsupported response.", "INVALID_RESPONSE", false, null);
    }
    if (!response.ok || root.error) {
      throw new PinballMapBrokerError(
        normalizedString(root.error?.message) ?? "Pinball Map is temporarily unavailable.",
        normalizedString(root.error?.code) ?? `HTTP_${response.status}`,
        root.error?.retryable === true,
        normalizedNumber(root.error?.retryAfterSeconds),
      );
    }
    if (root.data === undefined) {
      throw new PinballMapBrokerError("Pinball Map returned an incomplete response.", "INVALID_RESPONSE", true, null);
    }
    return root.data;
  } catch (error) {
    if (error instanceof PinballMapBrokerError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PinballMapBrokerError("Pinball Map lookup timed out.", "TIMEOUT", true, null);
    }
    throw new PinballMapBrokerError("Pinball Map is temporarily unavailable.", "NETWORK_ERROR", true, null);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function brokerSearchPinballMapVenues(address: string, radiusMiles: number): Promise<PinballMapBrokerVenue[]> {
  const data = await postBroker<{ locations?: unknown[] }>("search_address", { address, radiusMiles });
  return (Array.isArray(data.locations) ? data.locations : [])
    .map(decodeVenue)
    .filter((venue): venue is PinballMapBrokerVenue => venue !== null);
}

export async function brokerFetchPinballMapRoster(locationId: number): Promise<PinballMapBrokerRoster> {
  const data = await postBroker<Record<string, unknown>>("location_roster", { locationId });
  const location = decodeVenue(data.location);
  if (!location) {
    throw new PinballMapBrokerError("Pinball Map returned an incomplete venue.", "INVALID_RESPONSE", true, null);
  }
  const machines = (Array.isArray(data.machines) ? data.machines : [])
    .map(decodeMachine)
    .filter((machine): machine is PinballMapBrokerMachine => machine !== null);
  if (data.rosterComplete === false || machines.some((machine) => machine.mappingStatus === "catalog_record_missing")) {
    throw new PinballMapBrokerError(
      "Pinball Map could not return the complete venue lineup. Please try again.",
      "INCOMPLETE_ROSTER",
      true,
      null,
    );
  }
  const mappedOpdbIds = machines
    .filter((machine) => machine.mappingStatus === "mapped_exact")
    .map((machine) => machine.opdbId)
    .filter((id): id is string => Boolean(id));
  return {
    location,
    machines,
    mappedOpdbIds,
    unmappedCount: machines.filter((machine) => machine.mappingStatus !== "mapped_exact").length,
    rosterComplete: true,
  };
}
