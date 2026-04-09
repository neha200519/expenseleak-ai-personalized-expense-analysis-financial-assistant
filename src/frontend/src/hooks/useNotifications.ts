import { useCallback, useEffect, useRef, useState } from "react";
import {
  useGetBudgetStatus,
  useGetRiskLevel,
  useGetSpendingAlerts,
} from "./useQueries";

export type NotificationPermission = "default" | "granted" | "denied";

function sendPushNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/assets/ExpenseLeak_AI_Logo_Transparent.png",
      badge: "/assets/ExpenseLeak_AI_Logo_Transparent.png",
      tag: `expenseleak-${Date.now()}`,
      requireInteraction: false,
    });
    setTimeout(() => n.close(), 8000);
  } catch (e) {
    console.warn("Push notification failed:", e);
  }
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied",
  );

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}

/**
 * Fires push notifications for:
 * 1. Risk level Medium or High
 * 2. Budget percentage >= 90%
 * 3. Active spending alerts
 */
export function useRiskAlertNotifications(enabled: boolean) {
  const { data: riskLevel } = useGetRiskLevel();
  const { data: budgetStatus } = useGetBudgetStatus();
  const { data: alerts } = useGetSpendingAlerts();

  const notifiedKeys = useRef<Set<string>>(new Set());

  const fireAlerts = useCallback(() => {
    if (!enabled) return;
    if (Notification.permission !== "granted") return;

    // Risk level alerts
    if (riskLevel === "High" || riskLevel === "Medium") {
      const riskKey = `risk-${riskLevel}`;
      if (!notifiedKeys.current.has(riskKey)) {
        notifiedKeys.current.add(riskKey);
        sendPushNotification(
          riskLevel === "High"
            ? "⚠️ High Spending Risk Detected!"
            : "🔶 Medium Spending Risk",
          riskLevel === "High"
            ? "You are in a high spending risk zone. Review your expenses now."
            : "Your spending is approaching a risky level.",
        );
      }
    }

    // Budget percentage alerts
    if (budgetStatus && budgetStatus.percentage >= 90) {
      const budgetKey = `budget-${Math.floor(budgetStatus.percentage / 10)}`;
      if (!notifiedKeys.current.has(budgetKey)) {
        notifiedKeys.current.add(budgetKey);
        const isExceeded = budgetStatus.percentage >= 100;
        sendPushNotification(
          isExceeded ? "🚨 Monthly Budget Exceeded!" : "⚠️ Budget Warning",
          isExceeded
            ? `You have exceeded your monthly budget. Spent: ₹${budgetStatus.spent.toFixed(0)} of ₹${budgetStatus.budget.toFixed(0)}.`
            : `You have used ${budgetStatus.percentage.toFixed(0)}% of your monthly budget.`,
        );
      }
    }

    // Spending monitor alerts
    if (alerts) {
      for (const alert of alerts) {
        if (alert.status === "Active") {
          const alertKey = `monitor-${alert.category}-${alert.status}`;
          if (!notifiedKeys.current.has(alertKey)) {
            notifiedKeys.current.add(alertKey);
            sendPushNotification(
              `⚠️ ${alert.category} Spending Alert`,
              `You're approaching your ${alert.category} limit. Spent: ₹${alert.spent.toFixed(0)} / ₹${alert.threshold.toFixed(0)}.`,
            );
          }
        }
      }
    }
  }, [enabled, riskLevel, budgetStatus, alerts]);

  useEffect(() => {
    const timer = setTimeout(fireAlerts, 1500);
    return () => clearTimeout(timer);
  }, [fireAlerts]);

  useEffect(() => {
    fireAlerts();
  }, [fireAlerts]);
}
