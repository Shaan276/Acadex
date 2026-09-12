/**
 * @module lib/document-utils
 * @description Centralized utilities for document URLs, MIME type detection,
 * and preview capability checks across Acadex.
 */

/**
 * Transforms any Google Drive URL into an authenticated direct download URL.
 * Appends `&confirm=t` to bypass the Google Drive large file virus-scan prompt.
 */
export function toDownloadUrl(url: string): string {
  if (!url) return "";
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&confirm=t&id=${match[1]}`;
  }
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch) {
    return `https://drive.google.com/uc?export=download&confirm=t&id=${idMatch[1]}`;
  }
  return url;
}

/**
 * Extracts a clean filename from a URL or title string.
 */
export function extractFilename(urlOrTitle: string, defaultName = "document"): string {
  if (!urlOrTitle) return defaultName;
  try {
    const parsed = new URL(urlOrTitle, "http://localhost");
    const pathname = parsed.pathname;
    const name = pathname.split("/").filter(Boolean).pop();
    if (name && name.includes(".")) {
      return decodeURIComponent(name);
    }
  } catch {
    // Fall through if not a valid URL
  }
  return urlOrTitle.trim() || defaultName;
}

/**
 * Detects MIME type by inspecting the initial magic bytes of a binary buffer.
 */
export function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 4) return null;

  // %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }

  // PNG: \x89PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return "image/png";
  }

  // JPEG: \xFF\xD8\xFF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "image/jpeg";
  }

  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // BMP: BM
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return "image/bmp";
  }

  // ZIP / OpenXML (DOCX, PPTX): PK\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "application/zip"; // Container for DOCX/PPTX
  }

  return null;
}

/**
 * Known file extensions supported by @docmentis/udoc-viewer in Acadex:
 * - PDF: .pdf
 * - Word: .docx, .doc
 * - PowerPoint: .pptx, .ppt
 * - Images: .png, .jpg, .jpeg, .webp, .svg, .gif, .bmp
 */
const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "gif",
  "bmp",
]);

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/bmp",
]);

/**
 * Extracts the file extension (lowercase, without dot) from a filename or URL.
 */
export function getExtension(filenameOrUrl: string): string {
  if (!filenameOrUrl) return "";
  const clean = filenameOrUrl.split(/[?#]/)[0];
  const lastSegment = clean.split("/").filter(Boolean).pop() || "";
  const parts = lastSegment.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

/**
 * Checks whether the given filename, URL, or MIME type is previewable in Acadex.
 */
export function isViewableFormat(filenameOrUrl: string, mimeType?: string): boolean {
  if (mimeType && SUPPORTED_MIME_TYPES.has(mimeType)) {
    return true;
  }
  const ext = getExtension(filenameOrUrl);
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Infers a MIME type from a filename or URL extension.
 */
export function getMimeTypeFromExtension(filenameOrUrl: string): string {
  const ext = getExtension(filenameOrUrl);
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}
