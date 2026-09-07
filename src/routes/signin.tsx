import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In — SableVault" },
      {
        name: "description",
        content:
          "Sign in to SableVault as a patient to manage your records and access, or as a care provider to view shared records.",
      },
      { property: "og:title", content: "Sign In — SableVault" },
      {
        property: "og:description",
        content:
          "Sign in to SableVault as a patient to manage your records and access, or as a care provider to view shared records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"patient" | "provider">("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isPatient = role === "patient";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink px-4 font-sans text-tx antialiased">
      <div className="pointer-events-none fixed inset-0 aurora-field" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid size-6 place-items-center rounded-md gradient-aurora">
            <span className="size-2 rounded-full bg-ink/80" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">SableVault</span>
        </div>

        <div className="rounded-xl border border-line/70 bg-surface/70 p-5 backdrop-blur-xl">
          <h1 className="text-center text-[18px] font-semibold tracking-tight">
            Sign in to your vault
          </h1>
          <p className="mt-1 text-center text-[12px] text-mut">
            Choose how you&apos;re signing in today
          </p>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-line/70 bg-surface2/40 p-1">
            {(
              [
                ["patient", "Patient Sign In"],
                ["provider", "Care Provider Sign In"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRole(value)}
                aria-pressed={role === value}
                className={`rounded-md px-2 py-2 text-[12px] font-medium transition-colors ${
                  role === value
                    ? "bg-aurora/15 text-aurora"
                    : "text-mut hover:text-tx"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block font-mono text-[10px] uppercase tracking-[0.12em] text-mut"
              >
                {isPatient ? "Email" : "Work email"}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isPatient ? "you@example.com" : "you@clinic.org"}
                className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[13px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block font-mono text-[10px] uppercase tracking-[0.12em] text-mut"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[13px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
              />
            </div>

            <button
              onClick={() => navigate({ to: isPatient ? "/" : "/provider" })}
              className="mt-1 w-full rounded-lg gradient-aurora py-2.5 text-[13px] font-semibold text-ink transition-transform active:scale-[0.99]"
            >
              {isPatient ? "Patient Sign In" : "Care Provider Sign In"}
            </button>

            <p className="text-center text-[11px] text-mut">
              {isPatient
                ? "Patients can manage records, uploads, and who has access."
                : "Care providers can view shared records and upload new documents."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
