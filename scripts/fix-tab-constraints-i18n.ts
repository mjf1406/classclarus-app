import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const locales = ["de", "es", "fr", "it", "ja", "ko", "nl", "pt", "ru", "th", "uk", "zhs", "zht"];

for (const loc of locales) {
  const file = join("src/i18n/resources", `${loc}.ts`);
  let content = readFileSync(file, "utf8");
  if (!content.includes("tabConstraints:\n    tabCharts:")) continue;

  const original = execSync(`git show HEAD:src/i18n/resources/${loc}.ts`, { encoding: "utf8" });
  const match = original.match(/tabConstraints:\s*"([^"]*)",/);
  if (!match) {
    console.error(`Could not find tabConstraints value for ${loc}`);
    continue;
  }
  const value = match[1];
  content = content.replace(
    "    tabConstraints:\n    tabCharts:",
    `    tabConstraints: "${value}",\n    tabCharts:`,
  );
  writeFileSync(file, content);
  console.log(`Fixed ${loc}`);
}

console.log("Done fixing tabConstraints");
