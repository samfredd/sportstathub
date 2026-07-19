"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { adminApi, StepUpRequiredError } from "@/lib/adminApi";
import StepUpModal from "./StepUpModal";

interface PendingChallenge {
  error: StepUpRequiredError;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

interface StepUpContextValue {
  // Wraps a sensitive adminApi call. On ADMIN_STEP_UP_REQUIRED it shows the
  // verification modal and, once the admin re-proves recent MFA, retries the
  // original request exactly once and resolves with its result.
  withStepUp: <T,>(fn: () => Promise<T>) => Promise<T>;
}

const StepUpContext = createContext<StepUpContextValue | null>(null);

export function useAdminStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useAdminStepUp must be used within AdminStepUpProvider");
  return ctx;
}

export default function AdminStepUpProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingChallenge | null>(null);

  const withStepUp = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof StepUpRequiredError) {
        return new Promise<T>((resolve, reject) => {
          setPending({ error: err, resolve, reject });
        });
      }
      throw err;
    }
  }, []);

  async function handleVerify(code: string, isRecovery: boolean) {
    if (!pending) return;
    if (isRecovery) await adminApi.recoverStepUp(pending.error.challengeId, code);
    else await adminApi.verifyStepUp(pending.error.challengeId, code);
    const result = await pending.error.retry();
    pending.resolve(result);
    setPending(null);
  }

  function handleCancel() {
    pending?.reject(Object.assign(new Error("Step-up verification cancelled"), { status: 401 }));
    setPending(null);
  }

  return (
    <StepUpContext.Provider value={{ withStepUp }}>
      {children}
      {pending && <StepUpModal onVerify={handleVerify} onCancel={handleCancel} />}
    </StepUpContext.Provider>
  );
}
