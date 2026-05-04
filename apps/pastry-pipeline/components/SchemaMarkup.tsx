"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SchemaMarkup({ schema }: { schema: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(schema, null, 2);
  function copy() {
    navigator.clipboard.writeText(`<script type="application/ld+json">\n${json}\n</script>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="rounded-xl border border-border bg-[#0f1108] overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-black/30 px-3 py-2">
        <div className="font-mono text-[11px] text-emerald-300">application/ld+json</div>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy <script>"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-emerald-200/85 scrollbar-thin max-h-[420px]">
        {json}
      </pre>
    </div>
  );
}
