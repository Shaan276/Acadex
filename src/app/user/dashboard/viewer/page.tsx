"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Download,
  FileText,
  Maximize2,
  Minimize2,
  FileWarning,
} from "lucide-react";
import { UniversalDocumentViewer } from "@/components/universal-document-viewer";
import {
  toDownloadUrl,
  detectMimeFromMagicBytes,
  getExtension,
  isViewableFormat,
  getMimeTypeFromExtension,
} from "@/lib/document-utils";

export default function DocumentViewerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const fileUrl = searchParams.get("url") || "";
  const title = searchParams.get("title") || "Document";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentSource, setDocumentSource] = useState<File | Uint8Array | string | null>(null);
  const [detectedMime, setDetectedMime] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // Derive format badge label from detected MIME or title extension
  const formatBadge = useMemo(() => {
    const ext = getExtension(title) || getExtension(fileUrl);
    if (ext === "pdf" || detectedMime === "application/pdf") return "PDF";
    if (["docx", "doc"].includes(ext) || detectedMime.includes("word")) return "Word Document";
    if (["pptx", "ppt"].includes(ext) || detectedMime.includes("presentation")) return "PowerPoint";
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext) || detectedMime.startsWith("image/")) {
      return ext.toUpperCase() || "IMAGE";
    }
    return ext ? ext.toUpperCase() : "DOCUMENT";
  }, [title, fileUrl, detectedMime]);

  // Download URL using Acadex's Google Drive bypass
  const directDownloadUrl = useMemo(() => {
    return toDownloadUrl(fileUrl);
  }, [fileUrl]);

  // Filename with fallback extension for download
  const downloadFilename = useMemo(() => {
    if (title.match(/\.[a-z0-9]{2,5}$/i)) return title;
    const ext = getExtension(fileUrl);
    if (ext) return `${title}.${ext}`;
    if (detectedMime === "application/pdf") return `${title}.pdf`;
    if (detectedMime.includes("wordprocessingml")) return `${title}.docx`;
    if (detectedMime.includes("presentationml")) return `${title}.pptx`;
    return `${title}.pdf`;
  }, [title, fileUrl, detectedMime]);

  // Fullscreen toggle handler
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
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Fetch document through Acadex's authenticated proxy
  useEffect(() => {
    let isMounted = true;

    if (!fileUrl) {
      setError("No document URL provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDocumentSource(null);

    // Clean up previous blob URL if any
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(title)}`;

    fetch(proxyUrl)
      .then(async (res) => {
        if (!res.ok) {
          let errMsg = `Failed to load document (HTTP ${res.status})`;
          try {
            const errData = await res.json();
            if (errData.error) errMsg = errData.error;
          } catch {
            // Not a JSON error response
          }
          throw new Error(errMsg);
        }

        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Inspect magic bytes
        const magicMime = detectMimeFromMagicBytes(bytes);
        const headerMime = res.headers.get("content-type") || "";
        const extMime = getMimeTypeFromExtension(title) || getMimeTypeFromExtension(fileUrl);

        let finalMime = magicMime || headerMime || extMime || "application/octet-stream";

        // If magic bytes indicate ZIP/OpenXML and title is docx/pptx, refine MIME
        if (magicMime === "application/zip") {
          const ext = getExtension(title) || getExtension(fileUrl);
          if (ext === "docx") {
            finalMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          } else if (ext === "pptx") {
            finalMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          }
        }

        if (!isMounted) return;

        // Verify format support
        if (!isViewableFormat(title, finalMime) && !isViewableFormat(fileUrl, finalMime)) {
          throw new Error("Preview is not supported for this file format. Please download the file to view it.");
        }

        setDetectedMime(finalMime);

        // Create a File instance with explicit filename and MIME type
        const fileObj = new File([buffer], downloadFilename, { type: finalMime });
        setDocumentSource(fileObj);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Unable to load document.";
        console.error("[DocumentViewerPage] Error:", message);
        setError(message);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [fileUrl, title, downloadFilename]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full bg-background select-none overflow-hidden"
    >
      {/* Top Application Header Bar */}
      <header className="h-12 border-b border-border/80 bg-card/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 z-20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={() => router.back()}
            title="Go Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
            <h1
              className="text-sm font-semibold truncate max-w-[150px] xs:max-w-[220px] sm:max-w-[320px] md:max-w-md lg:max-w-xl"
              title={title}
            >
              {title}
            </h1>
            <Badge variant="secondary" className="text-[10px] font-mono shrink-0 hidden sm:inline-flex">
              {formatBadge}
            </Badge>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <a
            href={directDownloadUrl || fileUrl}
            download={downloadFilename}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium rounded-lg gap-1.5 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </a>
        </div>
      </header>

      {/* Main Document Content Canvas */}
      <main className="relative flex-1 w-full h-full min-h-0 bg-muted/30 overflow-hidden flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-3 p-6 text-center z-10">
            <div className="relative flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <FileText className="h-4 w-4 text-primary absolute" />
            </div>
            <p className="text-xs font-medium text-muted-foreground animate-pulse">
              Retrieving document from secure storage...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 p-6 max-w-md text-center bg-card rounded-2xl border border-border shadow-md m-4">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive">
              <FileWarning className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-base">
              {error.includes("not supported") ? "Preview Not Supported" : "Unable to Display Document"}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
            <a
              href={directDownloadUrl || fileUrl}
              download={downloadFilename}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" className="rounded-xl mt-2 gap-1.5">
                <Download className="h-4 w-4" /> Download Original File
              </Button>
            </a>
          </div>
        )}

        {!loading && !error && documentSource && (
          <UniversalDocumentViewer
            src={documentSource}
            fileName={title}
            mimeType={detectedMime}
            onError={(err) => setError(err.message || "Failed to render document.")}
            className="w-full h-full"
          />
        )}
      </main>
    </div>
  );
}
