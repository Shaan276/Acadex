"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertCircle,
  Download,
} from "lucide-react";

interface ImageViewerProps {
  url: string;
  title?: string;
  downloadUrl?: string;
  className?: string;
}

export function ImageViewer({
  url,
  title = "Image",
  downloadUrl,
  className = "",
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const resetZoom = () => {
    setScale(1);
    setRotation(0);
  };
  const rotate = () => setRotation((r) => (r + 90) % 360);

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
      className={`relative flex flex-col w-full h-full bg-muted/20 select-none overflow-hidden ${className}`}
    >
      {/* Floating Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[200px]">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={scale <= 0.25}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            onClick={resetZoom}
            className="text-xs font-mono text-muted-foreground hover:text-foreground px-1"
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={scale >= 4}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={rotate}
            title="Rotate Clockwise"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Image Display Area */}
      <div className="relative flex-1 w-full h-full overflow-auto p-4 flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Loading image...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 p-6 max-w-sm text-center bg-card rounded-2xl border border-border shadow-xs">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h3 className="text-sm font-semibold">Unable to Load Image</h3>
            <p className="text-xs text-muted-foreground">The image could not be loaded or is unavailable.</p>
            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="mt-2 gap-1.5 rounded-xl">
                  <Download className="h-4 w-4" /> Download Original File
                </Button>
              </a>
            )}
          </div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.15s ease-out",
          }}
          className={`max-h-full max-w-full object-contain rounded-md shadow-md ${
            loading || error ? "hidden" : "block"
          }`}
        />
      </div>
    </div>
  );
}
