/**
 * Point release/latest.yml at BofBot-Setup.exe (stable URL) after copying the installer.
 * Usage: node scripts/patch-latest-yml-stable.cjs <version>   e.g. 0.2.3
 */
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node patch-latest-yml-stable.cjs <semver>");
  process.exit(1);
}

const ymlPath = path.join(__dirname, "..", "release", "latest.yml");
if (!fs.existsSync(ymlPath)) {
  console.error("Missing:", ymlPath);
  process.exit(1);
}

const from = `BofBot-Setup-${version}.exe`;
const to = "BofBot-Setup.exe";
let s = fs.readFileSync(ymlPath, "utf8");
if (!s.includes(from)) {
  console.error(`Expected "${from}" in latest.yml — check version and artifact name.`);
  process.exit(1);
}
s = s.split(from).join(to);
fs.writeFileSync(ymlPath, s);
console.log("Patched latest.yml →", to);
