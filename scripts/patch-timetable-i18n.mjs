import fs from "fs";
import path from "path";

const dir = "src/i18n/resources";
const permPatches = {
  ja: { group: "時間割", read: "時間割を表示", manage: "時間割を管理", nav: "時間割" },
  ko: { group: "시간표", read: "시간표 보기", manage: "시간표 관리", nav: "시간표" },
  th: { group: "ตารางเรียน", read: "ดูตารางเรียน", manage: "จัดการตารางเรียน", nav: "ตารางเรียน" },
  zhs: { group: "课程表", read: "查看课程表", manage: "管理课程表", nav: "课程表" },
  zht: { group: "課程表", read: "檢視課程表", manage: "管理課程表", nav: "課程表" },
  es: { group: "Horario", read: "Ver horario", manage: "Gestionar horario", nav: "Horario" },
  fr: {
    group: "Emploi du temps",
    read: "Voir l'emploi du temps",
    manage: "Gérer l'emploi du temps",
    nav: "Emploi du temps",
  },
  it: { group: "Orario", read: "Visualizza orario", manage: "Gestisci orario", nav: "Orario" },
  de: {
    group: "Stundenplan",
    read: "Stundenplan anzeigen",
    manage: "Stundenplan verwalten",
    nav: "Stundenplan",
  },
  nl: { group: "Rooster", read: "Rooster bekijken", manage: "Rooster beheren", nav: "Rooster" },
  pt: { group: "Horário", read: "Ver horário", manage: "Gerir horário", nav: "Horário" },
  ru: {
    group: "Расписание",
    read: "Просмотр расписания",
    manage: "Управление расписанием",
    nav: "Расписание",
  },
  uk: {
    group: "Розклад",
    read: "Перегляд розкладу",
    manage: "Керування розкладом",
    nav: "Розклад",
  },
};

for (const [loc, p] of Object.entries(permPatches)) {
  const file = path.join(dir, `${loc}.ts`);
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("permGroup_timetable")) {
    content = content.replace(
      /(permGroup_calendar: "[^"]+",\n)/,
      `$1    permGroup_timetable: "${p.group}",\n`,
    );
    content = content.replace(
      /(perm_calendar_read: "[^"]+",\n)/,
      `$1    perm_timetable_manage: "${p.manage}",\n    perm_timetable_read: "${p.read}",\n`,
    );
  }
  if (!content.includes("timetable:")) {
    content = content.replace(
      /(\n {2}notifications: \{\n)/,
      `\n  timetable: {\n    nav: "${p.nav}",\n  },$1`,
    );
  }
  fs.writeFileSync(file, content);
  console.log("patched", loc);
}
