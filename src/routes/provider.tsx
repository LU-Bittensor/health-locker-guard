import { createFileRoute } from "@tanstack/react-router";

import { Vault } from "@/components/Vault";

export const Route = createFileRoute("/provider")({
  head: () => ({
    meta: [
      { title: "Care Provider Vault — SableVault" },
      {
        name: "description",
        content:
          "Care provider view: browse shared patient records and upload new clinical documents into the vault.",
      },
      { property: "og:title", content: "Care Provider Vault — SableVault" },
      {
        property: "og:description",
        content:
          "Care provider view: browse shared patient records and upload new clinical documents into the vault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Vault showLedger={false} roleLabel="Care provider" initials="DA" />,
});
