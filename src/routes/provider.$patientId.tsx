import { createFileRoute } from "@tanstack/react-router";
import { Vault } from "@/components/Vault";

export const Route = createFileRoute("/provider/$patientId")({
  head: () => ({ meta: [{ title: "Shared patient records — Medilink" }] }),
  component: PatientRecords,
});

function PatientRecords() {
  const { patientId } = Route.useParams();
  return <Vault ownerId={patientId} sharedOnly />;
}
