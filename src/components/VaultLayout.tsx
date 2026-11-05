import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { demoAccounts, useDemoAccount, type DemoAccount } from "@/lib/demo-account";
import { localGrantDemo } from "@/lib/grant-api";
import { supabase } from "@/integrations/supabase/client";

export function VaultLayout({ children }: { children: ReactNode }) {
  const { demoUser, setDemoUser } = useDemoAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await navigate({ to: "/signin", replace: true });
  }
  return (
    <div className="relative min-h-screen bg-ink font-sans text-tx antialiased">
      <div className="pointer-events-none fixed inset-0 aurora-field" />
      <div className="relative">
        <header className="border-b border-line/70 bg-ink/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-8">
            <Link to="/records" className="text-lg font-semibold tracking-tight">
              Medilink
            </Link>
            <nav aria-label="Main navigation" className="flex gap-2 text-sm">
              <Link
                to="/records"
                activeOptions={{ exact: true }}
                className="rounded-md px-3 py-2"
                activeProps={{ className: "bg-surface2 text-aurora" }}
                inactiveProps={{ className: "text-mut hover:text-tx" }}
              >
                Records
              </Link>
              <Link
                to="/access"
                className="rounded-md px-3 py-2"
                activeProps={{ className: "bg-surface2 text-aurora" }}
                inactiveProps={{ className: "text-mut hover:text-tx" }}
              >
                Access ledger
              </Link>
              {!localGrantDemo && (
                <Link to="/external-import" className="rounded-md px-3 py-2 text-mut hover:text-tx">
                  Import records
                </Link>
              )}
            </nav>
            <div className="ml-auto">
              {localGrantDemo ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border border-aurora/30 px-2 py-1 text-aurora">
                    Local demo
                  </span>
                  <label htmlFor="demo-account">Test as</label>
                  <select
                    id="demo-account"
                    value={demoUser}
                    onChange={(event) => setDemoUser(event.target.value as DemoAccount)}
                    className="rounded-md border border-line bg-surface2 px-3 py-2 text-tx"
                  >
                    {Object.entries(demoAccounts).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <button
                  onClick={() => void signOut()}
                  className="rounded-md border border-line px-3 py-2 text-xs"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </header>
        {error && (
          <p role="alert" className="mx-auto max-w-6xl px-8 pt-4 text-red-400">
            {error}
          </p>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
