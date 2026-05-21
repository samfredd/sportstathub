export const MATCH_SPORT_OPTIONS = [
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball" },
  { id: "baseball", label: "Baseball" },
  { id: "hockey", label: "Hockey" },
  { id: "volleyball", label: "Volleyball" },
] as const;

export const PREDICTION_SPORT_OPTIONS = [
  ...MATCH_SPORT_OPTIONS,
  { id: "tennis", label: "Tennis" },
] as const;

export const SPORT_LABELS = PREDICTION_SPORT_OPTIONS.map((sport) => sport.label);

export function getSportLabel(value?: string | null): string {
  if (!value) return "";
  const normalized = value.toLowerCase();
  return PREDICTION_SPORT_OPTIONS.find((sport) => sport.id === normalized || sport.label.toLowerCase() === normalized)?.label ?? value;
}
