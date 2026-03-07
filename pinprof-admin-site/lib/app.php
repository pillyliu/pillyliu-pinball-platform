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

    $playfieldKind = $override['playfield_local_path'] ?? null
        ? 'pillyliu'
        : ($curated['playfieldLocalPath'] ? 'pillyliu' : pinprof_url_kind($effectivePlayfieldUrl));
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
            'playfieldAliasId' => $playfieldAliasId,
            'playfieldLocalPath' => pinprof_clean_string($override['playfield_local_path'] ?? null),
            'playfieldSourceUrl' => (string) ($override['playfield_source_url'] ?? ''),
            'playfieldSourceNote' => (string) ($override['playfield_source_note'] ?? ''),
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
                    'effectiveLabel' => pinprof_asset_label($playfieldKind, $playfieldKind === 'pillyliu' ? 'override/library image' : 'playfield image'),
                    'effectiveUrl' => $effectivePlayfieldUrl,
                    'targetAliasId' => $playfieldAliasId,
                    'targetAliasLabel' => pinprof_alias_label($playfieldAlias),
                    'targetFilename' => pinprof_playfield_filename_base($playfieldAliasId),
                    'localPath' => pinprof_pick_first_non_empty([
                        $override['playfield_local_path'] ?? null,
                        $curated['playfieldLocalPath'],
                    ]),
                    'localSourceUrl' => pinprof_pick_first_non_empty([
                        $override['playfield_source_url'] ?? null,
                        $curatedPlayfieldUrl,
                    ]),
                    'localSourceNote' => pinprof_clean_string($override['playfield_source_note'] ?? null),
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
                $override['playfield_local_path'] ?? null,
                $curated['playfieldLocalPath'],
            ]),
            'rulesheetLocalPath' => pinprof_pick_first_non_empty([
                $override['rulesheet_local_path'] ?? null,
                $curated['rulesheetLocalPath'],
            ]),
            'hasAdminOverride' => $override !== null,
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
    $overriddenMachines = (int) $pdo->query('SELECT COUNT(*) FROM pinprof_machine_overrides')->fetchColumn();
    $playfieldOverrides = (int) $pdo->query("SELECT COUNT(*) FROM pinprof_machine_overrides WHERE playfield_local_path IS NOT NULL AND playfield_local_path != ''")->fetchColumn();
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
        $override = pinprof_override_row($practiceIdentity) ?? [];
        $alias = pinprof_resolve_playfield_alias($practiceIdentity, $machineAliasId, null, $override);
        $aliasId = pinprof_alias_id($alias);
        if ($aliasId === null) {
            throw new RuntimeException("Unable to resolve playfield alias for {$practiceIdentity}");
        }
        $prefix = pinprof_playfield_filename_base($aliasId);
        $existingPrefix = pinprof_playfield_prefix_from_web_path($override['playfield_local_path'] ?? null);
        if ($existingPrefix !== null && $existingPrefix !== $prefix) {
            pinprof_remove_prefixed_files($dir, $existingPrefix);
        }
        $patch['opdb_machine_id'] = $aliasId;
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
    pinprof_upsert_override($practiceIdentity, $patch);
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
