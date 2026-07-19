export const sports = ["FOOTBALL", "BASKETBALL", "TENNIS", "CRICKET", "RUGBY"] as const;
export const predictionStatuses = ["DRAFT", "PUBLISHED", "WON", "LOST", "VOID", "ARCHIVED"] as const;
export const bookingCodeStatuses = ["ACTIVE", "EXPIRED", "SETTLED"] as const;

export type Sport = (typeof sports)[number];
export type PredictionStatus = (typeof predictionStatuses)[number];
export type BookingCodeStatus = (typeof bookingCodeStatuses)[number];

export type AuthenticatedUser = {
  id: number;
  role: "user" | "creator_pending" | "creator" | "creator_suspended" | "creator_rejected" | "moderator" | "admin";
};

export type ApiErrorBody = {
  error: string;
  details?: unknown;
};
