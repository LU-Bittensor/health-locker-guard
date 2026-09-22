import { createFileRoute } from "@tanstack/react-router";

import { Vault } from "@/components/Vault";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medilink — Records, Uploads & Access" },
      {
        name: "description",
        content:
          "Browse medical records, seal new uploads, and grant or revoke clinician access from a single ledger.",
      },
      { property: "og:title", content: "Medilink — Records, Uploads & Access" },
      {
        property: "og:description",
        content:
          "Browse medical records, seal new uploads, and grant or revoke clinician access from a single ledger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Vault showLedger roleLabel="Patient" initials="RM" />,
});
