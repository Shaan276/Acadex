"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  AlertCircle,
  RefreshCw,
  Download,
  ChevronUp,
  ChevronDown,
  Expand,
} from "lucide-react";
import { ImageViewer } from "@/components/image-viewer";

interface PdfViewerProps {
  url: string;
  title?: string;
  downloadUrl?: string;
  className?: string;
  onError?: (err: Error) => void;
}

interface PageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Individual Canvas Page Component for Continuous Vertical Scroll.
 * Lazily renders canvas when within or near the visible scroll viewport.
 */
interface PdfPageProps {
  pageNum: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any;
  scale: number;
  rotation: number;
  targetWidth: number;
  targetHeight: number;
  onPageVisible: (pageNum: number) => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

function PdfPage({
  pageNum,
  pdfDoc,
  scale,
  rotation,
  targetWidth,
  targetHeight,
  onPageVisible,
  rootRef,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(pageNum <= 3); // Preload first 3 pages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  // Proximity & Visibility Observers
  useEffect(() => {
    const el = containerRef.current;
    const root = rootRef.current;
    if (!el || !root) return;

    // Proximity observer: begins rendering when within 600px of viewport
    const proximityObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNearViewport(true);
        }
      },
      {
        root,
        rootMargin: "600px 0px",
      }
    );

    // Active page observer: triggers when page occupies center of viewport
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onPageVisible(pageNum);
        }
      },
      {
        root,
        threshold: 0.4,
      }
    );

    proximityObserver.observe(el);
    visibilityObserver.observe(el);

    return () => {
      proximityObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [pageNum, onPageVisible, rootRef]);

  // Canvas Render
  useEffect(() => {
    if (!isNearViewport || !pdfDoc) return;

    let isMounted = true;

    async function render() {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const page = await pdfDoc.getPage(pageNum);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale, rotation });

        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (isMounted) setRendered(true);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "name" in err && err.name === "RenderingCancelledException") {
          return;
        }
        console.warn(`[PdfViewer] Page ${pageNum} render warning:`, err);
      }
    }

    render();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pageNum, pdfDoc, scale, rotation, isNearViewport]);

  return (
    <div
      ref={containerRef}
      data-page-number={pageNum}
      style={{
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        maxWidth: "100%",
      }}
      className="relative rounded-lg sm:rounded-xl overflow-hidden shadow-lg border border-border/70 bg-white dark:bg-card flex items-center justify-center transition-all shrink-0"
    >
      <canvas
        ref={canvasRef}
        className={`block w-full h-full object-contain ${rendered ? "opacity-100" : "opacity-0"}`}
      />
      {!rendered && (
        <div className="absolute inset-0 bg-muted/20 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground select-none">
          <RefreshCw className="h-5 w-5 animate-spin text-primary/60" />
          <span>Page {pageNum}</span>
        </div>
      )}
    </div>
  );
}

export function PdfViewer({
  url,
  title = "Document",
  downloadUrl,
  className = "",
  onError,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImageFallback, setIsImageFallback] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [activePage, setActivePage] = useState<number>(1);
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layout sizing
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [baseDimensions, setBaseDimensions] = useState<PageDimensions>({
    width: 595.28,
    height: 841.89,
    aspectRatio: 595.28 / 841.89,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  // ResizeObserver to calculate available width on mobile and responsive screens
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => {
      setContainerWidth(el.clientWidth);
    };

    handleResize();

    const ro = new ResizeObserver(() => {
      handleResize();
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setIsImageFallback(false);

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
        setActivePage(1);

        // Precompute base aspect ratio from page 1
        try {
          const p1 = await doc.getPage(1);
          const unscaled = p1.getViewport({ scale: 1.0, rotation: 0 });
          setBaseDimensions({
            width: unscaled.width,
            height: unscaled.height,
            aspectRatio: unscaled.width / unscaled.height,
          });
        } catch {
          // fallback to standard A4
        }

        setLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;

        // If loading failed because the file is actually an image, test image fallback
        const testImg = new Image();
        testImg.onload = () => {
          if (isMounted) {
            setIsImageFallback(true);
            setLoading(false);
          }
        };
        testImg.onerror = () => {
          if (isMounted) {
            const msg = err instanceof Error ? err.message : "Failed to load PDF document.";
            console.error("[PdfViewer] Load Error:", err);
            setError(msg);
            setLoading(false);
            if (onError && err instanceof Error) onError(err);
          }
        };
        testImg.src = url;
      }
    }

    if (url) {
      loadPdf();
    }

    return () => {
      isMounted = false;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url, onError]);

  // Calculate Responsive Target Dimensions Matching Mobile Screen Width
  // On mobile (< 640px): width matches device screen with minimal 8px padding
  // On desktop: width fits comfortably up to 880px
  const isMobile = containerWidth > 0 && containerWidth < 640;
  const horizontalPadding = isMobile ? 16 : 48;
  const availableWidth = Math.max(
    280,
    isMobile
      ? containerWidth - horizontalPadding
      : Math.min(containerWidth - horizontalPadding, 880)
  );

  // Base scale such that 100% zoom matches device width exactly
  const baseFitWidthScale = baseDimensions.width > 0 ? availableWidth / baseDimensions.width : 1.0;
  const effectiveScale = baseFitWidthScale * zoomMultiplier;

  const targetWidth = Math.floor(availableWidth * zoomMultiplier);
  const targetHeight = Math.floor(targetWidth / baseDimensions.aspectRatio);

  // Active page callback from individual page observer
  const handlePageVisible = useCallback((num: number) => {
    setActivePage(num);
  }, []);

  // Smooth Scroll to Page
  const scrollToPage = (target: number) => {
    const clamped = Math.max(1, Math.min(numPages, target));
    const targetEl = scrollViewportRef.current?.querySelector(`[data-page-number="${clamped}"]`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      setActivePage(clamped);
    }
  };

  // Zoom Controls
  const zoomIn = () => setZoomMultiplier((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 3.0));
  const zoomOut = () => setZoomMultiplier((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 0.5));
  const resetZoom = () => setZoomMultiplier(1.0); // Resets to exact device width
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

  // Seamless fallback to ImageViewer if file was an image
  if (isImageFallback) {
    return (
      <ImageViewer
        url={url}
        title={title}
        downloadUrl={downloadUrl}
        className={className}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full bg-muted/20 select-none overflow-hidden ${className}`}
    >
      {/* Floating Top Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[140px] sm:max-w-[240px]">
            {title}
          </span>
          {numPages > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground/80 shrink-0 hidden sm:inline">
              ({numPages} {numPages === 1 ? "page" : "pages"})
            </span>
          )}
        </div>

        {/* View & Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={zoomOut}
            disabled={zoomMultiplier <= 0.5 || loading}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          {/* Reset to Fit Width (Matches device width) */}
          <button
            onClick={resetZoom}
            disabled={loading}
            className="text-xs font-mono text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-muted"
            title="Reset to 100% (Fit Width)"
          >
            {Math.round(zoomMultiplier * 100)}%
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={zoomIn}
            disabled={zoomMultiplier >= 3.0 || loading}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={rotate}
            disabled={loading}
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

      {/* 
        Continuous Vertical Scroll Viewport:
        - Page 1 is on top
        - Page 2 is displayed immediately below Page 1
        - Page 3 is displayed below Page 2
        - User scrolls down smoothly without needing to click arrows
        - Width matches the device width on mobile screens
      */}
      <div
        ref={scrollViewportRef}
        className="relative flex-1 w-full h-full overflow-y-auto overflow-x-auto p-2 sm:p-6 flex flex-col items-center gap-4 sm:gap-6 pb-24 scroll-smooth"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center m-auto">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">
              Rendering document pages...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 p-6 max-w-sm text-center bg-card rounded-2xl border border-border shadow-xs m-auto">
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

        {!loading && !error && numPages > 0 && (
          <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-full">
            {Array.from({ length: numPages }, (_, index) => (
              <PdfPage
                key={`page-${index + 1}`}
                pageNum={index + 1}
                pdfDoc={pdfDocRef.current}
                scale={effectiveScale}
                rotation={rotation}
                targetWidth={targetWidth}
                targetHeight={targetHeight}
                onPageVisible={handlePageVisible}
                rootRef={scrollViewportRef}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Bottom Page Indicator & Page Jump Pill */}
      {!loading && !error && numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md border border-border/80 rounded-full px-3 py-1 shadow-xl flex items-center gap-2 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full hover:bg-muted"
            onClick={() => scrollToPage(activePage - 1)}
            disabled={activePage <= 1}
            title="Scroll to Previous Page"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>

          <span className="text-xs font-semibold font-mono px-1 select-none whitespace-nowrap">
            {activePage} / {numPages}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full hover:bg-muted"
            onClick={() => scrollToPage(activePage + 1)}
            disabled={activePage >= numPages}
            title="Scroll to Next Page"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
