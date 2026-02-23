"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var papaparse_1 = require("papaparse");
var SHARED_PINBALL_DIR = node_path_1.default.resolve("../shared/pinball");
var SHARED_PINBALL_DATA_DIR = node_path_1.default.join(SHARED_PINBALL_DIR, "data");
var SHARED_PINBALL_IMAGES_DIR = node_path_1.default.join(SHARED_PINBALL_DIR, "images", "playfields");
var SHARED_PINBALL_RULESHEETS_DIR = node_path_1.default.join(SHARED_PINBALL_DIR, "rulesheets");
var SHARED_PINBALL_GAMEINFO_DIR = node_path_1.default.join(SHARED_PINBALL_DIR, "gameinfo");
var SUPPORTED_PLAYFIELD_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
var PINSIDE_GROUP_NONE_MARKER = "~";
function slugify(input) {
    return input
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
}
function toIntOrNull(v) {
    var s = String(v !== null && v !== void 0 ? v : "").trim();
    if (!s)
        return null;
    var n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}
function cleanString(v) {
    var s = String(v !== null && v !== void 0 ? v : "").trim();
    return s || null;
}
function cleanPinsideGroup(v) {
    var s = String(v !== null && v !== void 0 ? v : "").trim();
    if (!s || s === PINSIDE_GROUP_NONE_MARKER)
        return null;
    return s;
}
function cleanUrl(v) {
    var s = String(v !== null && v !== void 0 ? v : "").trim();
    return s || null;
}
function normalizeHeader(header) {
    return header.trim().toLowerCase();
}
function getHeaderValue(row) {
    var _a;
    var keys = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        keys[_i - 1] = arguments[_i];
    }
    for (var _b = 0, keys_1 = keys; _b < keys_1.length; _b++) {
        var key = keys_1[_b];
        if (key in row)
            return String((_a = row[key]) !== null && _a !== void 0 ? _a : "");
    }
    var keyMap = new Map();
    for (var _c = 0, _d = Object.entries(row); _c < _d.length; _c++) {
        var _e = _d[_c], k = _e[0], v = _e[1];
        keyMap.set(normalizeHeader(k), v);
    }
    for (var _f = 0, keys_2 = keys; _f < keys_2.length; _f++) {
        var key = keys_2[_f];
        var v = keyMap.get(normalizeHeader(key));
        if (v != null)
            return String(v);
    }
    return "";
}
function detectLibraryType(row) {
    var pmLocationId = cleanString(getHeaderValue(row, "PM_location_id"));
    var venue = cleanString(getHeaderValue(row, "Venue"));
    if (pmLocationId || venue)
        return "venue";
    return "manufacturer";
}
function buildLibraryIdentity(row) {
    var libraryType = detectLibraryType(row);
    if (libraryType === "venue") {
        var venueName = cleanString(getHeaderValue(row, "Venue")) ||
            cleanString(getHeaderValue(row, "Venue Location")) ||
            "Unknown Venue";
        return {
            libraryType: libraryType,
            libraryName: venueName,
            libraryId: "venue--".concat(slugify(venueName)),
        };
    }
    var manufacturer = cleanString(getHeaderValue(row, "Manufacturer")) || "Unknown Manufacturer";
    return {
        libraryType: libraryType,
        libraryName: manufacturer,
        libraryId: "manufacturer--".concat(slugify(manufacturer)),
    };
}
function isDuplicateHeaderRow(row) {
    return (getHeaderValue(row, "Game").trim() === "Game" &&
        getHeaderValue(row, "Manufacturer").trim() === "Manufacturer");
}
function isBlankRow(row) {
    return Object.values(row).every(function (v) { return String(v !== null && v !== void 0 ? v : "").trim() === ""; });
}
function deriveLegacySlug(row) {
    var pinsideSlug = cleanString(getHeaderValue(row, "pinside_slug"));
    if (pinsideSlug)
        return pinsideSlug;
    var game = cleanString(getHeaderValue(row, "Game"));
    var variant = cleanString(getHeaderValue(row, "Variant"));
    if (!game)
        return null;
    return slugify(variant ? "".concat(game, " ").concat(variant) : game);
}
function fileExists(p) {
    try {
        return node_fs_1.default.existsSync(p);
    }
    catch (_a) {
        return false;
    }
}
function findMarkdownLocalPath(dir, basename) {
    if (!basename)
        return null;
    var filePath = node_path_1.default.join(dir, "".concat(basename, ".md"));
    if (!fileExists(filePath))
        return null;
    var webDir = node_path_1.default.basename(dir);
    return "/pinball/".concat(webDir, "/").concat(basename, ".md");
}
function findPlayfieldLocalPath(baseName) {
    if (!baseName)
        return null;
    for (var _i = 0, SUPPORTED_PLAYFIELD_EXTENSIONS_1 = SUPPORTED_PLAYFIELD_EXTENSIONS; _i < SUPPORTED_PLAYFIELD_EXTENSIONS_1.length; _i++) {
        var ext = SUPPORTED_PLAYFIELD_EXTENSIONS_1[_i];
        var direct = node_path_1.default.join(SHARED_PINBALL_IMAGES_DIR, "".concat(baseName).concat(ext));
        if (fileExists(direct))
            return "/pinball/images/playfields/".concat(baseName).concat(ext);
    }
    for (var _a = 0, SUPPORTED_PLAYFIELD_EXTENSIONS_2 = SUPPORTED_PLAYFIELD_EXTENSIONS; _a < SUPPORTED_PLAYFIELD_EXTENSIONS_2.length; _a++) {
        var ext = SUPPORTED_PLAYFIELD_EXTENSIONS_2[_a];
        var resized = node_path_1.default.join(SHARED_PINBALL_IMAGES_DIR, "".concat(baseName, "_700").concat(ext));
        if (fileExists(resized))
            return "/pinball/images/playfields/".concat(baseName, "_700").concat(ext);
    }
    for (var _b = 0, SUPPORTED_PLAYFIELD_EXTENSIONS_3 = SUPPORTED_PLAYFIELD_EXTENSIONS; _b < SUPPORTED_PLAYFIELD_EXTENSIONS_3.length; _b++) {
        var ext = SUPPORTED_PLAYFIELD_EXTENSIONS_3[_b];
        var resized = node_path_1.default.join(SHARED_PINBALL_IMAGES_DIR, "".concat(baseName, "_1400").concat(ext));
        if (fileExists(resized))
            return "/pinball/images/playfields/".concat(baseName, "_1400").concat(ext);
    }
    return null;
}
function findCanonicalPlayfieldLocalPath(practiceIdentity) {
    if (!practiceIdentity)
        return null;
    var base = "".concat(practiceIdentity, "-playfield");
    return findPlayfieldLocalPath(base);
}
function buildVideos(row) {
    var videos = [];
    var re = /^(tutorial|gameplay|competition)(?:\s+(\d+))?$/i;
    for (var _i = 0, _a = Object.entries(row); _i < _a.length; _i++) {
        var _b = _a[_i], header = _b[0], rawValue = _b[1];
        var url = cleanUrl(rawValue);
        if (!url)
            continue;
        var match = header.trim().match(re);
        if (!match)
            continue;
        var kind = match[1].toLowerCase();
        var order = match[2] ? Number.parseInt(match[2], 10) : 1;
        if (!Number.isFinite(order))
            continue;
        videos.push({
            kind: kind,
            order: order,
            label: "".concat(kind[0].toUpperCase()).concat(kind.slice(1), " ").concat(order),
            url: url,
        });
    }
    videos.sort(function (a, b) {
        if (a.kind !== b.kind)
            return a.kind.localeCompare(b.kind);
        return a.order - b.order;
    });
    return videos;
}
function parseCsvFile(csvPath) {
    var _a;
    var csvText = node_fs_1.default.readFileSync(csvPath, "utf8");
    var parsed = papaparse_1.default.parse(csvText, {
        header: true,
        skipEmptyLines: true,
    });
    if ((_a = parsed.errors) === null || _a === void 0 ? void 0 : _a.length) {
        throw new Error("CSV parse errors in ".concat(csvPath, ": ").concat(JSON.stringify(parsed.errors.slice(0, 5))));
    }
    return parsed;
}
function resolveInputCsvPaths() {
    var args = process.argv.slice(2).filter(Boolean);
    if (args.length > 0) {
        return args.map(function (p) { return node_path_1.default.resolve(p); });
    }
    var codex = node_path_1.default.join(SHARED_PINBALL_DATA_DIR, "Codex Pinball Library - Current.csv");
    if (node_fs_1.default.existsSync(codex))
        return [codex];
    var avenue = node_path_1.default.join(SHARED_PINBALL_DATA_DIR, "Avenue Pinball - Current.csv");
    var rlm = node_path_1.default.join(SHARED_PINBALL_DATA_DIR, "RLM Amusements - Current.csv");
    return [avenue, rlm].filter(function (p) { return node_fs_1.default.existsSync(p); });
}
function main() {
    var _a, _b, _c;
    var inputCsvPaths = resolveInputCsvPaths();
    if (!inputCsvPaths.length) {
        throw new Error("No input CSV files found for v2 builder.");
    }
    var outPath = node_path_1.default.join(SHARED_PINBALL_DATA_DIR, "pinball_library_v2.json");
    var items = [];
    var allColumns = new Set();
    var _loop_1 = function (csvPath) {
        if (!node_fs_1.default.existsSync(csvPath)) {
            throw new Error("Missing CSV: ".concat(csvPath));
        }
        var parsed = parseCsvFile(csvPath);
        var rawRows = ((_a = parsed.data) !== null && _a !== void 0 ? _a : []);
        var headers = ((_b = parsed.meta.fields) !== null && _b !== void 0 ? _b : []);
        for (var _e = 0, headers_1 = headers; _e < headers_1.length; _e++) {
            var h = headers_1[_e];
            allColumns.add(h);
        }
        rawRows.forEach(function (row, idx) {
            var _a;
            if (!row || isBlankRow(row) || isDuplicateHeaderRow(row))
                return;
            var game = cleanString(getHeaderValue(row, "Game"));
            if (!game)
                return;
            var _b = buildLibraryIdentity(row), libraryType = _b.libraryType, libraryId = _b.libraryId, libraryName = _b.libraryName;
            var practiceIdentity = cleanString(getHeaderValue(row, "practice_identity"));
            var legacySlug = deriveLegacySlug(row);
            var rulesheetLegacyBase = legacySlug;
            var gameinfoLegacyBase = legacySlug;
            var rulesheetPracticeBase = practiceIdentity ? "".concat(practiceIdentity, "-rulesheet") : null;
            var gameinfoPracticeBase = practiceIdentity ? "".concat(practiceIdentity, "-gameinfo") : null;
            var columns = {};
            for (var _i = 0, headers_2 = headers; _i < headers_2.length; _i++) {
                var h = headers_2[_i];
                columns[h] = String((_a = row[h]) !== null && _a !== void 0 ? _a : "");
            }
            var item = {
                library_entry_id: cleanString(getHeaderValue(row, "library_entry_id")),
                practice_identity: practiceIdentity,
                pinside_group: cleanPinsideGroup(getHeaderValue(row, "pinside_group")),
                library_type: libraryType,
                library_id: libraryId,
                library_name: libraryName,
                game: game,
                variant: cleanString(getHeaderValue(row, "Variant")),
                manufacturer: cleanString(getHeaderValue(row, "Manufacturer")),
                year: toIntOrNull(getHeaderValue(row, "Year")),
                venue: cleanString(getHeaderValue(row, "Venue")),
                pm_location_id: cleanString(getHeaderValue(row, "PM_location_id")),
                venue_location: cleanString(getHeaderValue(row, "Venue Location")),
                area: cleanString(getHeaderValue(row, "Area", "Location")),
                area_order: toIntOrNull(getHeaderValue(row, "AreaOrder")),
                group: toIntOrNull(getHeaderValue(row, "Group")),
                position: toIntOrNull(getHeaderValue(row, "Position")),
                bank: toIntOrNull(getHeaderValue(row, "Bank")),
                pinside_id: cleanString(getHeaderValue(row, "pinside_id")),
                pinside_slug: cleanString(getHeaderValue(row, "pinside_slug")),
                rulesheet_url: cleanUrl(getHeaderValue(row, "Rulesheet")),
                playfield_image_url: cleanUrl(getHeaderValue(row, "Playfield Image")),
                videos: buildVideos(row),
                assets: {
                    rulesheet_local_legacy: findMarkdownLocalPath(SHARED_PINBALL_RULESHEETS_DIR, rulesheetLegacyBase),
                    rulesheet_local_practice: findMarkdownLocalPath(SHARED_PINBALL_RULESHEETS_DIR, rulesheetPracticeBase),
                    gameinfo_local_legacy: findMarkdownLocalPath(SHARED_PINBALL_GAMEINFO_DIR, gameinfoLegacyBase),
                    gameinfo_local_practice: findMarkdownLocalPath(SHARED_PINBALL_GAMEINFO_DIR, gameinfoPracticeBase),
                    playfield_local_legacy: findPlayfieldLocalPath(legacySlug),
                    playfield_local_practice: findCanonicalPlayfieldLocalPath(practiceIdentity),
                },
                sort_keys: {
                    alphabetical: slugify(game),
                    year: toIntOrNull(getHeaderValue(row, "Year")),
                    location: {
                        areaOrder: toIntOrNull(getHeaderValue(row, "AreaOrder")),
                        area: cleanString(getHeaderValue(row, "Area", "Location")),
                        group: toIntOrNull(getHeaderValue(row, "Group")),
                        position: toIntOrNull(getHeaderValue(row, "Position")),
                    },
                    bank: toIntOrNull(getHeaderValue(row, "Bank")),
                },
                columns: columns,
                source: {
                    file: node_path_1.default.basename(csvPath),
                    row_number: idx + 2,
                },
            };
            items.push(item);
        });
    };
    for (var _i = 0, inputCsvPaths_1 = inputCsvPaths; _i < inputCsvPaths_1.length; _i++) {
        var csvPath = inputCsvPaths_1[_i];
        _loop_1(csvPath);
    }
    var libraryMap = new Map();
    for (var _d = 0, items_1 = items; _d < items_1.length; _d++) {
        var item = items_1[_d];
        var cur = (_c = libraryMap.get(item.library_id)) !== null && _c !== void 0 ? _c : {
            library_id: item.library_id,
            library_name: item.library_name,
            library_type: item.library_type,
            item_count: 0,
            has_bank: false,
            has_location: false,
        };
        cur.item_count += 1;
        cur.has_bank = cur.has_bank || item.bank != null;
        cur.has_location =
            cur.has_location ||
                item.area_order != null ||
                item.area != null ||
                item.group != null ||
                item.position != null;
        libraryMap.set(item.library_id, cur);
    }
    var out = {
        version: 2,
        generated_at: new Date().toISOString(),
        source_files: inputCsvPaths.map(function (p) { return node_path_1.default.basename(p); }),
        columns: __spreadArray([], allColumns, true),
        libraries: __spreadArray([], libraryMap.values(), true).sort(function (a, b) {
            if (a.library_type !== b.library_type)
                return a.library_type.localeCompare(b.library_type);
            return a.library_name.localeCompare(b.library_name);
        }),
        items: items,
    };
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(outPath), { recursive: true });
    node_fs_1.default.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
    console.log("Wrote ".concat(items.length, " items -> ").concat(outPath));
    console.log("Source CSVs: ".concat(inputCsvPaths.join(", ")));
    console.log("Libraries: ".concat(out.libraries.length));
}
main();
