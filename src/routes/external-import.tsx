import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Hospital, LoaderCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sampleImportResults, type ImportStage } from "@/lib/external-import";

export const Route = createFileRoute("/external-import")({
  head: () => ({ meta: [{ title: "Import records — Medilink" }] }),
  component: ExternalImport,
});

function ExternalImport() {
  const [account, setAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [sampleAccount, setSampleAccount] = useState(false);
  const [stage, setStage] = useState<ImportStage>("disconnected");
  const [authorizationOpen, setAuthorizationOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failImport, setFailImport] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    let currentUserId: string | null = null;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      revision += 1;
      if (!cancelled) {
        setAccount(session?.user.email ?? (session ? "Your Medilink account" : null));
        const nextUserId = session?.user.id ?? null;
        if (nextUserId !== currentUserId) {
          setStage("disconnected");
          setAuthorizationOpen(false);
          setSampleAccount(false);
          setError("");
          setProgress(0);
        }
        currentUserId = nextUserId;
        setChecking(false);
      }
    });
    const initialRevision = revision;
    void supabase.auth
      .getUser()
      .then(({ data, error: authError }) => {
        if (cancelled || revision !== initialRevision) return;
        currentUserId = data.user?.id ?? null;
        setAccount(data.user?.email ?? (data.user ? "Your Medilink account" : null));
        if (authError && authError.name !== "AuthSessionMissingError")
          setAccountError(
            "Could not check your Medilink session. You can sign in again or explore the sample flow.",
          );
      })
      .catch(() => {
        if (!cancelled)
          setAccountError(
            "Could not check your Medilink session. You can explore the sample flow.",
          );
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (stage !== "connecting") return;
    const timer = window.setTimeout(() => setStage("connected"), 800);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "importing") return;
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(value + 20, 100));
    }, 600);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "importing") return;
    if (failImport && progress >= 60) {
      setStage("import-error");
      setError("The sample import was interrupted. Retry to preview a successful import.");
    } else if (progress === 100) setStage("complete");
  }, [stage, progress, failImport]);

  function startImport() {
    setError("");
    setProgress(0);
    setStage("importing");
  }

  const ready = !!account || sampleAccount;
  const busy = stage === "connecting" || stage === "importing";
  const connected = ["connected", "importing", "import-error", "complete"].includes(stage);
  const status =
    stage === "connecting"
      ? "Connecting…"
      : connected
        ? "Connected (simulated)"
        : stage === "cancelled"
          ? "Connection cancelled"
          : stage === "connection-error"
            ? "Connection failed"
            : "Not connected";

  return (
    <main className="relative min-h-screen bg-ink px-4 py-10 font-sans text-tx antialiased">
      <div className="pointer-events-none fixed inset-0 aurora-field" />
      <div className="relative mx-auto w-full max-w-2xl">
        <Link
          to="/signin"
          className="mb-6 inline-flex items-center gap-2 rounded text-sm text-mut hover:text-tx focus-visible:ring-2 focus-visible:ring-aurora"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to sign in
        </Link>
        <section className="space-y-6 rounded-xl border border-line/70 bg-surface/70 p-6 backdrop-blur-xl sm:p-8">
          <header>
            <p className="mb-2 text-xs uppercase tracking-widest text-aurora">
              Medilink · External import
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Bring your records with you</h1>
            <p className="mt-2 text-sm leading-6 text-mut">
              Connect your provider, then import your health history into your vault.
            </p>
          </header>
          <p className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-200">
            Interactive preview: connections and imports are simulated. No Epic account is accessed
            and no records are saved.
          </p>
          <section aria-labelledby="account-heading" className="space-y-3">
            <h2 id="account-heading" className="font-medium">
              1. Your Medilink account
            </h2>
            {checking ? (
              <p role="status" className="text-sm text-mut">
                Checking sign-in…
              </p>
            ) : account ? (
              <p className="break-all text-sm text-mut">Signed in as {account}</p>
            ) : sampleAccount ? (
              <p className="text-sm text-mut">Using a sample account for this preview.</p>
            ) : (
              <>
                <p className="text-sm text-mut">
                  Sign in to choose the account that will receive your records, or explore with a
                  sample account.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to="/signin" search={{ returnTo: "/external-import" }}>
                      Sign in to Medilink
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setSampleAccount(true)}>
                    Preview with sample account
                  </Button>
                </div>
              </>
            )}
            {accountError && (
              <p role="alert" className="text-sm text-amber-200">
                {accountError}
              </p>
            )}
          </section>
          <section
            aria-labelledby="provider-heading"
            className="space-y-4 border-t border-line pt-5"
          >
            <h2 id="provider-heading" className="font-medium">
              2. Connect your provider
            </h2>
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface2/40 p-4">
              <Hospital className="mt-1 size-6 shrink-0 text-aurora" aria-hidden="true" />
              <div>
                <h3 className="font-medium">Epic Sandbox</h3>
                <p className="mt-1 text-sm text-mut">Test patient records</p>
                <p role="status" className="mt-2 text-sm text-aurora">
                  {status}
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-mut">
              When live connections are available, you’ll sign in and approve access on Epic’s
              website.
            </p>
            {!connected && (
              <Button
                disabled={!ready || checking || busy}
                onClick={() => {
                  setError("");
                  setAuthorizationOpen(true);
                }}
              >
                {busy && <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                {stage === "connecting"
                  ? "Connecting…"
                  : stage === "connection-error"
                    ? "Retry connection"
                    : "Connect to Epic Sandbox"}
              </Button>
            )}
            {stage === "cancelled" && (
              <p className="text-sm text-mut">
                Nothing was connected. You can try again whenever you’re ready.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
          </section>
          {connected && (
            <section
              aria-labelledby="import-heading"
              className="space-y-4 border-t border-line pt-5"
            >
              <h2 id="import-heading" className="font-medium">
                3. Import your records
              </h2>
              <p className="text-sm text-mut">
                Sample patient: Alex Morgan. This preview includes medications, allergies, lab
                results, and documents.
              </p>
              {(stage === "connected" || stage === "import-error") && (
                <>
                  <Button
                    onClick={() => {
                      if (stage === "import-error") setFailImport(false);
                      startImport();
                    }}
                  >
                    {stage === "import-error" ? "Retry sample import" : "Import sample records"}
                  </Button>
                  {stage === "connected" && (
                    <label className="flex items-center gap-2 text-xs text-mut">
                      <input
                        type="checkbox"
                        checked={failImport}
                        onChange={(event) => setFailImport(event.target.checked)}
                      />
                      Preview an interrupted import
                    </label>
                  )}
                </>
              )}
              {stage === "importing" && (
                <div className="space-y-3">
                  <label htmlFor="import-progress" className="block text-sm" role="status">
                    Importing sample records… {progress}%
                  </label>
                  <progress
                    id="import-progress"
                    value={progress}
                    max={100}
                    className="h-3 w-full accent-emerald-400"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStage("connected");
                      setProgress(0);
                    }}
                  >
                    Cancel sample import
                  </Button>
                </div>
              )}
              {stage === "complete" && (
                <div className="space-y-4">
                  <p role="status" className="flex items-center gap-2 font-medium text-aurora">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                    Sample import complete
                  </p>
                  <ul className="divide-y divide-line rounded-lg border border-line px-4">
                    {sampleImportResults.map((result) => (
                      <li key={result.label} className="flex justify-between py-3 text-sm">
                        <span>{result.label}</span>
                        <span>{result.count}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-mut">
                    These sample results are for preview only. Your vault has not changed.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStage("connected");
                      setFailImport(false);
                      setProgress(0);
                    }}
                  >
                    Try again
                  </Button>
                </div>
              )}
              {!busy && (
                <button
                  className="block rounded text-sm text-mut underline focus-visible:ring-2 focus-visible:ring-aurora"
                  onClick={() => {
                    setStage("disconnected");
                    setError("");
                    setProgress(0);
                  }}
                >
                  Reset sample connection
                </button>
              )}
            </section>
          )}
        </section>
      </div>
      <Dialog
        open={authorizationOpen}
        onOpenChange={(open) => {
          setAuthorizationOpen(open);
          if (!open) setStage("cancelled");
        }}
      >
        <DialogContent className="border-line bg-ink text-tx">
          <DialogTitle>Preview Epic authorization</DialogTitle>
          <DialogDescription>
            This simulates returning from Epic after approving or declining access. No credentials
            are needed.
          </DialogDescription>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setAuthorizationOpen(false);
                setStage("connecting");
              }}
            >
              Simulate approval
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAuthorizationOpen(false);
                setStage("cancelled");
              }}
            >
              Cancel connection
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAuthorizationOpen(false);
                setStage("connection-error");
                setError(
                  "Could not connect to Epic Sandbox in this simulated attempt. Please retry.",
                );
              }}
            >
              Simulate connection error
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
