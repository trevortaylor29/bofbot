/**
 * Bump patch in ../package.json, print new version on stdout (for release.bat).
 */
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const j = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const parts = j.version.split(".").map(Number);
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  console.error("Invalid version:", j.version);
  process.exit(1);
}
parts[2] += 1;
j.version = parts.join(".");
fs.writeFileSync(pkgPath, JSON.stringify(j, null, 2) + "\n");
console.log(j.version);
