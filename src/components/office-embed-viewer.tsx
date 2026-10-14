"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface OfficeEmbedViewerProps {
  previewUrl: string;
  directOpenUrl?: string;
  downloadUrl?: string;
  title?: string;
  className?: string;
}

export function OfficeEmbedViewer({
  previewUrl,
  directOpenUrl,
  downloadUrl,
  title = "Document",
  className = "",
}: OfficeEmbedViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCookieNotice, setShowCookieNotice] = useState(false);

  // If iframe takes longer than 6 seconds to load, show a helpful fallback notice
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setShowCookieNotice(true);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full bg-background select-none overflow-hidden ${className}`}
    >
      {/* Top Embedded Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[200px] sm:max-w-md">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {directOpenUrl && (
            <a href={directOpenUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open in Google Docs/Drive</span>
              </Button>
            </a>
          )}

          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </a>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Embedded Iframe Container */}
      <div className="relative flex-1 w-full h-full min-h-0 bg-muted/10 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">
              Loading Google Drive document preview...
            </p>
          </div>
        )}

        {showCookieNotice && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 max-w-md w-11/12 bg-card/95 border border-border shadow-lg rounded-xl p-3 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-medium text-foreground">Preview taking longer than usual?</p>
              <p className="text-muted-foreground mt-0.5">
                If third-party cookies are blocked, Google Drive preview may not render.
              </p>
              <div className="flex items-center gap-2 mt-2">
                {directOpenUrl && (
                  <a href={directOpenUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="xs" variant="default" className="text-[11px] h-6 px-2">
                      Open in Drive
                    </Button>
                  </a>
                )}
                {downloadUrl && (
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="xs" variant="outline" className="text-[11px] h-6 px-2">
                      Download File
                    </Button>
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCookieNotice(false)}
              className="text-muted-foreground hover:text-foreground text-xs font-semibold px-1"
            >
              ✕
            </button>
          </div>
        )}

        <iframe
          src={previewUrl}
          title={title}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          allow="autoplay"
        />
      </div>
    </div>
  );
}
