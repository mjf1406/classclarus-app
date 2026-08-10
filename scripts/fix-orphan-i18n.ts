import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const locales = ["de", "es", "fr", "it", "ja", "ko", "nl", "pt", "ru", "th", "uk", "zhs", "zht"];

for (const loc of locales) {
  const file = join("src/i18n/resources", `${loc}.ts`);
  let content = readFileSync(file, "utf8");
  content = content.replace(
    /(chartRecordViewerLoading: "[^"]+",\n)\s*"[^"]+",\n(\s*constraintsTitle:)/,
    "$1$2",
  );
  writeFileSync(file, content);
  console.log(`Cleaned ${loc}`);
}
