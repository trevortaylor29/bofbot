/**
 * Point release/latest-mac.yml at stable artifact names (DMG for installs, ZIP for auto-update).
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

const fromDmg = `BofBot-Setup-${version}.dmg`;
const toDmg = "BofBot-Setup.dmg";
const fromZip = `BofBot-Setup-${version}.zip`;
const toZip = "BofBot-Setup.zip";

let s = fs.readFileSync(ymlPath, "utf8");
let changed = false;
if (s.includes(fromDmg)) {
  s = s.split(fromDmg).join(toDmg);
  changed = true;
  console.log("Patched latest-mac.yml DMG ref →", toDmg);
}
if (s.includes(fromZip)) {
  s = s.split(fromZip).join(toZip);
  changed = true;
  console.log("Patched latest-mac.yml ZIP ref →", toZip);
}
if (!changed) {
  console.error(
    `Expected "${fromDmg}" and/or "${fromZip}" in latest-mac.yml — check version and artifact names.`
  );
  process.exit(1);
}
fs.writeFileSync(ymlPath, s);
