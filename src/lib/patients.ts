export type SharedPatient = {
  /** URL slug, e.g. "patient0" */
  slug: string;
  name: string;
  initials: string;
};

export const sharedPatients: SharedPatient[] = [
  { slug: "patient0", name: "R. Mensah", initials: "RM" },
  { slug: "patient1", name: "J. Okafor", initials: "JO" },
  { slug: "patient2", name: "L. Petrov", initials: "LP" },
  { slug: "patient3", name: "A. Delgado", initials: "AD" },
  { slug: "patient4", name: "S. Nakamura", initials: "SN" },
];

export function findPatient(slug: string) {
  return sharedPatients.find((p) => p.slug === slug);
}
