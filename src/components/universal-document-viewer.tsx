"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { resolveResource } from "@/lib/resource-resolver";
import { ImageViewer } from "@/components/image-viewer";
import { OfficeEmbedViewer } from "@/components/office-embed-viewer";
import { ExternalResourceCard } from "@/components/external-resource-card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full w-full">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium mt-2">Loading document viewer...</p>
      </div>
    ),
  }
);

export interface UniversalDocumentViewerProps {
  /**
   * Document source: URL string, File object, or Uint8Array.
   */
  src: string | File | Uint8Array;
  /**
   * Display filename or document title.
   */
  fileName?: string;
  /**
   * Optional MIME type hint (e.g. application/pdf, image/png).
   */
  mimeType?: string;
  /**
   * Callback fired on error.
   */
  onError?: (error: Error) => void;
  /**
   * Additional container CSS classes.
   */
  className?: string;
}

export function UniversalDocumentViewer({
  src,
  fileName = "Document",
  mimeType,
  onError,
  className = "",
}: UniversalDocumentViewerProps) {
  // Convert src to a URL string
  const sourceUrl = useMemo(() => {
    if (typeof src === "string") return src;
    if (typeof window !== "undefined") {
      if (src instanceof File || src instanceof Blob) {
        return URL.createObjectURL(src);
      }
      if (src instanceof Uint8Array) {
        const blob = new Blob([src as unknown as BlobPart], { type: mimeType || "application/pdf" });
        return URL.createObjectURL(blob);
      }
    }
    return "";
  }, [src, mimeType]);

  // Clean up object URLs on unmount if one was generated
  React.useEffect(() => {
    return () => {
      if (typeof src !== "string" && sourceUrl && sourceUrl.startsWith("blob:")) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [src, sourceUrl]);

  // Resolve canonical resource metadata and viewer strategy
  const resolved = useMemo(() => {
    return resolveResource(sourceUrl, fileName, mimeType);
  }, [sourceUrl, fileName, mimeType]);

  if (!sourceUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center bg-muted/20 ${className}`}>
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-2">No document source provided.</p>
      </div>
    );
  }

  // 1. PDF.js Viewer
  if (resolved.viewerKind === "pdfjs") {
    return (
      <PdfViewer
        url={resolved.previewUrl}
        title={resolved.title}
        downloadUrl={resolved.downloadUrl}
        onError={onError}
        className={className}
      />
    );
  }

  // 2. Responsive Image Viewer
  if (resolved.viewerKind === "image") {
    return (
      <ImageViewer
        url={resolved.previewUrl}
        title={resolved.title}
        downloadUrl={resolved.downloadUrl}
        className={className}
      />
    );
  }

  // 3. Office & Google Workspace Embedded Iframe Viewer
  if (resolved.viewerKind === "office_iframe" || resolved.viewerKind === "google_iframe") {
    return (
      <OfficeEmbedViewer
        previewUrl={resolved.previewUrl}
        directOpenUrl={resolved.directOpenUrl}
        downloadUrl={resolved.downloadUrl}
        title={resolved.title}
        className={className}
      />
    );
  }

  // 4. External Website Card
  if (resolved.viewerKind === "external_card") {
    return (
      <ExternalResourceCard
        url={resolved.rawUrl}
        title={resolved.title}
        className={className}
      />
    );
  }

  // 5. Unsupported / Fallback View
  return (
    <div className={`flex flex-col items-center justify-center p-6 h-full w-full bg-muted/20 ${className}`}>
      <div className="flex flex-col items-center max-w-sm w-full bg-card rounded-2xl border border-border shadow-xs p-6 text-center gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Preview Not Available</h3>
        <p className="text-xs text-muted-foreground">
          This file format cannot be previewed in the browser. You can download it or open the original link.
        </p>

        <div className="flex items-center gap-2 mt-2 w-full">
          {resolved.downloadUrl && (
            <a
              href={resolved.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button size="sm" className="w-full gap-1.5 rounded-xl text-xs">
                <Download className="h-3.5 w-3.5" /> Download File
              </Button>
            </a>
          )}

          {resolved.directOpenUrl && (
            <a
              href={resolved.directOpenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Open Link
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default UniversalDocumentViewer;
