import { createFileRoute } from "@tanstack/react-router";
import { AccessPanel } from "@/components/AccessPanel";
import { VaultLayout } from "@/components/VaultLayout";

export const Route = createFileRoute("/access")({
  validateSearch: (search: Record<string, unknown>): { record?: string | undefined } => ({
    record:
      typeof search["record"] === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(search["record"])
        ? search["record"]
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Access ledger — Medilink" }] }),
  component: AccessLedgerPage,
});

function AccessLedgerPage() {
  const { record } = Route.useSearch();
  return (
    <VaultLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-aurora">
            Sharing and permissions
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Access ledger</h1>
          <p className="mt-2 text-sm text-mut">
            Share records, check received access, and manage registry permissions.
          </p>
        </div>
        <AccessPanel initialRecordId={record} />
      </div>
    </VaultLayout>
  );
}
