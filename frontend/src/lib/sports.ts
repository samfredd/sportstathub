// `comingSoon: true` means the sport is shown in selectors but disabled — it
// fires no API calls. Only football is wired end-to-end today, so every other
// sport is parked until its data pipeline is complete. This keeps the limited
// daily API-Football quota focused on football.
export const MATCH_SPORT_OPTIONS = [
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball", comingSoon: true },
  { id: "baseball", label: "Baseball", comingSoon: true },
  { id: "hockey", label: "Hockey", comingSoon: true },
  { id: "volleyball", label: "Volleyball", comingSoon: true },
] as const;

export const PREDICTION_SPORT_OPTIONS = [
  ...MATCH_SPORT_OPTIONS,
  { id: "tennis", label: "Tennis", comingSoon: true },
] as const;

/** Sports that are fully wired and safe to fetch data for. */
export const ACTIVE_SPORT_IDS = MATCH_SPORT_OPTIONS
  .filter((sport) => !("comingSoon" in sport && sport.comingSoon))
  .map((sport) => sport.id);

export function isSportComingSoon(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return PREDICTION_SPORT_OPTIONS.some(
    (sport) => sport.id === normalized && "comingSoon" in sport && sport.comingSoon,
  );
}

export const SPORT_LABELS = PREDICTION_SPORT_OPTIONS.map((sport) => sport.label);

export function getSportLabel(value?: string | null): string {
  if (!value) return "";
  const normalized = value.toLowerCase();
  return PREDICTION_SPORT_OPTIONS.find((sport) => sport.id === normalized || sport.label.toLowerCase() === normalized)?.label ?? value;
}
