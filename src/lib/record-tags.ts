/** Local organization categories, not clinical codes or access-control labels. */
export const RECORD_CATEGORIES = [
  {
    id: "lab-results",
    label: "Lab results",
    aliases: ["labs", "laboratory", "bloodwork", "test results"],
  },
  {
    id: "imaging",
    label: "Imaging",
    aliases: ["radiology", "X-ray", "MRI", "CT"],
  },
  {
    id: "visit-notes",
    label: "Visit notes",
    aliases: ["clinical notes", "consultation", "progress notes"],
  },
  {
    id: "medications",
    label: "Medications",
    aliases: ["medicines", "prescriptions", "medication list"],
  },
  {
    id: "immunizations",
    label: "Immunizations",
    aliases: ["vaccines", "vaccinations"],
  },
  {
    id: "allergies",
    label: "Allergies",
    aliases: ["allergy list", "intolerances"],
  },
  {
    id: "conditions-history",
    label: "Conditions and history",
    aliases: ["conditions", "problems", "medical history"],
  },
  {
    id: "procedures",
    label: "Procedures",
    aliases: ["surgery", "operative report"],
  },
  {
    id: "care-plans",
    label: "Care plans",
    aliases: ["plan of care", "treatment plan"],
  },
  {
    id: "health-summaries",
    label: "Health summaries",
    aliases: ["discharge summary", "care summary"],
  },
  {
    id: "vitals-measurements",
    label: "Vitals and measurements",
    aliases: ["vital signs", "blood pressure", "pulse"],
  },
  {
    id: "forms-consents",
    label: "Forms and consents",
    aliases: ["consent", "authorization form"],
  },
  {
    id: "other",
    label: "Other",
    aliases: [],
  },
] as const;

const key = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

/** Resolve whole labels/aliases only. Unknown legacy tags retain their meaning. */
export function categoryLabel(value: string): string {
  const match = RECORD_CATEGORIES.find((c) =>
    [c.label, ...c.aliases].some((label) => key(label) === key(value)),
  );
  return match?.label ?? value;
}

/** OR between selected categories; no selection means all records. */
export function matchesCategories(tags: readonly string[], selected: readonly string[]): boolean {
  return (
    !selected.length ||
    selected.some((value) =>
      tags.some((tag) => key(categoryLabel(tag)) === key(categoryLabel(value))),
    )
  );
}

/** Validate serialization before passing the unchanged string-tag contract to the API. */
export function serializeRecordTags(tags: readonly string[]): string {
  if (tags.length > 20 || tags.some((tag) => !tag.trim() || tag.length > 50 || tag.includes(",")))
    throw new Error("Choose up to 20 categories or existing tags, each up to 50 characters.");
  const value = [...new Set(tags)].join(", ");
  if (value.length > 1000) throw new Error("Selected tags exceed the 1,000-character limit.");
  return value;
}
