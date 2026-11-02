import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { epicRequest, type EpicConnection } from "@/lib/external-import";

export const Route = createFileRoute("/external-import_/callback")({
  head: () => ({
    meta: [{ title: "Epic connection — Medilink" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: EpicCallback,
});

function EpicCallback() {
  const pending = useRef<Promise<EpicConnection> | null>(null);
  const [result, setResult] = useState<EpicConnection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!pending.current) {
      const params = new URLSearchParams(window.location.search);
      // Remove authorization credentials from the address bar/history immediately.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      const body: Record<string, string> = { state: params.get("state") ?? "" };
      if (params.has("code")) body["code"] = params.get("code") ?? "";
      if (params.has("error")) body["error"] = params.get("error") ?? "";
      pending.current = epicRequest<EpicConnection>("complete", body);
    }
    void pending.current
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-tx">
      <section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-line bg-surface/70 p-6">
        <h1 className="text-2xl font-semibold">Epic connection</h1>
        {!result && !error && (
          <div role="status" className="space-y-3">
            <p>Completing the secure token exchange…</p>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div className="gradient-aurora h-full w-full animate-pulse rounded-full" />
            </div>
          </div>
        )}
        {result && (
          <div role="status" className="space-y-3">
            <p className="text-aurora">Token exchange successful.</p>
            <p className="font-semibold">
              {result.ready_for_transfer
                ? "Authorization ready for transfer"
                : "Not ready for transfer"}
            </p>
            <p className="text-sm text-mut">{result.reason}</p>
          </div>
        )}
        {error && (
          <div role="alert">
            <p className="text-red-400">{error}</p>
            <p className="mt-3 text-sm text-mut">
              Return to imports and start a new connection while signed in to the same MediLink
              account.
            </p>
          </div>
        )}
        <Button asChild variant="outline">
          <Link to="/external-import">Return to imports</Link>
        </Button>
      </section>
    </main>
  );
}
