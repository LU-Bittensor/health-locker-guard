import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole } from "@/lib/vault-data";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In — Medilink" },
      {
        name: "description",
        content:
          "Sign in to Medilink as a patient to manage your records and access, or as a care provider to view shared records.",
      },
      { property: "og:title", content: "Sign In — Medilink" },
      {
        property: "og:description",
        content:
          "Sign in to Medilink as a patient to manage your records and access, or as a care provider to view shared records.",
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
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPatient = role === "patient";

  useEffect(() => {
    let cancelled = false;
    async function redirectSignedInUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const accountRole = await fetchRole();
      if (cancelled) return;
      navigate({ to: accountRole === "provider" ? "/provider" : "/", replace: true });
    }
    void redirectSignedInUser();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (mode === "create" && !fullName.trim()) {
      setError("Enter your full name.");
      return;
    }

    if (mode === "create" && !isPatient && !organization.trim()) {
      setError("Enter your clinic or organization.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/signin`,
            data: {
              role,
              full_name: fullName.trim(),
              organization: isPatient ? null : organization.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          navigate({ to: isPatient ? "/" : "/provider", replace: true });
          return;
        }

        setMessage("Check your email to confirm your account, then sign in.");
        setPassword("");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      const accountRole = await fetchRole();
      if (accountRole !== role) {
        await supabase.auth.signOut();
        setError(
          `This account is registered as a ${accountRole === "provider" ? "care provider" : "patient"}.`,
        );
        return;
      }

      navigate({ to: accountRole === "provider" ? "/provider" : "/", replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink px-4 font-sans text-tx antialiased">
      <div className="pointer-events-none fixed inset-0 aurora-field" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid size-6 place-items-center rounded-md gradient-aurora">
            <span className="size-2 rounded-full bg-ink/80" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Medilink</span>
        </div>

        <div className="rounded-xl border border-line/70 bg-surface/70 p-5 backdrop-blur-xl">
          <h1 className="text-center text-[18px] font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to your vault" : "Create your account"}
          </h1>
          <p className="mt-1 text-center text-[12px] text-mut">
            {mode === "signin" ? "Choose how you&apos;re signing in today" : "Choose the account type you need"}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-line/70 bg-surface2/40 p-1">
            {(
              [
                ["patient", "Patient Sign In"],
                ["provider", "Care Provider Sign In"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
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

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {mode === "create" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="fullName"
                  className="block font-mono text-[10px] uppercase tracking-[0.12em] text-mut"
                >
                  Full name
                </label>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={isPatient ? "Riley Mensah" : "Dr. Avery Chen"}
                  autoComplete="name"
                  className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[13px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
                />
              </div>
            )}

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
                autoComplete="email"
                className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[13px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
              />
            </div>
            {mode === "create" && !isPatient && (
              <div className="space-y-1.5">
                <label
                  htmlFor="organization"
                  className="block font-mono text-[10px] uppercase tracking-[0.12em] text-mut"
                >
                  Clinic or organization
                </label>
                <input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Northside Clinic"
                  autoComplete="organization"
                  className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[13px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
                />
              </div>
            )}
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
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[13px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
              />
            </div>

            {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}
            {message && <p className="rounded-md border border-aurora/40 bg-aurora/[0.06] px-3 py-2 text-[12px] text-aurora">{message}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full rounded-lg gradient-aurora py-2.5 text-[13px] font-semibold text-ink shadow-none transition-transform hover:opacity-95 active:scale-[0.99]"
            >
              {submitting
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? isPatient
                    ? "Patient Sign In"
                    : "Care Provider Sign In"
                  : isPatient
                    ? "Create Patient Account"
                    : "Create Care Provider Account"}
            </Button>

            <p className="text-center text-[11px] text-mut">
              {isPatient
                ? "Patients can manage records, uploads, and who has access."
                : "Care providers can view shared records and upload new documents."}
            </p>

            <button
              type="button"
              onClick={() => {
                setMode((current) => (current === "signin" ? "create" : "signin"));
                setError("");
                setMessage("");
              }}
              className="w-full rounded-md border border-line px-2.5 py-2 text-[12px] font-medium text-mut transition-colors hover:border-aurora/50 hover:text-tx"
            >
              {mode === "signin"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
