import type { ReactNode } from "react";

import {
  ExpectationRowEditContext,
  type ExpectationRowEditContextValue,
} from "@/components/expectations/expectationRowEditContext";

export function ExpectationRowEditProvider({
  value,
  children,
}: {
  value: ExpectationRowEditContextValue;
  children: ReactNode;
}) {
  return (
    <ExpectationRowEditContext.Provider value={value}>
      {children}
    </ExpectationRowEditContext.Provider>
  );
}
