/**
 * Point release/latest-mac.yml at BofBot-Setup.dmg (stable URL) after Mac build.
 * Run on the machine that produced release/latest-mac.yml (e.g. after electron-builder --mac).
 * Usage: node scripts/patch-latest-mac-yml-stable.cjs <version>   e.g. 0.2.7
 */
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node patch-latest-mac-yml-stable.cjs <semver>");
  process.exit(1);
}

const ymlPath = path.join(__dirname, "..", "release", "latest-mac.yml");
if (!fs.existsSync(ymlPath)) {
  console.error("Missing:", ymlPath);
  process.exit(1);
}

const from = `BofBot-Setup-${version}.dmg`;
const to = "BofBot-Setup.dmg";
let s = fs.readFileSync(ymlPath, "utf8");
if (!s.includes(from)) {
  console.error(`Expected "${from}" in latest-mac.yml — check version and artifact name.`);
  process.exit(1);
}
s = s.split(from).join(to);
fs.writeFileSync(ymlPath, s);
console.log("Patched latest-mac.yml →", to);
