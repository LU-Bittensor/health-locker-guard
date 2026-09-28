import { useEffect, useState, type ReactNode } from "react";
import { DemoAccountContext, demoAccounts, type DemoAccount } from "@/lib/demo-account";
import { localGrantDemo } from "@/lib/grant-api";

export function DemoAccountProvider({ children }: { children: ReactNode }) {
  const [demoUser, setAccount] = useState<DemoAccount>("patient");
  const [ready, setReady] = useState(!localGrantDemo);
  useEffect(() => {
    if (!localGrantDemo) return;
    try {
      const saved = sessionStorage.getItem("medilink-demo-account");
      if (saved && Object.hasOwn(demoAccounts, saved)) setAccount(saved as DemoAccount);
    } catch {
      /* Continue with an in-memory selection if storage is unavailable. */
    }
    setReady(true);
  }, []);

  function setDemoUser(account: DemoAccount) {
    setAccount(account);
    try {
      sessionStorage.setItem("medilink-demo-account", account);
    } catch {
      /* Optional persistence. */
    }
  }

  return (
    <DemoAccountContext.Provider value={{ demoUser, setDemoUser }}>
      {ready ? children : <div className="min-h-screen bg-ink p-8 text-tx">Loading account…</div>}
    </DemoAccountContext.Provider>
  );
}
