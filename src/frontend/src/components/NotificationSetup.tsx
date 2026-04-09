import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, BellOff, BellRing, CheckCircle, Smartphone } from "lucide-react";
import {
  useNotificationPermission,
  useRiskAlertNotifications,
} from "../hooks/useNotifications";

export default function NotificationSetup() {
  const { permission, requestPermission } = useNotificationPermission();

  // Always wire up alert notifications; they only fire if permission is granted
  useRiskAlertNotifications(permission === "granted");

  const isSupported = "Notification" in window;

  const handleEnable = async () => {
    await requestPermission();
  };

  if (!isSupported) {
    return (
      <Card className="border-l-4 border-l-muted">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellOff className="h-6 w-6 text-muted-foreground" />
            <CardTitle className="text-base">Push Notifications</CardTitle>
          </div>
          <CardDescription>
            Your browser does not support push notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      className={`border-l-4 ${
        permission === "granted"
          ? "border-l-green-500"
          : permission === "denied"
            ? "border-l-red-500"
            : "border-l-chart-4"
      }`}
      data-ocid="notification_setup.card"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {permission === "granted" ? (
              <BellRing className="h-6 w-6 text-green-500 animate-pulse" />
            ) : permission === "denied" ? (
              <BellOff className="h-6 w-6 text-red-500" />
            ) : (
              <Bell className="h-6 w-6 text-chart-4" />
            )}
            <div>
              <CardTitle>Phone & Browser Alerts</CardTitle>
              <CardDescription>
                Get notified when your budget or spending is at risk
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              permission === "granted"
                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                : permission === "denied"
                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                  : "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"
            }
          >
            {permission === "granted"
              ? "Active"
              : permission === "denied"
                ? "Blocked"
                : "Not Enabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === "granted" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">
                  Notifications are active
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  You will receive alerts on this device whenever your spending
                  is at risk, a budget is exceeded, or a monitored category like
                  Food or Shopping reaches its limit.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                <span className="text-red-500 text-lg">🚨</span>
                <div>
                  <p className="font-medium">High Risk Alert</p>
                  <p className="text-xs text-muted-foreground">
                    When risk score is high
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                <span className="text-yellow-500 text-lg">⚠️</span>
                <div>
                  <p className="font-medium">Budget Warning</p>
                  <p className="text-xs text-muted-foreground">
                    When budget nears limit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                <span className="text-orange-500 text-lg">🛍️</span>
                <div>
                  <p className="font-medium">App Risk Alert</p>
                  <p className="text-xs text-muted-foreground">
                    Food & shopping limits
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : permission === "denied" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <BellOff className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  Notifications are blocked
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  To receive spending risk alerts, please allow notifications in
                  your browser settings. In Chrome: click the lock icon in the
                  address bar → Notifications → Allow.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-8 w-8 text-chart-4" />
                <div>
                  <p className="font-semibold">
                    Enable spending alerts on your phone
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Get a notification pop-up on your device whenever:
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground ml-2">
                <li className="flex items-center gap-2">
                  <span>🚨</span> Your overall spending risk turns High
                </li>
                <li className="flex items-center gap-2">
                  <span>⚠️</span> A budget category is close to or over the limit
                </li>
                <li className="flex items-center gap-2">
                  <span>🛍️</span> Food or Shopping spending approaches its
                  threshold
                </li>
                <li className="flex items-center gap-2">
                  <span>📱</span> Every time you open the app while at risk
                </li>
              </ul>
            </div>
            <Button
              className="w-full"
              onClick={handleEnable}
              data-ocid="notification_setup.primary_button"
            >
              <Bell className="h-4 w-4 mr-2" />
              Enable Spending Alerts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
