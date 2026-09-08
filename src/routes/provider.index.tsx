import { createFileRoute, Link } from "@tanstack/react-router";

import { sharedPatients } from "@/lib/patients";

export const Route = createFileRoute("/provider/")({
  head: () => ({
    meta: [
      { title: "Shared Patients — SableVault" },
      {
        name: "description",
        content:
          "Care provider view: the list of patients who have granted you access to their sealed vault.",
      },
      { property: "og:title", content: "Shared Patients — SableVault" },
      {
        property: "og:description",
        content:
          "Care provider view: the list of patients who have granted you access to their sealed vault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PatientList,
});

function PatientList() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink font-sans text-tx antialiased">
      <div className="pointer-events-none fixed inset-0 aurora-field" />

      <div className="relative mx-auto max-w-[1440px]">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-ink/70 backdrop-blur-md">
          <div className="flex h-14 items-center gap-6 px-6">
            <div className="flex items-center gap-2.5">
              <div className="grid size-6 place-items-center rounded-md gradient-aurora">
                <span className="size-2 rounded-full bg-ink/80" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">SableVault</span>
              <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">
                Care provider
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Link
                to="/signin"
                className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-aurora/50 hover:text-tx"
              >
                Sign out
              </Link>
              <div className="grid size-8 place-items-center rounded-full bg-linear-to-br from-aurora3 to-aurora2 text-[11px] font-semibold text-ink">
                DA
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[620px] p-4 sm:p-8">
          <h1 className="text-[20px] font-semibold tracking-tight">Shared patients</h1>
          <p className="mt-1 text-[12px] text-mut">
            Names only. Open a patient to view the records they&apos;ve shared with you.
          </p>

          <div className="mt-5 overflow-hidden rounded-xl border border-line/70 bg-surface/60 backdrop-blur-xl">
            <div className="flex h-11 items-center justify-between border-b border-line/70 px-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
                Access granted
              </h2>
              <span className="font-mono text-[11px] text-mut">
                {sharedPatients.length} patients
              </span>
            </div>
            <div className="divide-y divide-line/50">
              {sharedPatients.map((p) => (
                <Link
                  key={p.slug}
                  to="/provider/$patientId"
                  params={{ patientId: p.slug }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface2/40"
                >
                  <span className="grid size-8 place-items-center rounded-full border border-line bg-surface2/60 text-[11px] font-semibold text-mut">
                    {p.initials}
                  </span>
                  <span className="text-[14px] font-medium">{p.name}</span>
                  <span className="ml-auto font-mono text-[11px] text-mut">Open vault →</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
