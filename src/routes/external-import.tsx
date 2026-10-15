import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hospital, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { epicRequest, type EpicConnection } from "@/lib/external-import";

export const Route = createFileRoute("/external-import")({
  head: () => ({ meta: [{ title: "Import records — Medilink" }] }),
  component: ExternalImport,
});

function ExternalImport() {
  const [account, setAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<EpicConnection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user.id ?? null);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setConnection(null);
    setError("");
    if (!account) return;
    const refresh = () => {
      void epicRequest<EpicConnection>("connection")
        .then((result) => {
          if (active) {
            setConnection(result);
            setError("");
          }
        })
        .catch((err: Error) => {
          if (active) {
            setConnection(null);
            setError(err.message);
          }
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [account]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await epicRequest<{ authorization_url: string }>("authorize", {});
      window.location.assign(result.authorization_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Epic.");
      setBusy(false);
    }
  }
  const ready = connection?.ready_for_transfer && (connection.expires_at ?? 0) * 1000 > Date.now();
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-tx">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/signin" className="text-sm text-mut hover:text-tx">
          ← Back to sign in
        </Link>
        <h1 className="text-3xl font-semibold">Import your records</h1>
        <p className="text-mut">
          Connect your Epic Sandbox account to prepare for a future transfer.
        </p>
        <section className="space-y-5 rounded-2xl border border-line bg-surface/70 p-6">
          <Hospital className="h-8 w-8 text-aurora" />
          <h2 className="text-xl font-semibold">Epic Sandbox</h2>
          <p className="text-sm text-mut">
            Sign in on Epic’s website and choose the patient account to connect to your signed-in
            MediLink account.
          </p>
          {checking ? (
            <p role="status">Checking your MediLink session…</p>
          ) : !account ? (
            <Button asChild>
              <Link to="/signin" search={{ returnTo: "/external-import" }}>
                Sign in to MediLink first
              </Link>
            </Button>
          ) : (
            <>
              {connection && (
                <div
                  className="space-y-2 rounded-xl border border-line bg-surface2/40 p-4"
                  role="status"
                >
                  <p>
                    Token exchange:{" "}
                    <strong>
                      {connection.token_exchange_succeeded ? "Successful" : "Not completed"}
                    </strong>
                  </p>
                  <p className={ready ? "text-aurora" : "text-mut"}>
                    Transfer authorization: {ready ? "Ready" : "Not ready"}
                  </p>
                  <p className="text-sm text-mut">{connection.reason}</p>
                  {connection.expires_at && (
                    <p className="text-xs text-mut">
                      Expires: {new Date(connection.expires_at * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              <Button onClick={connect} disabled={busy} className="gradient-aurora text-ink">
                {busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {busy
                  ? "Opening Epic…"
                  : connection?.token_exchange_succeeded
                    ? "Reconnect Epic Sandbox"
                    : "Connect Epic Sandbox"}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </section>
        <section className="space-y-3 rounded-2xl border border-line p-6">
          <h2 className="font-semibold">Data transfer</h2>
          <p className="text-sm text-mut">
            No EHR records are downloaded yet. A ready connection confirms authorization for Patient
            data; actual record availability will be checked when transfers are implemented. Connect
            again if your authorization expires.
          </p>
          <Button disabled variant="outline">
            Data transfer coming later
          </Button>
        </section>
      </div>
    </main>
  );
}
