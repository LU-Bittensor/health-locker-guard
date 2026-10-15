// Frontend preview only. Replace simulated transitions with verified backend status.
export type ImportStage =
  | "disconnected"
  | "connecting"
  | "connected"
  | "cancelled"
  | "connection-error"
  | "importing"
  | "import-error"
  | "complete";

export const sampleImportResults = [
  { label: "Medications", count: 3 },
  { label: "Allergies", count: 2 },
  { label: "Lab results", count: 5 },
  { label: "Documents", count: 2 },
];
