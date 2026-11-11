import { useEffect, useId, useRef, useState } from "react";
import { RECORD_CATEGORIES, categoryLabel } from "@/lib/record-tags";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  existingTags?: string[];
  label?: string;
};

/** Searchable checkbox dropdown; native controls support keyboard and screen readers. */
export function RecordTagPicker({
  value,
  onChange,
  disabled = false,
  existingTags = [],
  label = "Record categories",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  const known = new Set(RECORD_CATEGORIES.map((c) => c.label as string));
  const legacy = [...new Set([...existingTags, ...value])].filter(
    (tag) => !known.has(categoryLabel(tag)),
  );
  const options = [
    ...RECORD_CATEGORIES.map((c) => ({
      label: c.label as string,
      aliases: [...c.aliases] as string[],
      legacy: false,
    })),
    ...legacy.map((tag) => ({ label: tag, aliases: [], legacy: true })),
  ].filter((option) =>
    [option.label, ...option.aliases]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  function toggle(label: string) {
    onChange(value.includes(label) ? value.filter((tag) => tag !== label) : [...value, label]);
  }
  return (
    <div className="space-y-2" data-tag-picker-open={open}>
      <p id={`${id}-label`} className="text-sm">
        {label}
      </p>
      <button
        type="button"
        disabled={disabled}
        ref={trigger}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-labelledby={`${id}-label ${id}-button`}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="w-full rounded-md border border-line bg-surface2 px-3 py-2 text-left text-sm disabled:opacity-50"
      >
        <span id={`${id}-button`}>
          {value.length ? `${value.length} selected` : "Choose categories (optional)"}
        </span>
      </button>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Selected categories">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="rounded-full border border-aurora/40 px-2 py-1 text-xs text-aurora"
            >
              {tag} ×
            </button>
          ))}
        </div>
      )}
      {open && (
        <div
          id={`${id}-options`}
          role="group"
          aria-labelledby={`${id}-label`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          className="space-y-2 rounded-md border border-line bg-surface2 p-3"
        >
          <label className="block text-xs text-mut">
            Search categories
            <input
              type="search"
              ref={search}
              aria-label={`Search ${label.toLocaleLowerCase()}`}
              value={query}
              disabled={disabled}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try labs, bloodwork, vaccines…"
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-tx"
            />
          </label>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {options.map((option) => (
              <label key={option.label} className="flex items-center gap-2 px-1 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={value.includes(option.label)}
                  disabled={disabled || (!value.includes(option.label) && value.length >= 20)}
                  onChange={() => toggle(option.label)}
                />
                <span>
                  {option.label}
                  {option.legacy ? " (existing tag)" : ""}
                </span>
              </label>
            ))}
            {!options.length && (
              <p role="status" className="text-sm text-mut">
                No matching categories. Try another name or alias.
              </p>
            )}
          </div>
          {value.length >= 20 && (
            <p role="status" className="text-xs text-mut">
              20 tags selected. Remove one before adding another.
            </p>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={close}
            className="rounded-md border border-line px-3 py-1.5 text-xs"
          >
            Done choosing categories
          </button>
        </div>
      )}
    </div>
  );
}
