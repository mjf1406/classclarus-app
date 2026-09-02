export type ThresholdAlertConfig = {
  count: number;
  action: string;
};

export type ThresholdAlertMetric = "warning" | "minus";

export type ThresholdStudentInput = {
  userId: string;
  warningCount: number;
  minusCount: number;
};

export type ThresholdAlertHit = {
  userId: string;
  metric: ThresholdAlertMetric;
  count: number;
  threshold: number;
  action: string;
};

/** Highest configured alert whose count the student has reached, or null. */
export function highestCrossedAlert(
  count: number,
  alerts: readonly ThresholdAlertConfig[],
): ThresholdAlertConfig | null {
  let highest: ThresholdAlertConfig | null = null;
  for (const alert of alerts) {
    if (count < alert.count) continue;
    if (highest === null || alert.count > highest.count) {
      highest = alert;
    }
  }
  return highest;
}

/**
 * Students whose warning or minus count has reached a configured alert.
 * One row per metric crossed; highest threshold first, then count.
 */
export function studentsAtThresholds(
  students: readonly ThresholdStudentInput[],
  warningAlerts: readonly ThresholdAlertConfig[],
  minusAlerts: readonly ThresholdAlertConfig[],
): ThresholdAlertHit[] {
  const hits: ThresholdAlertHit[] = [];
  for (const student of students) {
    const warning = highestCrossedAlert(student.warningCount, warningAlerts);
    if (warning) {
      hits.push({
        userId: student.userId,
        metric: "warning",
        count: student.warningCount,
        threshold: warning.count,
        action: warning.action,
      });
    }
    const minus = highestCrossedAlert(student.minusCount, minusAlerts);
    if (minus) {
      hits.push({
        userId: student.userId,
        metric: "minus",
        count: student.minusCount,
        threshold: minus.count,
        action: minus.action,
      });
    }
  }
  return hits.sort((a, b) => {
    if (b.threshold !== a.threshold) return b.threshold - a.threshold;
    if (b.count !== a.count) return b.count - a.count;
    if (a.metric !== b.metric) return a.metric === "minus" ? -1 : 1;
    return a.userId.localeCompare(b.userId);
  });
}
