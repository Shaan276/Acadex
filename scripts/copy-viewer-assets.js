import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Copy Mozilla PDF.js worker
const pdfWorkerSrc = path.join(
  projectRoot,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.js"
);
const pdfWorkerDest = path.join(projectRoot, "public", "pdf.worker.min.js");

if (fs.existsSync(pdfWorkerSrc)) {
  fs.copyFileSync(pdfWorkerSrc, pdfWorkerDest);
  console.log("[copy-viewer-assets] Copied pdf.worker.min.js to public/");
} else {
  console.warn("[copy-viewer-assets] pdf.worker.min.js not found in node_modules/pdfjs-dist/build/");
}
