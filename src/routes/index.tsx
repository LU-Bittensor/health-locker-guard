import { createFileRoute } from "@tanstack/react-router";
import { Vault } from "@/components/Vault";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Records — Medilink" }] }),
  component: () => <Vault />,
});
