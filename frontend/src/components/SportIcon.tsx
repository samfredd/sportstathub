import { TrophyIcon } from "@/components/Icons";

export default function SportIcon({ sport, className = "w-4 h-4" }: { sport?: string, className?: string }) {
  const normalized = sport?.toLowerCase?.() ?? "";
  if (normalized === "football") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 6.93 2.79L12 12 5.07 4.79A10 10 0 0 1 12 2z" />
        <path d="M2.46 8.63 12 12l-1.5 9.93" />
        <path d="M21.54 8.63 12 12l1.5 9.93" />
      </svg>
    );
  }
  if (normalized === "basketball") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M4.93 4.93c4.08 4.08 6.36 9.56 6.36 15.07" />
        <path d="M19.07 4.93c-4.08 4.08-6.36 9.56-6.36 15.07" />
        <path d="M2 12h20" />
      </svg>
    );
  }
  if (normalized === "baseball") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M5.5 5.5c4 2.5 9 2.5 13 0" />
        <path d="M5.5 18.5c4-2.5 9-2.5 13 0" />
      </svg>
    );
  }
  if (normalized === "hockey") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v7.5c0 2.5 1.5 4.5 4 4.5h2" />
        <path d="M18 3v11c0 2.2-1.8 4-4 4H9" />
        <path d="M4 21h7" />
        <path d="M13 21h7" />
      </svg>
    );
  }
  if (normalized === "tennis") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12c2.76 0 5-4.03 5-9" />
        <path d="M22 12c-2.76 0-5-4.03-5-9" />
        <path d="M2 12c2.76 0 5 4.03 5 9" />
        <path d="M22 12c-2.76 0-5 4.03-5 9" />
      </svg>
    );
  }
  if (normalized === "volleyball") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2c1.8 3.2 1.8 6.8 0 10" />
        <path d="M12 12c3.2-1.8 6.8-1.8 10 0" />
        <path d="M12 12c-1.8 3.2-1.8 6.8 0 10" />
        <path d="M12 12C8.8 13.8 5.2 13.8 2 12" />
      </svg>
    );
  }
  return <TrophyIcon className={className} />;
}
