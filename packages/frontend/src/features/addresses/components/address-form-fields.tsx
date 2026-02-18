import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  ADDRESS_TAG_MAX_LENGTH,
  domainRegex,
  normalizeDomainToken,
  uniqueDomains,
} from "@/features/addresses/schemas/address-form";

type DomainTagsInputProps = {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  onBlur: () => void;
  isInvalid: boolean;
};

export const DomainTagsInput = ({
  id,
  value,
  onChange,
  onBlur,
  isInvalid,
}: DomainTagsInputProps) => {
  const [draft, setDraft] = React.useState("");

  const addDomains = React.useCallback(
    (rawValue: string) => {
      const parsed = rawValue
        .split(/[\s,]+/)
        .map(normalizeDomainToken)
        .filter(Boolean)
        .filter(domain => domainRegex.test(domain));
      if (parsed.length === 0) return;
      onChange(uniqueDomains([...value, ...parsed]));
    },
    [onChange, value]
  );

  const commitDraft = React.useCallback(() => {
    if (!draft.trim()) return;
    addDomains(draft);
    setDraft("");
  }, [addDomains, draft]);

  return (
    <div
      className="dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex min-h-10 flex-wrap items-center gap-1 rounded-lg border bg-transparent px-2 py-1 text-sm transition-colors focus-within:ring-3 aria-invalid:ring-3"
      aria-invalid={isInvalid}
    >
      {value.map(domain => (
        <Badge
          key={domain}
          variant="secondary"
          className="h-6 rounded-md border border-border/70 bg-muted/80 px-2 text-xs dark:bg-muted/60"
        >
          <span className="max-w-[14rem] truncate">{domain}</span>
          <button
            type="button"
            className="ml-1 rounded-sm px-1 leading-none opacity-60 transition-opacity hover:opacity-100"
            onClick={() => onChange(value.filter(item => item !== domain))}
            aria-label={`Remove ${domain}`}
          >
            x
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          commitDraft();
          onBlur();
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
            return;
          }
          if (
            event.key === "Backspace" &&
            draft.length === 0 &&
            value.length > 0
          ) {
            event.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
        onPaste={event => {
          const pasted = event.clipboardData.getData("text");
          const parsed = pasted
            .split(/[\s,]+/)
            .map(normalizeDomainToken)
            .filter(Boolean)
            .filter(domain => domainRegex.test(domain));
          if (parsed.length === 0) return;

          event.preventDefault();
          addDomains(pasted);
        }}
        placeholder={value.length === 0 ? "example.com" : ""}
        className="placeholder:text-muted-foreground min-w-[9rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
        aria-label="Add allowed sender domain"
        aria-invalid={isInvalid}
      />
    </div>
  );
};

type TagTokenInputProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  isInvalid: boolean;
  maxLength?: number;
};

export const TagTokenInput = ({
  id,
  value,
  onChange,
  onBlur,
  isInvalid,
  maxLength = ADDRESS_TAG_MAX_LENGTH,
}: TagTokenInputProps) => {
  const [draft, setDraft] = React.useState("");

  const commitDraft = React.useCallback(() => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    onChange(nextValue.slice(0, maxLength));
    setDraft("");
  }, [draft, maxLength, onChange]);

  return (
    <div
      className="dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex min-h-10 flex-wrap items-center gap-1 rounded-lg border bg-transparent px-2 py-1 text-sm transition-colors focus-within:ring-3 aria-invalid:ring-3"
      aria-invalid={isInvalid}
    >
      {value ? (
        <Badge
          variant="secondary"
          className="h-6 rounded-md border border-border/70 bg-muted/80 px-2 text-xs dark:bg-muted/60"
        >
          <span className="max-w-[12rem] truncate">{value}</span>
          <button
            type="button"
            className="ml-1 rounded-sm px-1 leading-none opacity-60 transition-opacity hover:opacity-100"
            onClick={() => onChange("")}
            aria-label={`Remove ${value}`}
          >
            x
          </button>
        </Badge>
      ) : null}
      <input
        id={id}
        value={draft}
        maxLength={maxLength}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          commitDraft();
          onBlur();
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
            return;
          }
          if (event.key === "Backspace" && draft.length === 0 && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder={value ? "" : "Tag"}
        className="placeholder:text-muted-foreground min-w-[9rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
        aria-label="Set address tag"
        aria-invalid={isInvalid}
      />
    </div>
  );
};
