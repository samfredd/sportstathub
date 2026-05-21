"use client";

import { createContext, useContext, useState, useCallback } from "react";
import UpgradeModal from "@/components/UpgradeModal";

interface UpgradeModalContextValue {
  openUpgradeModal: (feature?: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue>({
  openUpgradeModal: () => {},
});

export function useUpgradeModal() {
  return useContext(UpgradeModalContext);
}

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string | undefined>(undefined);

  const openUpgradeModal = useCallback((feat?: string) => {
    setFeature(feat);
    setOpen(true);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ openUpgradeModal }}>
      {children}
      <UpgradeModal open={open} onClose={() => setOpen(false)} feature={feature} />
    </UpgradeModalContext.Provider>
  );
}
