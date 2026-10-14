"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  AlertCircle,
  RefreshCw,
  Download,
} from "lucide-react";

interface PdfViewerProps {
  url: string;
  title?: string;
  downloadUrl?: string;
  className?: string;
  onError?: (err: Error) => void;
}

export function PdfViewer({
  url,
  downloadUrl,
  className = "",
  onError,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const loadingTask = pdfjs.getDocument({
          url,
          cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setPageNumber(1);
        setPageInput("1");
        setLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load PDF.";
        console.error("[PdfViewer] Load Error:", err);
        setError(msg);
        setLoading(false);
        if (onError && err instanceof Error) onError(err);
      }
    }

    if (url) {
      loadPdf();
    }

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url, onError]);

  // Render Page
  const renderPage = useCallback(
    async (num: number, currentScale: number, currentRotation: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const page = await pdfDocRef.current.getPage(num);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({
          scale: currentScale,
          rotation: currentRotation,
        });

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: unknown) {
        // Ignore normal cancellation errors during fast navigation/zooming
        if (err && typeof err === "object" && "name" in err && err.name === "RenderingCancelledException") {
          return;
        }
        console.warn("[PdfViewer] Render warning:", err);
      }
    },
    []
  );

  useEffect(() => {
    if (!loading && !error && pdfDocRef.current && numPages > 0) {
      renderPage(pageNumber, scale, rotation);
    }
  }, [loading, error, pageNumber, scale, rotation, numPages, renderPage]);

  // Page Controls
  const goToPrev = () => {
    if (pageNumber > 1) {
      const next = pageNumber - 1;
      setPageNumber(next);
      setPageInput(String(next));
    }
  };

  const goToNext = () => {
    if (pageNumber < numPages) {
      const next = pageNumber + 1;
      setPageNumber(next);
      setPageInput(String(next));
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
      setPageNumber(parsed);
    } else {
      setPageInput(String(pageNumber));
    }
  };

  // Zoom Controls
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const rotate = () => setRotation((prev) => (prev + 90) % 360);

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
        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={pageNumber <= 1 || loading}
            onClick={goToPrev}
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <Input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={() => setPageInput(String(pageNumber))}
              disabled={loading || numPages === 0}
              className="h-7 w-12 text-center text-xs font-mono px-1 py-0"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              / {numPages || 1}
            </span>
          </form>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={pageNumber >= numPages || loading}
            onClick={goToNext}
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={scale <= 0.5 || loading}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground w-12 text-center hidden sm:inline">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={scale >= 3.0 || loading}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={rotate}
            disabled={loading}
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

      {/* Canvas Viewport */}
      <div className="relative flex-1 w-full h-full overflow-auto p-4 flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">
              Loading document pages...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 p-6 max-w-sm text-center bg-card rounded-2xl border border-border shadow-xs">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h3 className="text-sm font-semibold">Unable to Render PDF</h3>
            <p className="text-xs text-muted-foreground">{error}</p>
            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="mt-2 gap-1.5 rounded-xl">
                  <Download className="h-4 w-4" /> Download Original File
                </Button>
              </a>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`shadow-md rounded-md bg-white transition-opacity duration-200 ${
            loading || error ? "hidden" : "block"
          }`}
        />
      </div>
    </div>
  );
}
