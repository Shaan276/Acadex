"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Globe, Copy, Check } from "lucide-react";

interface ExternalResourceCardProps {
  url: string;
  title?: string;
  className?: string;
}

export function ExternalResourceCard({
  url,
  title = "External Resource",
  className = "",
}: ExternalResourceCardProps) {
  const [copied, setCopied] = useState(false);

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 h-full w-full bg-muted/20 ${className}`}>
      <div className="flex flex-col items-center max-w-md w-full bg-card rounded-2xl border border-border shadow-md p-6 text-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Globe className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground line-clamp-2">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{hostname}</p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          This resource links to an external website. For security and compatibility, please open it directly in a new tab.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full pt-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1"
          >
            <Button className="w-full gap-1.5 rounded-xl text-xs h-9">
              <ExternalLink className="h-3.5 w-3.5" />
              Open Website
            </Button>
          </a>

          <Button
            variant="outline"
            onClick={copyUrl}
            className="w-full sm:w-auto gap-1.5 rounded-xl text-xs h-9"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
