import { useEffect } from "react";

import { useCan } from "@/hooks/permissions/useCan";
import { useAppLanguage } from "@/i18n/language-context";
import type { AppLanguage } from "@/lib/languages";

type ClassStudentLanguageOverrideProps = {
  studentLanguage: AppLanguage;
};

/**
 * Forces i18n to the class student language while the viewer is a student in this class.
 * Clears on leave / non-student without writing localStorage.
 */
export function ClassStudentLanguageOverride({
  studentLanguage,
}: ClassStudentLanguageOverrideProps) {
  const { role } = useCan();
  const { setLanguageOverride } = useAppLanguage();

  useEffect(() => {
    if (role === "student") {
      setLanguageOverride(studentLanguage);
    } else if (role !== null) {
      setLanguageOverride(null);
    }
  }, [role, studentLanguage, setLanguageOverride]);

  useEffect(() => {
    return () => {
      setLanguageOverride(null);
    };
  }, [setLanguageOverride]);

  return null;
}
