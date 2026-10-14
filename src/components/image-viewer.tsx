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
  Expand,
  Maximize,
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
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // "fitWidth" matches the width of the device on mobile screens and scrolls vertically.
  // "fitScreen" contains the whole image within the viewport.
  const [fitMode, setFitMode] = useState<"fitWidth" | "fitScreen">("fitWidth");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect mobile device width on initial mount and default to fitWidth
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setFitMode("fitWidth");
    }
  }, []);

  const zoomIn = () => setScale((s) => Math.min(Number((s + 0.25).toFixed(2)), 4));
  const zoomOut = () => setScale((s) => Math.max(Number((s - 0.25).toFixed(2)), 0.5));

  const resetZoom = () => {
    setScale(1);
    setRotation(0);
    setFitMode("fitWidth");
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const toggleFitMode = () => {
    setFitMode((prev) => (prev === "fitWidth" ? "fitScreen" : "fitWidth"));
    setScale(1);
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
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[150px] sm:max-w-[240px]">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Fit Mode Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs px-2 gap-1 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={toggleFitMode}
            title={fitMode === "fitWidth" ? "Fit to Screen" : "Fit to Width (Device Width)"}
          >
            {fitMode === "fitWidth" ? (
              <>
                <Maximize className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fit Screen</span>
              </>
            ) : (
              <>
                <Expand className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fit Width</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <button
            onClick={resetZoom}
            className="text-xs font-mono text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-muted"
            title="Reset Zoom to 100% Fit Width"
          >
            {Math.round(scale * 100)}%
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={zoomIn}
            disabled={scale >= 4}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={rotate}
            title="Rotate Clockwise"
          >
            <RotateCw className="h-4 w-4" />
          </Button>

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

      {/* Image Display Area */}
      <div
        ref={scrollAreaRef}
        className={`relative flex-1 w-full h-full overflow-auto p-1 sm:p-4 ${
          fitMode === "fitWidth"
            ? "flex flex-col items-center"
            : "flex items-center justify-center"
        }`}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center m-auto">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Loading image...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 p-6 max-w-sm text-center bg-card rounded-2xl border border-border shadow-xs m-auto">
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

        {/* 
          In "fitWidth" mode on mobile:
          - width is 100% of the device screen (matching the device width)
          - height is automatic so the aspect ratio is perfectly preserved
          - user can naturally scroll down the full document/image
        */}
        <div
          className={`flex items-center justify-center ${
            fitMode === "fitWidth" ? "w-full max-w-full pb-16" : "h-full w-full"
          }`}
        >
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
              width:
                fitMode === "fitWidth"
                  ? scale === 1
                    ? "100%"
                    : `${scale * 100}%`
                  : undefined,
              maxWidth: scale > 1 ? "none" : "100%",
              transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
              transition: "transform 0.15s ease-out",
            }}
            className={`rounded-md shadow-md ${
              fitMode === "fitWidth"
                ? "h-auto object-contain block"
                : "max-h-full max-w-full object-contain block"
            } ${loading || error ? "hidden" : "block"}`}
          />
        </div>
      </div>
    </div>
  );
}
