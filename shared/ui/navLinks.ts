export const NAV_LINKS = [
  { href: "https://pillyliu.com/", label: "Home" },
  { href: "https://pillyliu.com/lpl-stats/", label: "Stats" },
  { href: "https://pillyliu.com/lpl-standings/", label: "Standings" },
  { href: "https://pillyliu.com/lpl-targets/", label: "Targets" },
  { href: "https://pillyliu.com/lpl-library/", label: "Library" },
] as const;

export type NavLabel = (typeof NAV_LINKS)[number]["label"];
