"use client";
import { useState } from "react";

const VERTICALS = [
  { id: "food", label: "Food / Beverage" },
  { id: "retail", label: "Retail" },
  { id: "services", label: "Services" },
  { id: "real-estate", label: "Real Estate" },
  { id: "saas", label: "SaaS / Software" },
  { id: "fitness", label: "Fitness / Wellness" },
  { id: "hospitality", label: "Hospitality" },
  { id: "weddings", label: "Weddings / Events" },
  { id: "education", label: "Education" },
  { id: "healthcare", label: "Healthcare" },
  { id: "other", label: "Other" },
] as const;

export function VerticalSelector({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
}) {
  const [other, setOther] = useState("");
  const isOther = !!value && !VERTICALS.find((v) => v.id === value);

  return (
    <div className="space-y-2">
      <select
        value={isOther ? "other" : (value ?? "")}
        onChange={(e) => {
          if (e.target.value === "other") onChange(other || "other");
          else onChange(e.target.value);
        }}
        className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
      >
        <option value="">Pick a vertical…</option>
        {VERTICALS.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>
      {(value === "other" || isOther) && (
        <input
          type="text"
          placeholder="Custom vertical (e.g. 'specialty coffee')"
          value={isOther ? value : other}
          onChange={(e) => { setOther(e.target.value); onChange(e.target.value); }}
          className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
        />
      )}
    </div>
  );
}
