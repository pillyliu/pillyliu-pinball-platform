export const NAV_LINKS = [
  { href: "https://pillyliu.com/", label: "Home" },
  { href: "https://pillyliu.com/lpl_library/", label: "Library" },
  { href: "https://pillyliu.com/lpl_stats/", label: "Stats" },
  { href: "https://pillyliu.com/lpl_standings/", label: "Standings" },
  { href: "https://pillyliu.com/lpl_targets/", label: "Targets" },
] as const;

export type NavLabel = (typeof NAV_LINKS)[number]["label"];
