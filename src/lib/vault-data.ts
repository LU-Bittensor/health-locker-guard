import { supabase } from "@/integrations/supabase/client";

export type RecordRow = {
  id: string;
  name: string;
  kind: string;
  record_date: string;
  source: string;
  tags: string;
};

export type GrantRow = {
  id: string;
  who: string;
  scope: string;
  expires_at: string | null;
  active: boolean;
};

export type Profile = {
  id: string;
  full_name: string;
  organization: string | null;
};

export const recordTypes = ["Lab report", "Imaging", "Cardiology", "History", "Visit note"];

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${m}/${d}/${y.slice(2)}` : iso;
}

export function initialsOf(name: string, fallback: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, organization")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ?? { id: uid, full_name: "", organization: null };
}

export async function fetchRecords(): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from("records")
    .select("id, name, kind, record_date, source, tags")
    .order("record_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGrants(): Promise<GrantRow[]> {
  const { data, error } = await supabase
    .from("grants")
    .select("id, who, scope, expires_at, active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertRecord(input: {
  name: string;
  kind: string;
  record_date: string;
  source: string;
  tags: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("records").insert({ ...input, owner_id: uid });
  if (error) throw error;
}

export async function insertGrant(input: { who: string; scope: string }) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("grants").insert({ ...input, owner_id: uid });
  if (error) throw error;
}

export async function setGrantActive(id: string, active: boolean) {
  const { error } = await supabase.from("grants").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteGrant(id: string) {
  const { error } = await supabase.from("grants").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRole(): Promise<"patient" | "provider"> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return "patient";
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).limit(1);
  return (data?.[0]?.role as "patient" | "provider" | undefined) ?? "patient";
}
