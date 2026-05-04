"use client";
import { useState } from "react";
import { Instagram, Music2, MapPin, Copy, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SocialCaption } from "@/lib/types";

const PLATFORM_META: Record<SocialCaption["platform"], { icon: any; label: string; tone: any }> = {
  instagram: { icon: Instagram, label: "Instagram", tone: "brand" },
  tiktok: { icon: Music2, label: "TikTok", tone: "warning" },
  google_post: { icon: MapPin, label: "Google Post", tone: "gold" },
};

export function SocialCaptionCard({ caption }: { caption: SocialCaption }) {
  const [copied, setCopied] = useState(false);
  const meta = PLATFORM_META[caption.platform];
  const Icon = meta.icon;
  const text = `${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtags.join(" ")}`;

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <Badge variant={meta.tone}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          <div className="flex items-center gap-1.5 text-[11px] text-subtle">
            <Clock className="h-3 w-3" />
            {caption.bestTime}
          </div>
        </div>
        <div className="font-display text-base text-foreground text-balance">{caption.hook}</div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">{caption.body}</p>
        <div className="text-xs text-foreground">{caption.cta}</div>
        <div className="flex flex-wrap gap-1.5">
          {caption.hashtags.map((h) => (
            <Badge key={h} variant="outline" className="font-mono text-[10px]">{h}</Badge>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy caption"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
