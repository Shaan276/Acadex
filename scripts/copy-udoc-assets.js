import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const srcWasm = path.join(
  projectRoot,
  "node_modules",
  "@docmentis",
  "udoc-viewer",
  "dist",
  "src",
  "wasm",
  "udoc_bg.wasm"
);
const srcWorker = path.join(
  projectRoot,
  "node_modules",
  "@docmentis",
  "udoc-viewer",
  "dist",
  "src",
  "worker",
  "worker.js"
);

const destDir = path.join(projectRoot, "public", "udoc");
const destWasm = path.join(destDir, "udoc_bg.wasm");
const destWorker = path.join(destDir, "worker.js");

if (fs.existsSync(srcWasm) && fs.existsSync(srcWorker)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcWasm, destWasm);
  fs.copyFileSync(srcWorker, destWorker);
  console.log("[copy-udoc-assets] Successfully copied udoc-viewer WASM and Worker assets to public/udoc/");
} else {
  console.warn("[copy-udoc-assets] @docmentis/udoc-viewer dist assets not found in node_modules.");
}
