import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Hospital, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { epicRequest, type EpicConnection, type EpicImport } from "@/lib/external-import";

export const Route = createFileRoute("/external-import")({
  head: () => ({ meta: [{ title: "Import records — Medilink" }] }),
  component: ExternalImport,
});

function ExternalImport() {
  const [account, setAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<EpicConnection | null>(null);
  const [job, setJob] = useState<EpicImport | null>(null);
  const [starting, setStarting] = useState(false);
  const currentAccount = useRef<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (currentAccount.current !== (session?.user.id ?? null)) {
        setConnection(null);
        setJob(null);
        setError("");
      }
      currentAccount.current = session?.user.id ?? null;
      setAccount(session?.user.id ?? null);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setConnection(null);
    setJob(null);
    setStarting(false);
    setBusy(false);
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
  const running = job?.status === "running";
  useEffect(() => {
    if (!account) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await epicRequest<EpicImport>("import");
        if (active && currentAccount.current === account) setJob(result);
      } catch (err) {
        if (active && currentAccount.current === account)
          setError(err instanceof Error ? err.message : "Could not check the import.");
      } finally {
        if (active) timer = setTimeout(() => void refresh(), running ? 2000 : 30000);
      }
    };
    void refresh();
    const onFocus = () => {
      clearTimeout(timer);
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [account, running]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await epicRequest<{ authorization_url: string }>("authorize", {});
      if (currentAccount.current !== account) return;
      window.location.assign(result.authorization_url);
    } catch (err) {
      if (currentAccount.current === account) {
        setError(err instanceof Error ? err.message : "Could not connect to Epic.");
        setBusy(false);
      }
    }
  }
  async function startImport() {
    setStarting(true);
    setError("");
    try {
      const result = await epicRequest<EpicImport>("import", {});
      if (currentAccount.current === account) setJob(result);
    } catch (err) {
      if (currentAccount.current === account)
        setError(err instanceof Error ? err.message : "Could not start the import.");
    } finally {
      if (currentAccount.current === account) setStarting(false);
    }
  }
  const ready = connection?.ready_for_import && (connection.expires_at ?? 0) * 1000 > Date.now();
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-tx">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to={account ? "/records" : "/signin"} className="text-sm text-mut hover:text-tx">
          {account ? "← View your records" : "← Back to sign in"}
        </Link>
        <h1 className="text-3xl font-semibold">Import your records</h1>
        <p className="text-mut">
          Connect to Epic Sandbox and import the records available to your authorized account.
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
                    Epic connection:{" "}
                    <strong>
                      {connection.token_exchange_succeeded ? "Connected" : "Not connected"}
                    </strong>
                  </p>
                  <p className={ready ? "text-aurora" : "text-mut"}>
                    Record import: {ready ? "Ready" : "Connect again to authorize"}
                  </p>
                  <p className="text-sm text-mut">{connection.reason}</p>
                  {connection.expires_at && (
                    <p className="text-xs text-mut">
                      Expires: {new Date(connection.expires_at * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              <Button
                onClick={connect}
                disabled={busy || running || starting}
                className="gradient-aurora text-ink"
              >
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
          <h2 className="font-semibold">Import records</h2>
          <p className="text-sm text-mut">
            Import patient details, vital signs, lab results, conditions, medication orders, and
            encounters. Records are saved for the MediLink account you are signed into. Some sandbox
            patients have no records in particular categories.
          </p>
          <Button
            onClick={() => void startImport()}
            disabled={!account || !ready || running || starting || busy}
            variant="outline"
          >
            {(running || starting) && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {running || starting
              ? "Importing records…"
              : job?.status === "completed"
                ? "Import again"
                : "Import from Epic"}
          </Button>
          {job && job.status !== "idle" && (
            <div
              className="space-y-4 rounded-xl border border-line bg-surface2/40 p-4"
              role={job.status === "failed" ? "alert" : "status"}
            >
              <p className={job.status === "failed" ? "text-red-400" : "text-tx"}>{job.message}</p>
              {running && (
                <div
                  role="progressbar"
                  aria-label="Epic record import"
                  aria-valuemin={0}
                  aria-valuemax={job.total_steps ?? 6}
                  aria-valuenow={job.completed_steps ?? 0}
                  className="h-2 overflow-hidden rounded-full bg-surface2"
                >
                  <div
                    className="gradient-aurora h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(5, Math.min(100, ((job.completed_steps ?? 0) / (job.total_steps ?? 6)) * 100))}%`,
                    }}
                  />
                </div>
              )}
              {job.status === "completed" && (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {(
                      [
                        ["Patient details", "Patient"],
                        ["Vital signs and labs", "Observation"],
                        ["Conditions", "Condition"],
                        ["Medication orders", "MedicationRequest"],
                        ["Encounters", "Encounter"],
                      ] as const
                    ).map(([label, kind]) => (
                      <div key={kind} className="rounded-lg border border-line p-3">
                        <dt className="text-mut">{label}</dt>
                        <dd className="mt-1 text-lg font-semibold">{job.counts?.[kind] ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-aurora">
                    {job.digest_verified
                      ? "Saved records verified."
                      : "Saved-record verification unavailable."}
                  </p>
                  <Link
                    to="/records"
                    className="inline-block text-sm font-semibold text-aurora underline"
                  >
                    View imported records
                  </Link>
                  {job.completed_at && (
                    <p className="text-xs text-mut">
                      Imported {new Date(job.completed_at * 1000).toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-mut">{job.coverage_note}</p>
                  {!!job.notices?.length && (
                    <p className="text-sm text-mut">
                      Epic returned {job.notices.length} notice(s) about this import. Coverage
                      limits and empty results are included in the saved report.
                    </p>
                  )}
                  {!!job.mapping_warning_count && (
                    <p className="text-sm text-amber-300">
                      Some record fields need review. The original Epic records were preserved.
                    </p>
                  )}
                </>
              )}
              {job.status === "failed" && (
                <p className="text-sm text-mut">
                  Reconnect if your authorization expired, then try importing again.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
