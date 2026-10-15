// Zips the repository (tracked + untracked files, minus node_modules/.next/etc.) to dist/cbc-shuffle.zip
import { execSync } from "node:child_process";
import fs from "node:fs";
fs.mkdirSync("dist", { recursive: true });
const out = "dist/cbc-shuffle.zip";
if (fs.existsSync(out)) fs.unlinkSync(out);
execSync(`zip -qr ${out} . -x "node_modules/*" ".next/*" "dist/*" "playwright-report/*" "test-results/*" "lighthouse/*" "supabase/.temp/*" ".git/*" "*.DS_Store"`, { stdio: "inherit" });
console.log(`${out}: ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
