#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHARED_PINBALL_DIR = ROOT / "shared" / "pinball"
SHARED_DATA_DIR = SHARED_PINBALL_DIR / "data"
SEED_DB_PATH = SHARED_DATA_DIR / "pinball_library_seed_v1.sqlite"
OUTPUT_PATH = SHARED_DATA_DIR / "pinball_library_seed_overrides_v1.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_string(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None


def web_path_to_fs(web_path: str | None) -> Path | None:
    clean = clean_string(web_path)
    if not clean or not clean.startswith("/pinball/"):
        return None
    return SHARED_PINBALL_DIR / clean.removeprefix("/pinball/")


def existing_local_path(web_path: str | None) -> str | None:
    fs_path = web_path_to_fs(web_path)
    if fs_path is None or not fs_path.is_file():
        return None
    return clean_string(web_path)


@dataclass
class PreferredAlias:
    practice_identity: str
    opdb_group_id: str | None
    opdb_machine_id: str | None


def parse_opdb_id_parts(opdb_id: str | None) -> dict[str, str | None]:
    clean = clean_string(opdb_id)
    if not clean:
        return {"full_id": None, "group_id": None, "machine_id": None, "alias_id": None}
    parts = clean.split("-")
    group_id = parts[0] if parts else None
    machine_part = next((part for part in parts if part.startswith("M")), None)
    alias_part = next((part for part in parts if part.startswith("A")), None)
    machine_id = f"{group_id}-{machine_part}" if group_id and machine_part else group_id
    return {
        "full_id": clean,
        "group_id": group_id,
        "machine_id": machine_id,
        "alias_id": clean if alias_part else None,
    }


def score_playfield_source_match(requested_opdb_id: str | None, source_opdb_id: str | None) -> int:
    requested = parse_opdb_id_parts(requested_opdb_id)
    source = parse_opdb_id_parts(source_opdb_id)
    if not requested["full_id"] or not source["full_id"] or requested["group_id"] != source["group_id"]:
        return -1
    if requested["full_id"] == source["full_id"]:
        return 500
    if requested["machine_id"] and source["full_id"] == requested["machine_id"]:
        return 460
    if requested["machine_id"] and source["machine_id"] == requested["machine_id"]:
        return 440 if source["alias_id"] else 450
    if source["machine_id"] == source["group_id"] and not source["alias_id"]:
        return 300
    if source["alias_id"]:
        return 240
    return 250


def load_preferred_aliases(seed_db: sqlite3.Connection) -> dict[str, PreferredAlias]:
    rows = seed_db.execute(
        """
        SELECT practiceIdentity, opdbGroupId, opdbMachineId
        FROM (
          SELECT
            practice_identity AS practiceIdentity,
            opdb_group_id AS opdbGroupId,
            opdb_machine_id AS opdbMachineId,
            ROW_NUMBER() OVER (
              PARTITION BY practice_identity
              ORDER BY
                CASE WHEN variant IS NULL OR trim(variant) = '' THEN 0 ELSE 1 END,
                lower(coalesce(variant, '')),
                lower(opdb_machine_id)
            ) AS rank_index
          FROM machines
        )
        WHERE rank_index = 1
        """
    ).fetchall()
    return {
        row["practiceIdentity"]: PreferredAlias(
            practice_identity=row["practiceIdentity"],
            opdb_group_id=clean_string(row["opdbGroupId"]),
            opdb_machine_id=clean_string(row["opdbMachineId"]),
        )
        for row in rows
    }


def load_override_rows(seed_db: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    rows = seed_db.execute(
        """
        SELECT practice_identity, playfield_local_path, playfield_source_url
        FROM overrides
        """
    ).fetchall()
    return {row["practice_identity"]: row for row in rows}


def load_playfield_asset_rows(seed_db: sqlite3.Connection) -> dict[str, list[sqlite3.Row]]:
    rows = seed_db.execute(
        """
        SELECT
          practice_identity,
          source_opdb_machine_id,
          playfield_local_path,
          playfield_source_url,
          updated_at
        FROM playfield_assets
        """
    ).fetchall()
    grouped: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        grouped.setdefault(row["practice_identity"], []).append(row)
    return grouped


def pick_primary_asset(preferred_alias_id: str | None, assets: list[sqlite3.Row]) -> sqlite3.Row | None:
    best_row: sqlite3.Row | None = None
    best_score = -1
    for row in assets:
        if existing_local_path(row["playfield_local_path"]) is None:
            continue
        score = score_playfield_source_match(preferred_alias_id, clean_string(row["source_opdb_machine_id"]))
        if score > best_score:
            best_row = row
            best_score = score
    if best_row is not None:
        return best_row
    for row in assets:
        if existing_local_path(row["playfield_local_path"]) is not None:
            return row
    return None


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not SEED_DB_PATH.is_file():
        raise FileNotFoundError(f"Missing seed DB: {SEED_DB_PATH}")

    with sqlite3.connect(SEED_DB_PATH) as seed_db:
        seed_db.row_factory = sqlite3.Row
        preferred_aliases = load_preferred_aliases(seed_db)
        override_rows = load_override_rows(seed_db)
        playfield_assets = load_playfield_asset_rows(seed_db)

        items: list[dict[str, str | None]] = []
        for practice_identity, preferred in preferred_aliases.items():
            primary_asset = pick_primary_asset(preferred.opdb_machine_id, playfield_assets.get(practice_identity, []))
            override = override_rows.get(practice_identity)
            local_path = (
                existing_local_path(primary_asset["playfield_local_path"]) if primary_asset is not None else None
            ) or existing_local_path(override["playfield_local_path"] if override is not None else None)
            source_url = clean_string(primary_asset["playfield_source_url"]) if primary_asset is not None else None
            if source_url is None and override is not None:
                source_url = clean_string(override["playfield_source_url"])
            if local_path is None and source_url is None:
                continue
            items.append(
                {
                    "practiceIdentity": practice_identity,
                    "opdbGroupId": preferred.opdb_group_id or practice_identity,
                    "playfieldLocalPath": local_path,
                    "playfieldSourceUrl": source_url,
                }
            )

    items.sort(key=lambda row: ((row["opdbGroupId"] or "").lower(), (row["practiceIdentity"] or "").lower()))
    OUTPUT_PATH.write_text(json.dumps({"generatedAt": now_iso(), "playfieldOverrides": items}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} playfield override row(s) to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
