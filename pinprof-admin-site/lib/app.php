<?php
declare(strict_types=1);

function pinprof_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $configPath = dirname(__DIR__) . '/config.php';
    if (!is_file($configPath)) {
        throw new RuntimeException('Missing pinprof-admin-site/config.php');
    }

    $config = require $configPath;
    if (!is_array($config)) {
        throw new RuntimeException('Invalid pinprof-admin-site/config.php');
    }

    $config['pinball_fs_root'] = rtrim((string) ($config['pinball_fs_root'] ?? ''), '/');
    $config['pinball_web_root'] = rtrim((string) ($config['pinball_web_root'] ?? '/pinball'), '/');
    return $config;
}

function pinprof_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = pinprof_config();
    $db = $config['db'] ?? [];
    $pdo = new PDO(
        (string) ($db['dsn'] ?? ''),
        (string) ($db['user'] ?? ''),
        (string) ($db['password'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pinprof_playfield_assets (
            playfield_asset_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            practice_identity VARCHAR(64) NOT NULL,
            source_opdb_machine_id VARCHAR(128) NOT NULL,
            covered_alias_ids_json JSON NOT NULL,
            playfield_local_path VARCHAR(255) NULL,
            playfield_source_url TEXT NULL,
            playfield_source_note TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_pinprof_playfield_assets_practice_alias (practice_identity, source_opdb_machine_id),
            KEY idx_pinprof_playfield_assets_practice (practice_identity),
            KEY idx_pinprof_playfield_assets_source_alias (source_opdb_machine_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    return $pdo;
}

function pinprof_clean_string(mixed $value): ?string
{
    $trimmed = trim((string) ($value ?? ''));
    return $trimmed === '' ? null : $trimmed;
}

function pinprof_clean_int(mixed $value): ?int
{
    $trimmed = trim((string) ($value ?? ''));
    if ($trimmed === '') {
        return null;
    }
    return filter_var($trimmed, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE);
}

function pinprof_normalize_alias_ids(array $values): array
{
    $seen = [];
    foreach ($values as $value) {
        $clean = pinprof_clean_string($value);
        if ($clean === null) {
            continue;
        }
        $seen[$clean] = true;
    }
    return array_keys($seen);
}

function pinprof_parse_covered_alias_ids(mixed $value): array
{
    if (is_array($value)) {
        return pinprof_normalize_alias_ids($value);
    }
    $trimmed = trim((string) ($value ?? ''));
    if ($trimmed === '') {
        return [];
    }
    try {
        $decoded = json_decode($trimmed, true, 512, JSON_THROW_ON_ERROR);
        if (is_array($decoded)) {
            return pinprof_normalize_alias_ids($decoded);
        }
    } catch (Throwable) {
    }
    return pinprof_normalize_alias_ids(explode(',', $trimmed));
}

function pinprof_stringify_covered_alias_ids(array $values): string
{
    return json_encode(pinprof_normalize_alias_ids($values), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function pinprof_web_root(string $relative): string
{
    $config = pinprof_config();
    return $config['pinball_web_root'] . '/' . ltrim($relative, '/');
}

function pinprof_fs_root(string $relative): string
{
    $config = pinprof_config();
    return $config['pinball_fs_root'] . '/' . ltrim($relative, '/');
}

function pinprof_load_json(string $relativePath): array
{
    static $cache = [];
    if (isset($cache[$relativePath])) {
        return $cache[$relativePath];
    }

    $file = pinprof_fs_root($relativePath);
    if (!is_file($file)) {
        throw new RuntimeException("Missing pinball data file: {$relativePath}");
    }

    $decoded = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        throw new RuntimeException("Invalid JSON in {$relativePath}");
    }
    $cache[$relativePath] = $decoded;
    return $decoded;
}

function pinprof_pick_first_non_empty(array $values): ?string
{
    foreach ($values as $value) {
        $clean = pinprof_clean_string($value);
        if ($clean !== null) {
            return $clean;
        }
    }
    return null;
}

function pinprof_opdb_groups(): array
{
    static $groups = null;
    if ($groups !== null) {
        return $groups;
    }

    $catalog = pinprof_load_json('data/opdb_catalog_v1.json');
    $machines = is_array($catalog['machines'] ?? null) ? $catalog['machines'] : [];
    $groups = [];

    foreach ($machines as $machine) {
        if (!is_array($machine)) {
            continue;
        }
        $practice = pinprof_clean_string($machine['practice_identity'] ?? null);
        if ($practice === null) {
            continue;
        }
        $groups[$practice][] = $machine;
    }

    foreach ($groups as &$rows) {
        usort($rows, static function (array $left, array $right): int {
            $leftVariant = strtolower((string) ($left['variant'] ?? ''));
            $rightVariant = strtolower((string) ($right['variant'] ?? ''));
            if ($leftVariant === '' && $rightVariant !== '') {
                return -1;
            }
            if ($rightVariant === '' && $leftVariant !== '') {
                return 1;
            }
            return strcmp(
                strtolower((string) ($left['opdb_machine_id'] ?? '')),
                strtolower((string) ($right['opdb_machine_id'] ?? ''))
            );
        });
    }
    unset($rows);

    return $groups;
}

function pinprof_library_items_by_practice(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $library = pinprof_load_json('data/pinball_library_v3.json');
    $items = is_array($library['items'] ?? null) ? $library['items'] : [];
    $map = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $practice = pinprof_clean_string($item['practice_identity'] ?? null);
        if ($practice === null) {
            continue;
        }
        $map[$practice][] = $item;
    }

    foreach ($map as &$rows) {
        usort($rows, static function (array $left, array $right): int {
            $leftVariant = strtolower((string) ($left['variant'] ?? ''));
            $rightVariant = strtolower((string) ($right['variant'] ?? ''));
            if ($leftVariant === '' && $rightVariant !== '') {
                return -1;
            }
            if ($rightVariant === '' && $leftVariant !== '') {
                return 1;
            }
            return strcmp(
                strtolower((string) ($left['library_entry_id'] ?? '')),
                strtolower((string) ($right['library_entry_id'] ?? ''))
            );
        });
    }
    unset($rows);

    return $map;
}

function pinprof_all_override_rows(): array
{
    $stmt = pinprof_pdo()->query('SELECT * FROM pinprof_machine_overrides');
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        if (!is_array($row)) {
            continue;
        }
        $practice = pinprof_clean_string($row['practice_identity'] ?? null);
        if ($practice === null) {
            continue;
        }
        $rows[$practice] = $row;
    }
    return $rows;
}

function pinprof_override_row(string $practiceIdentity): ?array
{
    $stmt = pinprof_pdo()->prepare('SELECT * FROM pinprof_machine_overrides WHERE practice_identity = :practice_identity');
    $stmt->execute(['practice_identity' => $practiceIdentity]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

function pinprof_playfield_asset_rows(string $practiceIdentity): array
{
    $stmt = pinprof_pdo()->prepare('
        SELECT *
        FROM pinprof_playfield_assets
        WHERE practice_identity = :practice_identity
        ORDER BY updated_at DESC, source_opdb_machine_id
    ');
    $stmt->execute(['practice_identity' => $practiceIdentity]);
    $rows = $stmt->fetchAll();
    return is_array($rows) ? $rows : [];
}

function pinprof_asset_label(string $kind, ?string $detail = null): string
{
    $prefix = match ($kind) {
        'opdb' => 'OPDB',
        'pillyliu' => 'Pillyliu local',
        'external' => 'External source',
        default => 'Missing',
    };
    return $detail ? "{$prefix} · {$detail}" : $prefix;
}

function pinprof_url_kind(?string $url): string
{
    if ($url === null) {
        return 'missing';
    }
    return str_contains($url, 'img.opdb.org') ? 'opdb' : 'external';
}

function pinprof_read_local_text(?string $webPath): string
{
    $fs = pinprof_web_path_to_fs($webPath);
    if ($fs === null || !is_file($fs)) {
        return '';
    }
    return (string) file_get_contents($fs);
}

function pinprof_web_path_to_fs(?string $webPath): ?string
{
    $clean = pinprof_clean_string($webPath);
    if ($clean === null) {
        return null;
    }
    $config = pinprof_config();
    $prefix = $config['pinball_web_root'];
    if (!str_starts_with($clean, $prefix . '/')) {
        return null;
    }
    $relative = substr($clean, strlen($prefix) + 1);
    $fs = realpath($config['pinball_fs_root']);
    if ($fs === false) {
        return null;
    }
    return $fs . '/' . $relative;
}

function pinprof_preferred_alias(array $aliases): ?array
{
    return $aliases[0] ?? null;
}

function pinprof_alias_id(array $alias): ?string
{
    return pinprof_clean_string($alias['opdb_machine_id'] ?? null);
}

function pinprof_alias_label(array $alias): string
{
    $parts = array_values(array_filter([
        pinprof_clean_string($alias['variant'] ?? null),
        pinprof_alias_id($alias),
    ], static fn (?string $value): bool => $value !== null));
    return $parts ? implode(' · ', $parts) : ((string) ($alias['opdb_machine_id'] ?? ''));
}

function pinprof_resolve_playfield_alias(string $practiceIdentity, ?string $requestedAliasId = null, ?array $aliases = null, ?array $override = null): array
{
    $aliasRows = $aliases ?? (pinprof_opdb_groups()[$practiceIdentity] ?? []);
    if ($aliasRows === []) {
        throw new RuntimeException("No OPDB aliases found for {$practiceIdentity}");
    }

    $requested = pinprof_clean_string($requestedAliasId);
    if ($requested !== null) {
        foreach ($aliasRows as $alias) {
            if (pinprof_alias_id($alias) === $requested) {
                return $alias;
            }
        }
        throw new RuntimeException("Alias {$requested} does not belong to {$practiceIdentity}");
    }

    $overrideAliasId = pinprof_clean_string($override['opdb_machine_id'] ?? null);
    if ($overrideAliasId !== null) {
        foreach ($aliasRows as $alias) {
            if (pinprof_alias_id($alias) === $overrideAliasId) {
                return $alias;
            }
        }
    }

    return pinprof_preferred_alias($aliasRows) ?? $aliasRows[0];
}

function pinprof_playfield_filename_base(string $aliasId): string
{
    return $aliasId . '-playfield';
}

function pinprof_playfield_prefix_from_web_path(?string $webPath): ?string
{
    $clean = pinprof_clean_string($webPath);
    if ($clean === null || !str_starts_with($clean, pinprof_web_root('images/playfields/'))) {
        return null;
    }
    $filename = basename($clean);
    $ext = pathinfo($filename, PATHINFO_EXTENSION);
    $stem = $ext !== '' ? substr($filename, 0, -strlen($ext) - 1) : $filename;
    $stem = preg_replace('/_(700|1400)$/i', '', $stem);
    $stem = is_string($stem) ? trim($stem) : '';
    return $stem !== '' ? $stem : null;
}

function pinprof_practice_playfield_prefix(string $practiceIdentity): string
{
    return $practiceIdentity . '-playfield';
}

function pinprof_find_playfield_web_path_by_prefix(string $prefix): ?string
{
    foreach (['webp', 'png', 'jpg', 'jpeg', 'gif', 'avif'] as $ext) {
        $webPath = pinprof_web_root('images/playfields/' . $prefix . '.' . $ext);
        $fsPath = pinprof_web_path_to_fs($webPath);
        if ($fsPath !== null && is_file($fsPath)) {
            return $webPath;
        }
    }
    return null;
}

function pinprof_normalize_covered_alias_ids_for_practice(string $practiceIdentity, array $values): array
{
    $aliases = pinprof_opdb_groups()[$practiceIdentity] ?? [];
    $allowed = [];
    foreach ($aliases as $alias) {
        $aliasId = pinprof_alias_id($alias);
        if ($aliasId !== null) {
            $allowed[$aliasId] = true;
        }
    }
    return array_values(array_filter(
        pinprof_normalize_alias_ids($values),
        static fn (string $aliasId): bool => isset($allowed[$aliasId])
    ));
}

function pinprof_parse_opdb_id_parts(?string $opdbId): array
{
    $clean = pinprof_clean_string($opdbId);
    if ($clean === null) {
        return [
            'fullId' => null,
            'groupId' => null,
            'machineId' => null,
            'aliasId' => null,
        ];
    }
    $parts = explode('-', $clean);
    $groupId = $parts[0] ?? null;
    $machinePart = null;
    $aliasPart = null;
    foreach ($parts as $part) {
        if ($machinePart === null && str_starts_with($part, 'M')) {
            $machinePart = $part;
        }
        if ($aliasPart === null && str_starts_with($part, 'A')) {
            $aliasPart = $part;
        }
    }
    $machineId = $groupId !== null && $machinePart !== null ? $groupId . '-' . $machinePart : $groupId;
    return [
        'fullId' => $clean,
        'groupId' => $groupId,
        'machineId' => $machineId,
        'aliasId' => $aliasPart !== null ? $clean : null,
    ];
}

function pinprof_score_playfield_source_match(?string $requestedOpdbId, ?string $sourceOpdbId): int
{
    $requested = pinprof_parse_opdb_id_parts($requestedOpdbId);
    $source = pinprof_parse_opdb_id_parts($sourceOpdbId);
    if ($requested['fullId'] === null || $source['fullId'] === null || $requested['groupId'] !== $source['groupId']) {
        return -1;
    }
    if ($requested['fullId'] === $source['fullId']) {
        return 500;
    }
    if ($requested['machineId'] !== null && $source['fullId'] === $requested['machineId']) {
        return 460;
    }
    if ($requested['machineId'] !== null && $source['machineId'] === $requested['machineId']) {
        return $source['aliasId'] !== null ? 440 : 450;
    }
    if ($source['machineId'] === $source['groupId'] && $source['aliasId'] === null) {
        return 300;
    }
    if ($source['aliasId'] !== null) {
        return 240;
    }
    return 250;
}

function pinprof_resolve_playfield_asset_for_alias(string $practiceIdentity, ?string $aliasId, ?array $assets = null): ?array
{
    $requested = pinprof_clean_string($aliasId);
    if ($requested === null) {
        return null;
    }
    $rows = $assets ?? pinprof_playfield_asset_rows($practiceIdentity);
    $best = null;
    $bestScore = -1;
    foreach ($rows as $row) {
        $fsPath = pinprof_web_path_to_fs($row['playfield_local_path'] ?? null);
        if ($fsPath === null || !is_file($fsPath)) {
            continue;
        }
        $score = pinprof_score_playfield_source_match($requested, $row['source_opdb_machine_id'] ?? null);
        if ($score > $bestScore) {
            $best = $row;
            $bestScore = $score;
        }
    }
    return $best;
}

function pinprof_pick_primary_playfield_asset(string $practiceIdentity, array $assets): ?array
{
    if ($assets === []) {
        return null;
    }
    $preferredAlias = pinprof_resolve_playfield_alias($practiceIdentity);
    $preferredAliasId = pinprof_alias_id($preferredAlias);
    $resolved = pinprof_resolve_playfield_asset_for_alias($practiceIdentity, $preferredAliasId, $assets);
    if ($resolved !== null) {
        return $resolved;
    }
    return $assets[0];
}

function pinprof_build_playfield_asset_payloads(string $practiceIdentity, array $aliases): array
{
    $byId = [];
    foreach ($aliases as $alias) {
        $aliasId = pinprof_alias_id($alias);
        if ($aliasId !== null) {
            $byId[$aliasId] = $alias;
        }
    }

    $rows = [];
    foreach (pinprof_playfield_asset_rows($practiceIdentity) as $row) {
        $sourceAliasId = (string) ($row['source_opdb_machine_id'] ?? '');
        $sourceAlias = $byId[$sourceAliasId] ?? ['opdb_machine_id' => $sourceAliasId];
        $rows[] = [
            'playfieldAssetId' => (int) ($row['playfield_asset_id'] ?? 0),
            'sourceAliasId' => $sourceAliasId,
            'sourceAliasLabel' => pinprof_alias_label($sourceAlias),
            'localPath' => pinprof_clean_string($row['playfield_local_path'] ?? null),
            'sourceUrl' => pinprof_clean_string($row['playfield_source_url'] ?? null),
            'sourceNote' => pinprof_clean_string($row['playfield_source_note'] ?? null),
            'updatedAt' => pinprof_clean_string($row['updated_at'] ?? null),
        ];
    }
    return $rows;
}

function pinprof_preferred_library_item(array $items): ?array
{
    return $items[0] ?? null;
}

function pinprof_curated_assets(?array $item): array
{
    $assets = is_array($item['assets'] ?? null) ? $item['assets'] : [];
    return [
        'playfieldLocalPath' => pinprof_clean_string($assets['playfield_local_practice'] ?? null),
        'rulesheetLocalPath' => pinprof_clean_string($assets['rulesheet_local_practice'] ?? null),
        'gameinfoLocalPath' => pinprof_clean_string($assets['gameinfo_local_practice'] ?? null),
        'playfieldImageUrl' => pinprof_clean_string($item['playfield_image_url'] ?? null),
        'rulesheetUrl' => pinprof_clean_string($item['rulesheet_url'] ?? null),
        'sourceName' => pinprof_clean_string($item['library_name'] ?? null),
        'sourceType' => pinprof_clean_string($item['library_type'] ?? null),
        'sourceId' => pinprof_clean_string($item['library_id'] ?? null),
        'name' => pinprof_clean_string($item['game'] ?? null),
        'variant' => pinprof_clean_string($item['variant'] ?? null),
        'manufacturer' => pinprof_clean_string($item['manufacturer'] ?? null),
        'year' => pinprof_clean_int($item['year'] ?? null),
    ];
}

function pinprof_machine_detail(string $practiceIdentity): array
{
    $groups = pinprof_opdb_groups();
    $libraryByPractice = pinprof_library_items_by_practice();
    $aliases = $groups[$practiceIdentity] ?? null;
    if ($aliases === null) {
        throw new RuntimeException("Machine not found: {$practiceIdentity}");
    }

    $preferredAlias = pinprof_preferred_alias($aliases);
    $libraryItems = $libraryByPractice[$practiceIdentity] ?? [];
    $preferredLibrary = pinprof_preferred_library_item($libraryItems);
    $curated = pinprof_curated_assets($preferredLibrary ?? []);
    $override = pinprof_override_row($practiceIdentity) ?? [];
    $playfieldAlias = pinprof_resolve_playfield_alias($practiceIdentity, null, $aliases, $override);
    $playfieldAliasId = pinprof_alias_id($playfieldAlias) ?? '';
    $playfieldAssets = pinprof_build_playfield_asset_payloads($practiceIdentity, $aliases);
    $resolvedPlayfieldAssetRow = pinprof_resolve_playfield_asset_for_alias($practiceIdentity, $playfieldAliasId);
    $resolvedPlayfieldAsset = null;
    if ($resolvedPlayfieldAssetRow !== null) {
        foreach ($playfieldAssets as $asset) {
            if (($asset['sourceAliasId'] ?? null) === ($resolvedPlayfieldAssetRow['source_opdb_machine_id'] ?? null)) {
                $resolvedPlayfieldAsset = $asset;
                break;
            }
        }
    }

    $primaryImageUrl = pinprof_pick_first_non_empty([
        $preferredAlias['primary_image']['large_url'] ?? null,
        $preferredAlias['primary_image']['medium_url'] ?? null,
    ]);
    $opdbPlayfieldUrl = pinprof_pick_first_non_empty([
        $preferredAlias['playfield_image']['large_url'] ?? null,
        $preferredAlias['playfield_image']['medium_url'] ?? null,
    ]);
    $curatedPlayfieldUrl = $curated['playfieldImageUrl'];
    $effectivePlayfieldUrl = pinprof_pick_first_non_empty([
        $resolvedPlayfieldAsset['localPath'] ?? null,
        $override['playfield_local_path'] ?? null,
        $curated['playfieldLocalPath'],
        $curatedPlayfieldUrl,
        $opdbPlayfieldUrl,
    ]);
    $effectiveRulesheetPath = pinprof_pick_first_non_empty([
        $override['rulesheet_local_path'] ?? null,
        $curated['rulesheetLocalPath'],
    ]);
    $effectiveRulesheetUrl = pinprof_pick_first_non_empty([
        $override['rulesheet_source_url'] ?? null,
        $curated['rulesheetUrl'],
    ]);
    $effectiveGameinfoPath = pinprof_pick_first_non_empty([
        $override['gameinfo_local_path'] ?? null,
        $curated['gameinfoLocalPath'],
    ]);
    $effectiveBackglassUrl = pinprof_pick_first_non_empty([
        $override['backglass_local_path'] ?? null,
        $primaryImageUrl,
    ]);

    $playfieldKind = ($resolvedPlayfieldAsset['localPath'] ?? null)
        ? 'pillyliu'
        : (($override['playfield_local_path'] ?? null)
            ? 'pillyliu'
            : ($curated['playfieldLocalPath'] ? 'pillyliu' : pinprof_url_kind($effectivePlayfieldUrl)));
    $backglassKind = $override['backglass_local_path'] ?? null ? 'pillyliu' : pinprof_url_kind($effectiveBackglassUrl);
    $rulesheetKind = $effectiveRulesheetPath ? 'pillyliu' : ($effectiveRulesheetUrl ? 'external' : 'missing');
    $gameinfoKind = $effectiveGameinfoPath ? 'pillyliu' : 'missing';

    $machineName = pinprof_pick_first_non_empty([
        $override['name_override'] ?? null,
        $curated['name'],
        $preferredAlias['name'] ?? null,
    ]) ?? $practiceIdentity;
    $machineVariant = pinprof_pick_first_non_empty([
        $override['variant_override'] ?? null,
        $curated['variant'],
        $preferredAlias['variant'] ?? null,
    ]);
    $manufacturer = pinprof_pick_first_non_empty([
        $override['manufacturer_override'] ?? null,
        $curated['manufacturer'],
        $preferredAlias['manufacturer_name'] ?? null,
    ]);
    $year = pinprof_clean_int($override['year_override'] ?? null)
        ?? $curated['year']
        ?? pinprof_clean_int($preferredAlias['year'] ?? null);

    return [
        'machine' => [
            'practiceIdentity' => $practiceIdentity,
            'opdbMachineId' => pinprof_clean_string($preferredAlias['opdb_machine_id'] ?? null),
            'opdbGroupId' => pinprof_clean_string($preferredAlias['opdb_group_id'] ?? null) ?? $practiceIdentity,
            'slug' => pinprof_pick_first_non_empty([
                $override['slug'] ?? null,
                $preferredAlias['slug'] ?? null,
            ]) ?? '',
            'name' => $machineName,
            'variant' => $machineVariant,
            'manufacturer' => $manufacturer,
            'year' => $year,
            'playfieldImageUrl' => $opdbPlayfieldUrl,
            'primaryImageUrl' => $primaryImageUrl,
            'playfieldLocalPath' => pinprof_pick_first_non_empty([
                $resolvedPlayfieldAsset['localPath'] ?? null,
                $curated['playfieldLocalPath'],
                $override['playfield_local_path'] ?? null,
            ]),
            'rulesheetLocalPath' => pinprof_pick_first_non_empty([
                $curated['rulesheetLocalPath'],
                $override['rulesheet_local_path'] ?? null,
            ]),
        ],
        'override' => [
            'nameOverride' => (string) ($override['name_override'] ?? ''),
            'variantOverride' => (string) ($override['variant_override'] ?? ''),
            'manufacturerOverride' => (string) ($override['manufacturer_override'] ?? ''),
            'yearOverride' => isset($override['year_override']) && $override['year_override'] !== null ? (string) $override['year_override'] : '',
            'backglassLocalPath' => pinprof_clean_string($override['backglass_local_path'] ?? null),
            'backglassSourceUrl' => (string) ($override['backglass_source_url'] ?? ''),
            'backglassSourceNote' => (string) ($override['backglass_source_note'] ?? ''),
            'playfieldAliasId' => (string) ($resolvedPlayfieldAsset['sourceAliasId'] ?? $playfieldAliasId),
            'playfieldLocalPath' => pinprof_clean_string($resolvedPlayfieldAsset['localPath'] ?? ($override['playfield_local_path'] ?? null)),
            'playfieldSourceUrl' => (string) ($resolvedPlayfieldAsset['sourceUrl'] ?? ($override['playfield_source_url'] ?? '')),
            'playfieldSourceNote' => (string) ($resolvedPlayfieldAsset['sourceNote'] ?? ($override['playfield_source_note'] ?? '')),
            'rulesheetLocalPath' => pinprof_clean_string($override['rulesheet_local_path'] ?? null),
            'rulesheetSourceUrl' => (string) ($override['rulesheet_source_url'] ?? ''),
            'rulesheetSourceNote' => (string) ($override['rulesheet_source_note'] ?? ''),
            'gameinfoLocalPath' => pinprof_clean_string($override['gameinfo_local_path'] ?? null),
            'notes' => (string) ($override['notes'] ?? ''),
            'updatedAt' => pinprof_clean_string($override['updated_at'] ?? null),
        ],
        'sources' => [
            'builtIn' => [
                'sourceId' => $curated['sourceId'],
                'sourceName' => $curated['sourceName'],
                'sourceType' => $curated['sourceType'],
            ],
            'aliases' => array_map(static function (array $alias): array {
                return [
                    'opdbMachineId' => (string) ($alias['opdb_machine_id'] ?? ''),
                    'slug' => (string) ($alias['slug'] ?? ''),
                    'variant' => pinprof_clean_string($alias['variant'] ?? null),
                    'primaryImageUrl' => pinprof_pick_first_non_empty([
                        $alias['primary_image']['large_url'] ?? null,
                        $alias['primary_image']['medium_url'] ?? null,
                    ]),
                    'playfieldImageUrl' => pinprof_pick_first_non_empty([
                        $alias['playfield_image']['large_url'] ?? null,
                        $alias['playfield_image']['medium_url'] ?? null,
                    ]),
                    'updatedAt' => pinprof_clean_string($alias['updated_at'] ?? null),
                ];
            }, $aliases),
            'playfieldAssets' => $playfieldAssets,
            'assets' => [
                'backglass' => [
                    'effectiveKind' => $backglassKind,
                    'effectiveLabel' => pinprof_asset_label($backglassKind, $backglassKind === 'pillyliu' ? 'override image' : 'primary/backglass image'),
                    'effectiveUrl' => $effectiveBackglassUrl,
                    'localPath' => pinprof_clean_string($override['backglass_local_path'] ?? null),
                    'localSourceUrl' => pinprof_clean_string($override['backglass_source_url'] ?? null),
                    'localSourceNote' => pinprof_clean_string($override['backglass_source_note'] ?? null),
                    'fallbackOpdbUrl' => $primaryImageUrl,
                ],
                'playfield' => [
                    'effectiveKind' => $playfieldKind,
                    'effectiveLabel' => pinprof_asset_label(
                        $playfieldKind,
                        $playfieldKind === 'pillyliu'
                            ? (($resolvedPlayfieldAsset['sourceAliasLabel'] ?? null) ? 'local source ' . $resolvedPlayfieldAsset['sourceAliasLabel'] : 'override/library image')
                            : 'playfield image'
                    ),
                    'effectiveUrl' => $effectivePlayfieldUrl,
                    'targetAliasId' => $playfieldAliasId,
                    'targetAliasLabel' => pinprof_alias_label($playfieldAlias),
                    'targetFilename' => pinprof_playfield_filename_base($playfieldAliasId),
                    'localPath' => pinprof_pick_first_non_empty([
                        $resolvedPlayfieldAsset['localPath'] ?? null,
                        $override['playfield_local_path'] ?? null,
                        $curated['playfieldLocalPath'],
                    ]),
                    'localSourceUrl' => pinprof_pick_first_non_empty([
                        $resolvedPlayfieldAsset['sourceUrl'] ?? null,
                        $override['playfield_source_url'] ?? null,
                        $curatedPlayfieldUrl,
                    ]),
                    'localSourceNote' => pinprof_clean_string($resolvedPlayfieldAsset['sourceNote'] ?? ($override['playfield_source_note'] ?? null)),
                    'fallbackOpdbUrl' => $opdbPlayfieldUrl,
                ],
                'rulesheet' => [
                    'effectiveKind' => $rulesheetKind,
                    'effectiveLabel' => pinprof_asset_label($rulesheetKind, $rulesheetKind === 'pillyliu' ? 'markdown override' : 'linked rulesheet'),
                    'effectiveUrl' => $effectiveRulesheetPath ?? $effectiveRulesheetUrl,
                    'localPath' => $effectiveRulesheetPath,
                    'sourceUrl' => $effectiveRulesheetUrl,
                    'sourceNote' => pinprof_clean_string($override['rulesheet_source_note'] ?? null),
                ],
                'gameinfo' => [
                    'effectiveKind' => $gameinfoKind,
                    'effectiveLabel' => pinprof_asset_label($gameinfoKind, $gameinfoKind === 'pillyliu' ? 'game info markdown' : 'no game info'),
                    'effectiveUrl' => $effectiveGameinfoPath,
                    'localPath' => $effectiveGameinfoPath,
                ],
            ],
        ],
        'rulesheetContent' => pinprof_read_local_text($effectiveRulesheetPath),
        'gameinfoContent' => pinprof_read_local_text($effectiveGameinfoPath),
    ];
}

function pinprof_list_machines(?string $query, int $page, int $pageSize): array
{
    $groups = pinprof_opdb_groups();
    $libraryByPractice = pinprof_library_items_by_practice();
    $overrides = pinprof_all_override_rows();
    $rows = [];
    $needle = $query !== null ? strtolower($query) : null;

    foreach ($groups as $practiceIdentity => $aliases) {
        $preferredAlias = pinprof_preferred_alias($aliases);
        $preferredLibrary = pinprof_preferred_library_item($libraryByPractice[$practiceIdentity] ?? []);
        $curated = pinprof_curated_assets($preferredLibrary ?? []);
        $override = $overrides[$practiceIdentity] ?? null;
        $playfieldAssets = pinprof_playfield_asset_rows($practiceIdentity);
        $primaryPlayfieldAsset = pinprof_pick_primary_playfield_asset($practiceIdentity, $playfieldAssets);

        $name = pinprof_pick_first_non_empty([
            $override['name_override'] ?? null,
            $curated['name'],
            $preferredAlias['name'] ?? null,
        ]) ?? $practiceIdentity;
        $variant = pinprof_pick_first_non_empty([
            $override['variant_override'] ?? null,
            $curated['variant'],
            $preferredAlias['variant'] ?? null,
        ]);
        $manufacturer = pinprof_pick_first_non_empty([
            $override['manufacturer_override'] ?? null,
            $curated['manufacturer'],
            $preferredAlias['manufacturer_name'] ?? null,
        ]);
        $year = pinprof_clean_int($override['year_override'] ?? null)
            ?? $curated['year']
            ?? pinprof_clean_int($preferredAlias['year'] ?? null);

        $searchHaystack = strtolower(implode(' ', array_filter([
            $practiceIdentity,
            $name,
            $variant,
            $manufacturer,
            $preferredAlias['slug'] ?? null,
            $preferredAlias['opdb_machine_id'] ?? null,
        ], static fn ($value) => $value !== null && $value !== '')));
        if ($needle !== null && !str_contains($searchHaystack, $needle)) {
            continue;
        }

        $rows[] = [
            'practiceIdentity' => $practiceIdentity,
            'opdbMachineId' => pinprof_clean_string($preferredAlias['opdb_machine_id'] ?? null),
            'slug' => (string) ($preferredAlias['slug'] ?? ''),
            'name' => $name,
            'variant' => $variant,
            'manufacturer' => $manufacturer,
            'year' => $year,
            'playfieldImageUrl' => pinprof_pick_first_non_empty([
                $preferredAlias['playfield_image']['large_url'] ?? null,
                $preferredAlias['playfield_image']['medium_url'] ?? null,
            ]),
            'primaryImageUrl' => pinprof_pick_first_non_empty([
                $preferredAlias['primary_image']['large_url'] ?? null,
                $preferredAlias['primary_image']['medium_url'] ?? null,
            ]),
            'playfieldLocalPath' => pinprof_pick_first_non_empty([
                $primaryPlayfieldAsset['playfield_local_path'] ?? null,
                $override['playfield_local_path'] ?? null,
                $curated['playfieldLocalPath'],
            ]),
            'rulesheetLocalPath' => pinprof_pick_first_non_empty([
                $override['rulesheet_local_path'] ?? null,
                $curated['rulesheetLocalPath'],
            ]),
            'hasAdminOverride' => $override !== null || $playfieldAssets !== [],
        ];
    }

    usort($rows, static function (array $left, array $right): int {
        $nameCompare = strcmp(strtolower((string) $left['name']), strtolower((string) $right['name']));
        if ($nameCompare !== 0) {
            return $nameCompare;
        }
        return strcmp(strtolower((string) ($left['variant'] ?? '')), strtolower((string) ($right['variant'] ?? '')));
    });

    $total = count($rows);
    $offset = max(0, ($page - 1) * $pageSize);
    return [
        'items' => array_slice($rows, $offset, $pageSize),
        'total' => $total,
        'page' => $page,
        'pageSize' => $pageSize,
    ];
}

function pinprof_summary(): array
{
    $groups = pinprof_opdb_groups();
    $catalog = pinprof_load_json('data/opdb_catalog_v1.json');
    $machineRows = is_array($catalog['machines'] ?? null) ? $catalog['machines'] : [];
    $pdo = pinprof_pdo();
    $overriddenMachines = (int) $pdo->query('
        SELECT COUNT(DISTINCT practice_identity)
        FROM (
            SELECT practice_identity FROM pinprof_machine_overrides
            UNION ALL
            SELECT practice_identity FROM pinprof_playfield_assets
        ) t
    ')->fetchColumn();
    $playfieldOverrides = (int) $pdo->query("SELECT COUNT(*) FROM pinprof_playfield_assets WHERE playfield_local_path IS NOT NULL AND playfield_local_path != ''")->fetchColumn();
    $rulesheetOverrides = (int) $pdo->query("SELECT COUNT(*) FROM pinprof_machine_overrides WHERE rulesheet_local_path IS NOT NULL AND rulesheet_local_path != ''")->fetchColumn();

    return [
        'totalMachines' => count($groups),
        'totalOpdbRows' => count($machineRows),
        'overriddenMachines' => $overriddenMachines,
        'playfieldOverrides' => $playfieldOverrides,
        'rulesheetOverrides' => $rulesheetOverrides,
        'adminDbPath' => 'MariaDB/MySQL',
        'seedDbPath' => pinprof_web_root('data/opdb_catalog_v1.json'),
    ];
}

function pinprof_upsert_override(string $practiceIdentity, array $patch): void
{
    $detail = pinprof_machine_detail($practiceIdentity);
    $machine = $detail['machine'];
    $existing = pinprof_override_row($practiceIdentity) ?? [];
    $next = array_merge([
        'practice_identity' => $practiceIdentity,
        'opdb_machine_id' => $existing['opdb_machine_id'] ?? ($machine['opdbMachineId'] ?? null),
        'slug' => $existing['slug'] ?? ($machine['slug'] ?? null),
    ], $existing, $patch);

    $columns = [
        'practice_identity',
        'opdb_machine_id',
        'slug',
        'name_override',
        'variant_override',
        'manufacturer_override',
        'year_override',
        'backglass_local_path',
        'backglass_source_url',
        'backglass_source_note',
        'playfield_local_path',
        'playfield_source_url',
        'playfield_source_note',
        'rulesheet_local_path',
        'rulesheet_source_url',
        'rulesheet_source_note',
        'gameinfo_local_path',
        'notes',
    ];

    $sql = '
      INSERT INTO pinprof_machine_overrides (
        ' . implode(', ', $columns) . '
      ) VALUES (
        :' . implode(', :', $columns) . '
      )
      ON DUPLICATE KEY UPDATE
        opdb_machine_id = VALUES(opdb_machine_id),
        slug = VALUES(slug),
        name_override = VALUES(name_override),
        variant_override = VALUES(variant_override),
        manufacturer_override = VALUES(manufacturer_override),
        year_override = VALUES(year_override),
        backglass_local_path = VALUES(backglass_local_path),
        backglass_source_url = VALUES(backglass_source_url),
        backglass_source_note = VALUES(backglass_source_note),
        playfield_local_path = VALUES(playfield_local_path),
        playfield_source_url = VALUES(playfield_source_url),
        playfield_source_note = VALUES(playfield_source_note),
        rulesheet_local_path = VALUES(rulesheet_local_path),
        rulesheet_source_url = VALUES(rulesheet_source_url),
        rulesheet_source_note = VALUES(rulesheet_source_note),
        gameinfo_local_path = VALUES(gameinfo_local_path),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    ';

    $params = [];
    foreach ($columns as $column) {
        $params[$column] = $next[$column] ?? null;
    }

    $stmt = pinprof_pdo()->prepare($sql);
    $stmt->execute($params);
}

function pinprof_upsert_playfield_asset(string $practiceIdentity, string $sourceAliasId, array $patch): void
{
    $pdo = pinprof_pdo();
    $existingStmt = $pdo->prepare('
        SELECT *
        FROM pinprof_playfield_assets
        WHERE practice_identity = :practice_identity
          AND source_opdb_machine_id = :source_alias_id
    ');
    $existingStmt->execute([
        'practice_identity' => $practiceIdentity,
        'source_alias_id' => $sourceAliasId,
    ]);
    $existing = $existingStmt->fetch() ?: [];

    $stmt = $pdo->prepare('
        INSERT INTO pinprof_playfield_assets (
            practice_identity,
            source_opdb_machine_id,
            covered_alias_ids_json,
            playfield_local_path,
            playfield_source_url,
            playfield_source_note
        ) VALUES (
            :practice_identity,
            :source_alias_id,
            :covered_alias_ids_json,
            :playfield_local_path,
            :playfield_source_url,
            :playfield_source_note
        )
        ON DUPLICATE KEY UPDATE
            covered_alias_ids_json = VALUES(covered_alias_ids_json),
            playfield_local_path = VALUES(playfield_local_path),
            playfield_source_url = VALUES(playfield_source_url),
            playfield_source_note = VALUES(playfield_source_note),
            updated_at = CURRENT_TIMESTAMP
    ');
    $stmt->execute([
        'practice_identity' => $practiceIdentity,
        'source_alias_id' => $sourceAliasId,
        'covered_alias_ids_json' => pinprof_stringify_covered_alias_ids([$sourceAliasId]),
        'playfield_local_path' => $patch['playfield_local_path'] ?? ($existing['playfield_local_path'] ?? null),
        'playfield_source_url' => $patch['playfield_source_url'] ?? ($existing['playfield_source_url'] ?? null),
        'playfield_source_note' => $patch['playfield_source_note'] ?? ($existing['playfield_source_note'] ?? null),
    ]);

    $primary = pinprof_pick_primary_playfield_asset($practiceIdentity, pinprof_playfield_asset_rows($practiceIdentity));
    if ($primary !== null) {
        pinprof_upsert_override($practiceIdentity, [
            'opdb_machine_id' => $primary['source_opdb_machine_id'] ?? null,
            'playfield_local_path' => $primary['playfield_local_path'] ?? null,
            'playfield_source_url' => $primary['playfield_source_url'] ?? null,
            'playfield_source_note' => $primary['playfield_source_note'] ?? null,
        ]);
    }
}

function pinprof_reassign_playfield_asset(int $playfieldAssetId, string $sourceAliasId, array $patch): void
{
    $stmt = pinprof_pdo()->prepare('
        UPDATE pinprof_playfield_assets
        SET source_opdb_machine_id = :source_alias_id,
            covered_alias_ids_json = :covered_alias_ids_json,
            playfield_local_path = :playfield_local_path,
            playfield_source_url = :playfield_source_url,
            playfield_source_note = :playfield_source_note,
            updated_at = CURRENT_TIMESTAMP
        WHERE playfield_asset_id = :playfield_asset_id
    ');
    $stmt->execute([
        'source_alias_id' => $sourceAliasId,
        'covered_alias_ids_json' => pinprof_stringify_covered_alias_ids([$sourceAliasId]),
        'playfield_local_path' => $patch['playfield_local_path'] ?? null,
        'playfield_source_url' => $patch['playfield_source_url'] ?? null,
        'playfield_source_note' => $patch['playfield_source_note'] ?? null,
        'playfield_asset_id' => $playfieldAssetId,
    ]);
}

function pinprof_ensure_dir(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
        throw new RuntimeException("Unable to create directory: {$path}");
    }
}

function pinprof_remove_prefixed_files(string $dir, string $prefix): void
{
    foreach (glob($dir . '/' . $prefix . '*') ?: [] as $file) {
        if (is_file($file)) {
            @unlink($file);
        }
    }
}

function pinprof_rename_prefixed_files(string $dir, string $currentPrefix, string $nextPrefix): void
{
    if ($currentPrefix === $nextPrefix) {
        return;
    }
    foreach (glob($dir . '/' . $currentPrefix . '*') ?: [] as $file) {
        if (!is_file($file)) {
            continue;
        }
        $basename = basename($file);
        $nextName = preg_replace('/^' . preg_quote($currentPrefix, '/') . '/', $nextPrefix, $basename, 1);
        if (!is_string($nextName)) {
            continue;
        }
        $nextPath = $dir . '/' . $nextName;
        if (is_file($nextPath)) {
            throw new RuntimeException("Cannot rename {$currentPrefix} to {$nextPrefix}; destination already exists.");
        }
        rename($file, $nextPath);
    }
}

function pinprof_guess_extension(?string $sourceName, ?string $contentType): string
{
    $map = [
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
        'image/webp' => '.webp',
        'image/gif' => '.gif',
        'text/markdown' => '.md',
        'text/plain' => '.txt',
    ];
    $type = $contentType ? strtolower(trim($contentType)) : '';
    if ($type !== '' && isset($map[$type])) {
        return $map[$type];
    }
    $ext = strtolower((string) pathinfo((string) $sourceName, PATHINFO_EXTENSION));
    if ($ext === '') {
        return '.bin';
    }
    return '.' . $ext;
}

function pinprof_download_url(string $url): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT => 'PinProf Admin',
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HEADER => true,
        ]);
        $response = curl_exec($ch);
        if ($response === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException('Download failed: ' . $error);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException("Download failed with HTTP {$status}");
        }
        return [
            'body' => substr($response, $headerSize),
            'contentType' => $contentType,
        ];
    }

    $context = stream_context_create([
        'http' => [
            'follow_location' => 1,
            'timeout' => 30,
            'header' => "User-Agent: PinProf Admin\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        throw new RuntimeException('Download failed.');
    }
    $headers = $http_response_header ?? [];
    $contentType = '';
    foreach ($headers as $header) {
        if (stripos($header, 'Content-Type:') === 0) {
            $contentType = trim(substr($header, strlen('Content-Type:')));
            break;
        }
    }
    return [
        'body' => $body,
        'contentType' => $contentType,
    ];
}

function pinprof_store_binary_asset(
    string $practiceIdentity,
    string $kind,
    string $contents,
    ?string $sourceName,
    ?string $contentType,
    ?string $sourceUrl,
    ?string $sourceNote,
    ?string $machineAliasId = null
): void
{
    $folder = $kind === 'backglass' ? 'images/backglasses' : 'images/playfields';
    $dir = pinprof_fs_root($folder);
    pinprof_ensure_dir($dir);
    $prefix = "{$practiceIdentity}-{$kind}";
    $patch = [];
    if ($kind === 'playfield') {
        $alias = pinprof_resolve_playfield_alias($practiceIdentity, $machineAliasId, null, pinprof_override_row($practiceIdentity) ?? []);
        $aliasId = pinprof_alias_id($alias);
        if ($aliasId === null) {
            throw new RuntimeException("Unable to resolve playfield alias for {$practiceIdentity}");
        }
        $prefix = pinprof_playfield_filename_base($aliasId);
    }
    pinprof_remove_prefixed_files($dir, $prefix);
    $ext = pinprof_guess_extension($sourceName, $contentType);
    $filename = $prefix . $ext;
    $path = $dir . '/' . $filename;
    file_put_contents($path, $contents);

    $patch = array_merge($patch, $kind === 'backglass'
        ? [
            'backglass_local_path' => pinprof_web_root($folder . '/' . $filename),
            'backglass_source_url' => $sourceUrl,
            'backglass_source_note' => $sourceNote,
        ]
        : [
            'playfield_local_path' => pinprof_web_root($folder . '/' . $filename),
            'playfield_source_url' => $sourceUrl,
            'playfield_source_note' => $sourceNote,
        ]);
    if ($kind === 'backglass') {
        pinprof_upsert_override($practiceIdentity, $patch);
        return;
    }
    pinprof_upsert_playfield_asset(
        $practiceIdentity,
        $aliasId,
        $patch
    );
}

function pinprof_save_playfield_coverage(
    string $practiceIdentity,
    string $sourceAliasId,
    ?string $sourceUrl,
    ?string $sourceNote
): void
{
    $prefix = pinprof_playfield_filename_base($sourceAliasId);
    $existingPath = pinprof_find_playfield_web_path_by_prefix($prefix);
    if ($existingPath === null) {
        $legacyPrefix = pinprof_practice_playfield_prefix($practiceIdentity);
        $legacyPath = pinprof_find_playfield_web_path_by_prefix($legacyPrefix);
        if ($legacyPath !== null) {
            pinprof_rename_prefixed_files(pinprof_fs_root('images/playfields'), $legacyPrefix, $prefix);
            $existingPath = pinprof_find_playfield_web_path_by_prefix($prefix);
        }
    }
    if ($existingPath === null) {
        throw new RuntimeException("No local playfield file found for {$sourceAliasId}. Upload or import one first.");
    }

    $existingAsset = null;
    foreach (pinprof_playfield_asset_rows($practiceIdentity) as $row) {
        if (($row['source_opdb_machine_id'] ?? null) === $sourceAliasId) {
            $existingAsset = $row;
            break;
        }
    }
    $fallbackAsset = $existingAsset ?? pinprof_resolve_playfield_asset_for_alias($practiceIdentity, $sourceAliasId);

    if ($existingAsset === null && $fallbackAsset !== null && ($fallbackAsset['source_opdb_machine_id'] ?? null) !== $sourceAliasId) {
        pinprof_reassign_playfield_asset((int) ($fallbackAsset['playfield_asset_id'] ?? 0), $sourceAliasId, [
            'playfield_local_path' => $existingPath,
            'playfield_source_url' => $sourceUrl ?? ($fallbackAsset['playfield_source_url'] ?? null),
            'playfield_source_note' => $sourceNote ?? ($fallbackAsset['playfield_source_note'] ?? null),
        ]);
        $primary = pinprof_pick_primary_playfield_asset($practiceIdentity, pinprof_playfield_asset_rows($practiceIdentity));
        if ($primary !== null) {
            pinprof_upsert_override($practiceIdentity, [
                'opdb_machine_id' => $primary['source_opdb_machine_id'] ?? null,
                'playfield_local_path' => $primary['playfield_local_path'] ?? null,
                'playfield_source_url' => $primary['playfield_source_url'] ?? null,
                'playfield_source_note' => $primary['playfield_source_note'] ?? null,
            ]);
        }
        return;
    }

    pinprof_upsert_playfield_asset($practiceIdentity, $sourceAliasId, [
        'playfield_local_path' => $existingPath,
        'playfield_source_url' => $sourceUrl ?? ($existingAsset['playfield_source_url'] ?? null),
        'playfield_source_note' => $sourceNote ?? ($existingAsset['playfield_source_note'] ?? null),
    ]);
}

function pinprof_save_rulesheet_markdown(string $practiceIdentity, string $markdown, ?string $sourceUrl, ?string $sourceNote): void
{
    $clean = trim($markdown);
    if ($clean === '') {
        throw new RuntimeException('Rulesheet markdown cannot be empty.');
    }
    $dir = pinprof_fs_root('rulesheets');
    pinprof_ensure_dir($dir);
    $filename = $practiceIdentity . '-rulesheet.md';
    file_put_contents($dir . '/' . $filename, $clean . "\n");
    pinprof_upsert_override($practiceIdentity, [
        'rulesheet_local_path' => pinprof_web_root('rulesheets/' . $filename),
        'rulesheet_source_url' => $sourceUrl,
        'rulesheet_source_note' => $sourceNote,
    ]);
}
