import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  mnemonic: string;
  evmAddress: string;
  onConfirm: () => void;
};

export function RecoveryPhraseModal({ mnemonic, evmAddress, onConfirm }: Props) {
  const [acked, setAcked] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyMnemonic() {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadMnemonic() {
    const blob = new Blob(
      [
        "Medilink vault recovery phrase\n",
        `EVM address: ${evmAddress}\n\n`,
        `${mnemonic}\n\n`,
        "Store this offline. Anyone with this phrase can recover vault key material.\n",
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medilink-vault-recovery.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-line/70 bg-surface p-5 shadow-xl">
        <h2 className="text-[17px] font-semibold tracking-tight">Save your recovery phrase</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-mut">
          Your EVM and access keys are encrypted in your vault. This phrase is shown once — store it
          offline. Medilink cannot recover your keys if you forget your password and lose this phrase.
        </p>
        <p className="mt-3 font-mono text-[11px] text-mut">Wallet: {evmAddress}</p>
        <div className="mt-3 rounded-md border border-line bg-surface2/60 p-3 font-mono text-[12px] leading-relaxed text-tx">
          {mnemonic}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="text-[12px]" onClick={() => void copyMnemonic()}>
            {copied ? "Copied" : "Copy phrase"}
          </Button>
          <Button type="button" variant="outline" className="text-[12px]" onClick={downloadMnemonic}>
            Download .txt
          </Button>
        </div>
        <label className="mt-4 flex items-start gap-2 text-[12px] text-mut">
          <input
            type="checkbox"
            checked={acked}
            onChange={(e) => setAcked(e.target.checked)}
            className="mt-0.5"
          />
          <span>I have saved this recovery phrase in a safe place.</span>
        </label>
        <Button
          type="button"
          disabled={!acked}
          onClick={onConfirm}
          className="mt-4 w-full rounded-lg gradient-aurora py-2.5 text-[13px] font-semibold text-ink"
        >
          Continue to vault
        </Button>
      </div>
    </div>
  );
}
