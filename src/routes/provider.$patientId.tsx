import { createFileRoute, notFound } from "@tanstack/react-router";

import { Vault } from "@/components/Vault";
import { findPatient } from "@/lib/patients";

export const Route = createFileRoute("/provider/$patientId")({
  head: () => ({
    meta: [
      { title: "Patient Vault — Medilink" },
      {
        name: "description",
        content:
          "Care provider view: browse the records a patient has shared and upload new clinical documents.",
      },
      { property: "og:title", content: "Patient Vault — Medilink" },
      {
        property: "og:description",
        content:
          "Care provider view: browse the records a patient has shared and upload new clinical documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PatientVault,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-ink font-sans text-tx">
      <p className="text-[13px] text-mut">This patient hasn&apos;t shared a vault with you.</p>
    </div>
  ),
});

function PatientVault() {
  const { patientId } = Route.useParams();
  const patient = findPatient(patientId);
  if (!patient) throw notFound();

  return (
    <Vault
      showLedger={false}
      roleLabel="Care provider"
      initials="DA"
      patientName={patient.name}
      backTo="/provider"
    />
  );
}
