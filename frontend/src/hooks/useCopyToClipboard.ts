"use client";
import { useState, useCallback } from "react";

interface UseCopyToClipboardReturn {
  copied: boolean;
  copiedValue: string | null;
  copy: (text: string) => Promise<boolean>;
}

export function useCopyToClipboard(resetDelay = 2000): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard) return false;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopiedValue(text);
      setTimeout(() => {
        setCopied(false);
        setCopiedValue(null);
      }, resetDelay);
      return true;
    } catch {
      return false;
    }
  }, [resetDelay]);

  return { copied, copiedValue, copy };
}
