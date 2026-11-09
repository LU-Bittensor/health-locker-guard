/** Render a decrypted Epic snapshot for review without changing the stored bytes. */
export function epicPreview(text: string): string {
  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch {
    return text;
  }
  if (snapshot?.format !== "medilink-epic-snapshot-v1" || !Array.isArray(snapshot.records))
    return text;
  const labels: Record<string, string> = {
    "vital-signs": "Vital signs",
    laboratory: "Lab results",
    conditions: "Conditions",
    medications: "Medications",
    encounters: "Encounters",
  };
  const imported =
    typeof snapshot.imported_at === "number"
      ? new Date(snapshot.imported_at * 1000).toISOString()
      : "Not provided";
  const lines = [
    "MediLink — Epic Sandbox saved import",
    `Imported: ${imported}`,
    `Clinical records: ${snapshot.records.length}`,
    "Shares this saved snapshot only. Later imports are not included.",
    typeof snapshot.coverage_note === "string" ? snapshot.coverage_note : "",
    "",
  ];
  for (const [category, label] of Object.entries(labels)) {
    const records = snapshot.records.filter(
      (r: { category?: string } | null) => r?.category === category,
    );
    lines.push(`${label} (${records.length})`, "--------------------------------");
    if (!records.length) lines.push("No records returned in this category.");
    for (const record of records) {
      lines.push(
        String(record.name ?? "Unnamed record"),
        `  Value / details: ${record.value ?? "Not provided"}${record.unit ? ` ${record.unit}` : ""}`,
        `  Date from Epic: ${record.date ?? "Not provided"}`,
        `  Status: ${record.status ?? "Not provided"}`,
        "",
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
