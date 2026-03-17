#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AVENUE_SOURCE_IDS = {"venue--pm-8760", "venue--the-avenue-cafe", "the-avenue"}


ALIASES = {
    "tmnt": ["teenagemutantninjaturtles"],
    "thegetaway": ["thegetawayhighspeedii"],
    "starwars2017": ["starwars"],
    "jurassicparkstern2019": ["jurassicpark", "jurassicpark2019"],
    "attackfrommars": ["attackfrommarsremake"],
    "dungeonsanddragons": ["dungeonsdragons", "dungeonsanddragonsthetyrantseye"],
    "uncannyxmen": ["theuncannyxmen"],
    "jamesbond": ["jamesbond007"],
    "indianajones": ["indianajonesthepinballadventure"],
    "tron": ["tronlegacy"],
    "fallempire": ["starwarsfallempire"],
    "falloftheempire": ["starwarsfallempire"],
    "kingkong": ["kingkongmythofterrorisland"],
}


def normalize_name(value: str) -> str:
    lowered = value.lower().replace("&", " and ")
    lowered = re.sub(r"\([^)]*\)", " ", lowered)
    lowered = re.sub(r"[^a-z0-9]+", "", lowered)
    return lowered.strip()


def candidate_keys(value: str) -> list[str]:
    normalized = normalize_name(value)
    if not normalized:
        return []
    return [normalized, *ALIASES.get(normalized, [])]


def parse_int(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def parse_score(value: str) -> int | None:
    text = (value or "").replace(",", "").strip()
    if not text:
        return None
    try:
        return int(round(float(text)))
    except ValueError:
        return None


@dataclass
class LibraryTargetEntry:
    game: str
    normalized_name: str
    practice_identity: str | None
    opdb_id: str | None
    source_id: str | None
    area: str | None
    area_order: int | None
    group: int | None
    position: int | None
    bank: int | None
    sort_index: int


def score_entry(entry: LibraryTargetEntry) -> int:
    score = 0
    if entry.source_id in AVENUE_SOURCE_IDS:
        score += 1000
    if entry.bank and entry.bank > 0:
        score += 100
    if entry.area:
        score += 20
    if entry.group is not None:
        score += 10
    if entry.position is not None:
        score += 10
    if entry.practice_identity:
        score += 5
    return score


def match_score(keys: list[str], entry: LibraryTargetEntry) -> int:
    if not keys or not entry.normalized_name:
        return -1
    best = -1
    for key in keys:
        if entry.normalized_name == key:
            best = max(best, 10000)
        elif entry.normalized_name in key or key in entry.normalized_name:
            overlap_bonus = min(len(entry.normalized_name), len(key))
            best = max(best, 5000 + overlap_bonus)
    return best


def pick_best_entry(target_game: str, entries: list[LibraryTargetEntry]) -> LibraryTargetEntry | None:
    keys = candidate_keys(target_game)
    if not keys:
        return None

    ranked: list[tuple[int, int, int, LibraryTargetEntry]] = []
    for entry in entries:
        score = match_score(keys, entry)
        if score < 0:
            continue
        ranked.append((score, score_entry(entry), -entry.sort_index, entry))

    if not ranked:
        return None

    ranked.sort(reverse=True)
    return ranked[0][3]


def load_library_entries(library_json_path: Path) -> list[LibraryTargetEntry]:
    root = json.loads(library_json_path.read_text(encoding="utf-8"))
    items = root.get("items") if isinstance(root, dict) else []
    if not isinstance(items, list):
        return []

    entries: list[LibraryTargetEntry] = []
    for index, raw_item in enumerate(items):
        if not isinstance(raw_item, dict):
            continue
        source_id = str(raw_item.get("library_id") or raw_item.get("sourceId") or "").strip() or None
        if source_id not in AVENUE_SOURCE_IDS:
            continue
        game = str(raw_item.get("game") or "").strip()
        if not game:
            continue
        entries.append(
            LibraryTargetEntry(
                game=game,
                normalized_name=normalize_name(game),
                practice_identity=str(raw_item.get("practice_identity") or "").strip() or None,
                opdb_id=str(raw_item.get("opdb_id") or "").strip() or None,
                source_id=source_id,
                area=str(raw_item.get("area") or "").strip() or None,
                area_order=parse_int(raw_item.get("area_order")),
                group=parse_int(raw_item.get("group")),
                position=parse_int(raw_item.get("position")),
                bank=parse_int(raw_item.get("bank")),
                sort_index=index,
            )
        )
    return entries


def load_pm_default_source_entries(library_json_path: Path) -> list[LibraryTargetEntry]:
    data_dir = library_json_path.parent
    default_sources_path = data_dir / "default_pm_venue_sources_v1.json"
    catalog_path = data_dir / "opdb_catalog_v1.json"
    overlays_path = data_dir / "venue_metadata_overlays_v1.json"
    if not default_sources_path.exists() or not catalog_path.exists():
        return []

    default_root = json.loads(default_sources_path.read_text(encoding="utf-8"))
    catalog_root = json.loads(catalog_path.read_text(encoding="utf-8"))
    overlays_root = (
        json.loads(overlays_path.read_text(encoding="utf-8"))
        if overlays_path.exists()
        else {"layout_areas": [], "machine_layout": [], "machine_bank": []}
    )

    avenue_source = next(
        (
            record
            for record in default_root.get("records", [])
            if isinstance(record, dict) and str(record.get("id") or "").strip() in AVENUE_SOURCE_IDS
        ),
        None,
    )
    if not isinstance(avenue_source, dict):
        return []

    machines_by_id: dict[str, dict[str, Any]] = {}
    for row in catalog_root.get("machines", []):
        if not isinstance(row, dict):
            continue
        opdb_machine_id = str(row.get("opdb_machine_id") or "").strip()
        if opdb_machine_id:
            machines_by_id[opdb_machine_id] = row

    area_order_by_key: dict[tuple[str, str], int] = {}
    for row in overlays_root.get("layout_areas", []):
        if not isinstance(row, dict):
            continue
        source_id = str(row.get("source_id") or "").strip()
        area = str(row.get("area") or "").strip()
        area_order = parse_int(row.get("area_order"))
        if source_id and area and area_order is not None:
            area_order_by_key[(source_id, area)] = area_order

    machine_layout_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in overlays_root.get("machine_layout", []):
        if not isinstance(row, dict):
            continue
        source_id = str(row.get("source_id") or "").strip()
        opdb_id = str(row.get("opdb_id") or "").strip()
        if source_id and opdb_id:
            machine_layout_by_key[(source_id, opdb_id)] = row

    machine_bank_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in overlays_root.get("machine_bank", []):
        if not isinstance(row, dict):
            continue
        source_id = str(row.get("source_id") or "").strip()
        opdb_id = str(row.get("opdb_id") or "").strip()
        if source_id and opdb_id:
            machine_bank_by_key[(source_id, opdb_id)] = row

    source_id = str(avenue_source.get("id") or "").strip()
    entries: list[LibraryTargetEntry] = []
    for index, opdb_id in enumerate(avenue_source.get("machineIds", [])):
        machine_id = str(opdb_id or "").strip()
        machine = machines_by_id.get(machine_id)
        if not machine:
            continue
        game = str(machine.get("name") or "").strip()
        if not game:
            continue
        layout = (
            machine_layout_by_key.get((source_id, machine_id))
            or machine_layout_by_key.get((source_id, str(machine.get("opdb_group_id") or "").strip()))
            or machine_layout_by_key.get((source_id, str(machine.get("practice_identity") or "").strip()))
        )
        bank = (
            machine_bank_by_key.get((source_id, machine_id))
            or machine_bank_by_key.get((source_id, str(machine.get("opdb_group_id") or "").strip()))
            or machine_bank_by_key.get((source_id, str(machine.get("practice_identity") or "").strip()))
        )
        area = str((layout or {}).get("area") or "").strip() or None
        entries.append(
            LibraryTargetEntry(
                game=game,
                normalized_name=normalize_name(game),
                practice_identity=str(machine.get("practice_identity") or "").strip() or None,
                opdb_id=machine_id,
                source_id=source_id,
                area=area,
                area_order=area_order_by_key.get((source_id, area)) if area else None,
                group=parse_int((layout or {}).get("group_number")),
                position=parse_int((layout or {}).get("position")),
                bank=parse_int((bank or {}).get("bank")),
                sort_index=index,
            )
        )
    return entries


def build_resolved_targets(targets_csv_path: Path, library_json_path: Path) -> dict[str, Any]:
    library_entries = load_library_entries(library_json_path)
    if not library_entries:
        library_entries = load_pm_default_source_entries(library_json_path)
    rows: list[dict[str, Any]] = []

    with targets_csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for order, row in enumerate(reader):
            game = str(row.get("game") or "").strip()
            if not game:
                continue
            second = parse_score(str(row.get("second_highest_avg") or ""))
            fourth = parse_score(str(row.get("fourth_highest_avg") or ""))
            eighth = parse_score(str(row.get("eighth_highest_avg") or ""))
            if second is None or fourth is None or eighth is None:
                continue

            matched = pick_best_entry(game, library_entries)
            rows.append(
                {
                    "order": order,
                    "game": game,
                    "practice_identity": matched.practice_identity if matched else None,
                    "opdb_id": matched.opdb_id if matched else None,
                    "source_id": matched.source_id if matched else None,
                    "area": matched.area if matched else None,
                    "area_order": matched.area_order if matched else None,
                    "group": matched.group if matched else None,
                    "position": matched.position if matched else None,
                    "bank": matched.bank if matched else None,
                    "second_highest_avg": second,
                    "fourth_highest_avg": fourth,
                    "eighth_highest_avg": eighth,
                }
            )

    return {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "targets_csv": str(targets_csv_path),
        "library_json": str(library_json_path),
        "items": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a resolved LPL targets dataset keyed by practice identity.")
    parser.add_argument("--targets-csv", required=True, help="Path to LPL_Targets.csv")
    parser.add_argument("--library-json", required=True, help="Path to pinball_library_v3.json")
    parser.add_argument("--output", required=True, help="Output JSON path")
    args = parser.parse_args()

    targets_csv_path = Path(args.targets_csv).expanduser().resolve()
    library_json_path = Path(args.library_json).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = build_resolved_targets(targets_csv_path, library_json_path)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    matched = sum(1 for row in payload["items"] if row.get("practice_identity"))
    total = len(payload["items"])
    print(f"Wrote {output_path} ({matched}/{total} matched)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
