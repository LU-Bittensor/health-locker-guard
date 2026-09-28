import { createFileRoute } from "@tanstack/react-router";
import { Vault } from "@/components/Vault";

export const Route = createFileRoute("/provider/")({
  head: () => ({ meta: [{ title: "Shared records — Medilink" }] }),
  component: () => <Vault sharedOnly />,
});
