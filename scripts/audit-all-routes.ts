import fs from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

const apiDir = path.join(process.cwd(), "src", "app", "api");
const routes = walk(apiDir);
console.log(`Found ${routes.length} API route files.\n`);

interface RouteAudit {
  route: string;
  methods: string[];
  authMechanisms: string[];
  findings: string;
}

const audits: RouteAudit[] = [];

for (const r of routes) {
  const content = fs.readFileSync(r, "utf8");
  const rel = path.relative(process.cwd(), r).replace(/\\/g, "/");
  const methods: string[] = [];
  for (const m of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(content)) {
      methods.push(m);
    }
  }

  const authMechanisms: string[] = [];
  if (content.includes("requireSuperAdmin")) authMechanisms.push("requireSuperAdmin");
  if (content.includes("requireAdmin")) authMechanisms.push("requireAdmin");
  if (content.includes("getAuthUser")) authMechanisms.push("getAuthUser");
  if (content.includes("verifyToken") || content.includes("jwt.verify")) authMechanisms.push("jwt.verify");
  if (content.includes("authMiddleware")) authMechanisms.push("authMiddleware");
  if (content.includes("CRON_SECRET") || content.includes("process.env.CRON_SECRET")) authMechanisms.push("CRON_SECRET");

  let findings = "Public / Unprotected";
  if (authMechanisms.includes("requireSuperAdmin")) {
    findings = "Superadmin Only";
  } else if (authMechanisms.includes("requireAdmin")) {
    findings = "Admin / Superadmin (Scoped)";
  } else if (authMechanisms.includes("getAuthUser") || authMechanisms.includes("jwt.verify")) {
    findings = "Authenticated User (Student/Admin)";
  } else if (authMechanisms.includes("CRON_SECRET")) {
    findings = "Cron Secret Guarded";
  }

  audits.push({
    route: "/" + rel.replace("src/app/", "").replace("/route.ts", ""),
    methods,
    authMechanisms,
    findings,
  });
}

for (const a of audits) {
  console.log(`${a.methods.join(", ").padEnd(16)} ${a.route.padEnd(38)} [${a.findings}] -> Checks: ${a.authMechanisms.join(", ") || "NONE"}`);
}
