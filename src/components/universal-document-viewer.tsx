"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { Loader2, FileWarning } from "lucide-react";
import type { UDocClient as UDocClientType, UDocViewer } from "@docmentis/udoc-viewer";

export interface UniversalDocumentViewerProps {
  /**
   * Document source: either a proxy/blob URL string, a File object, or raw bytes (Uint8Array).
   */
  src: string | Uint8Array | File;
  /**
   * Display filename or title. Used for title bar and default download name.
   */
  fileName?: string;
  /**
   * Optional MIME type hint (e.g. application/pdf, image/png).
   */
  mimeType?: string;
  /**
   * Explicit theme mode override. Defaults to current Acadex theme from next-themes.
   */
  theme?: "light" | "dark" | "system";
  /**
   * Callback fired when document has successfully rendered.
   */
  onLoadSuccess?: (pageCount: number) => void;
  /**
   * Callback fired when document fails to load or parse.
   */
  onError?: (error: Error) => void;
  /**
   * Additional container CSS classes.
   */
  className?: string;
}

export function UniversalDocumentViewer({
  src,
  fileName = "document",
  theme: explicitTheme,
  onLoadSuccess,
  onError,
  className = "",
}: UniversalDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<UDocClientType | null>(null);
  const viewerRef = useRef<UDocViewer | null>(null);

  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Sync with Acadex next-themes
  const { resolvedTheme } = useTheme();
  const activeTheme: "light" | "dark" = explicitTheme
    ? explicitTheme === "system"
      ? resolvedTheme === "dark"
        ? "dark"
        : "light"
      : explicitTheme
    : resolvedTheme === "dark"
    ? "dark"
    : "light";

  // Keep references to latest callbacks and state without triggering re-renders
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onLoadSuccessRef = useRef(onLoadSuccess);
  onLoadSuccessRef.current = onLoadSuccess;
  const activeThemeRef = useRef(activeTheme);
  activeThemeRef.current = activeTheme;

  // Track initialization sequence ID to prevent race conditions when switching files quickly
  const loadSeqRef = useRef(0);

  const initViewer = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    if (!containerRef.current || !src) return;

    setLoading(true);
    setInitError(null);

    // Clean up any existing viewer instance before mounting a new one
    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {
        console.warn("[UniversalDocumentViewer] Error destroying previous viewer:", e);
      }
      viewerRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    try {
      // Lazy load the WASM-based SDK so it does not bloat initial app bundle
      const { UDocClient } = await import("@docmentis/udoc-viewer");

      if (seq !== loadSeqRef.current || !containerRef.current) {
        return;
      }

      // Reuse client if already created, or initialize new client
      if (!clientRef.current) {
        const origin =
          typeof window !== "undefined" && window.location.origin
            ? window.location.origin
            : "";
        // baseUrl must be an absolute URL with trailing slash for assetUrl/new URL(file, baseUrl) to resolve properly
        const baseUrl = origin ? `${origin}/udoc/` : "/udoc/";
        clientRef.current = await UDocClient.create({
          baseUrl,
          disableTelemetry: true,
          disableUpdateCheck: true,
        });
      }

      if (seq !== loadSeqRef.current || !containerRef.current) {
        return;
      }

      // Create viewer in container
      const viewer = await clientRef.current.createViewer({
        container: containerRef.current,
        theme: activeThemeRef.current,
        // UI defaults: enable full navigation, thumbnails, search, zoom
        enablePerformanceCounter: false,
      });

      if (seq !== loadSeqRef.current) {
        viewer.destroy();
        return;
      }

      viewerRef.current = viewer;

      // Subscribe to viewer events
      viewer.on("document:load", (payload) => {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          onLoadSuccessRef.current?.(payload.pageCount);
        }
      });

      viewer.on("error", (payload) => {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          const err = payload.error || new Error("Failed to render document.");
          setInitError(err.message);
          onErrorRef.current?.(err);
        }
      });

      // Load document into viewer
      await viewer.load(src, {
        filename: fileName,
      });

      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    } catch (err: unknown) {
      if (seq === loadSeqRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[UniversalDocumentViewer] Initialization error:", error);
        setLoading(false);
        setInitError(error.message);
        onErrorRef.current?.(error);
      }
    }
  }, [src, fileName]);

  // Mount/remount viewer on src changes
  useEffect(() => {
    initViewer();

    return () => {
      // Invalidate in-flight loads
      loadSeqRef.current++;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch {
          // Ignore destruction errors on unmount
        }
        viewerRef.current = null;
      }
    };
  }, [initViewer]);

  // Clean up client on component unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        try {
          clientRef.current.destroy();
        } catch {
          // Ignore client destruction errors
        }
        clientRef.current = null;
      }
    };
  }, []);

  // Update theme dynamically without reloading the document
  useEffect(() => {
    if (viewerRef.current) {
      try {
        viewerRef.current.setTheme(activeTheme);
      } catch (err) {
        console.warn("[UniversalDocumentViewer] Theme update error:", err);
      }
    }
  }, [activeTheme]);

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden ${className}`}>
      {loading && !initError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading document viewer...</p>
        </div>
      )}

      {initError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xs gap-3 p-6 text-center">
          <div className="p-3 rounded-full bg-destructive/10 text-destructive">
            <FileWarning className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-base">Unable to View Document</h3>
          <p className="text-xs text-muted-foreground max-w-md">{initError}</p>
        </div>
      )}

      {/* Mounting container for UDocViewer */}
      <div
        ref={containerRef}
        className="w-full h-full flex-1 min-h-0 udoc-viewer-container"
      />
    </div>
  );
}

export default UniversalDocumentViewer;
