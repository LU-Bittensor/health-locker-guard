import { createContext, useContext } from "react";

export const demoAccounts = {
  patient: "Demo patient",
  clinician: "Demo clinician",
  outsider: "Unrelated user",
};
export type DemoAccount = keyof typeof demoAccounts;
export const DemoAccountContext = createContext<{
  demoUser: DemoAccount;
  setDemoUser: (account: DemoAccount) => void;
} | null>(null);

export function useDemoAccount() {
  const context = useContext(DemoAccountContext);
  if (!context) throw new Error("DemoAccountProvider is missing");
  return context;
}
