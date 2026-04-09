import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/currency";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Settings,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useGetSpendingAlerts,
  useGetSpendingMonitorSettings,
  useRegisterSpendingMonitorConsent,
  useSetCategoryThreshold,
  useSetMonitoredCategories,
} from "../hooks/useQueries";

// Uses backend enum values (Health not Healthcare)
const categoryIcons: Record<string, string> = {
  Food: "🍔",
  Entertainment: "🎬",
  Transport: "🚗",
  Bills: "📄",
  Shopping: "🛍️",
  Health: "🏥",
  Travel: "✈️",
  Other: "📦",
};

const ALL_CATEGORIES = [
  "Food",
  "Entertainment",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Travel",
  "Other",
];

export default function SpendingMonitorCard() {
  const { data: settings, isLoading: settingsLoading } =
    useGetSpendingMonitorSettings();
  const { data: alerts, isLoading: alertsLoading } = useGetSpendingAlerts();
  const registerConsent = useRegisterSpendingMonitorConsent();
  const setMonitoredCategories = useSetMonitoredCategories();
  const setCategoryThreshold = useSetCategoryThreshold();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [thresholds, setThresholds] = useState<Map<string, string>>(new Map());

  const isOptedIn = settings?.consentGiven ?? false;

  const handleOptInToggle = async (checked: boolean) => {
    try {
      await registerConsent.mutateAsync(checked);
      toast.success(
        checked ? "Spending monitor enabled" : "Spending monitor disabled",
      );
    } catch (error) {
      console.error("Failed to update consent:", error);
      toast.error("Failed to update spending monitor settings");
    }
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category]);
    } else {
      setSelectedCategories(selectedCategories.filter((c) => c !== category));
      thresholds.delete(category);
      setThresholds(new Map(thresholds));
    }
  };

  const handleThresholdChange = (category: string, value: string) => {
    const newThresholds = new Map(thresholds);
    newThresholds.set(category, value);
    setThresholds(newThresholds);
  };

  const handleSaveSettings = async () => {
    try {
      await setMonitoredCategories.mutateAsync(selectedCategories);
      for (const category of selectedCategories) {
        const thresholdValue = thresholds.get(category);
        if (thresholdValue) {
          const numericThreshold = Number.parseFloat(thresholdValue);
          if (!Number.isNaN(numericThreshold) && numericThreshold > 0) {
            await setCategoryThreshold.mutateAsync({
              category,
              threshold: numericThreshold,
            });
          }
        }
      }
      toast.success("Spending monitor settings saved");
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save spending monitor settings");
    }
  };

  const handleStartEditing = () => {
    if (settings) {
      setSelectedCategories([...settings.monitoredCategories]);
      const thresholdsMap = new Map<string, string>();
      for (const [category, threshold] of settings.thresholds) {
        thresholdsMap.set(category, threshold.toString());
      }
      setThresholds(thresholdsMap);
    }
    setIsEditing(true);
  };

  const getAlertStatusColor = (status: string) => {
    if (status === "Active") return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getAlertStatusBadge = (status: string) => {
    if (status === "Active")
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"
        >
          Active Alert
        </Badge>
      );
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
      >
        Clear
      </Badge>
    );
  };

  const getAlertIcon = (status: string) => {
    if (status === "Active") return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const activeAlertCount =
    alerts?.filter((a) => a.status === "Active").length ?? 0;

  return (
    <Card className="border-l-4 border-l-chart-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-chart-4" />
            <div>
              <CardTitle>Spending Monitor & Alerts</CardTitle>
              <CardDescription>
                Permission-based category spending monitoring
              </CardDescription>
            </div>
          </div>
          {isOptedIn && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleStartEditing}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {settingsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !isOptedIn ? (
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-muted/30 border border-muted space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="h-10 w-10 text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    Enable Spending Monitor
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get real-time alerts when your spending approaches or
                    exceeds category limits
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Privacy Safeguards:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "No background tracking — only monitors expenses you manually add",
                    "No external data sharing — all data stays on the Internet Computer",
                    "You control which categories to monitor and set your own limits",
                    "Opt out anytime — your data remains private and secure",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                onClick={() => handleOptInToggle(true)}
                className="w-full"
                disabled={registerConsent.isPending}
              >
                {registerConsent.isPending
                  ? "Enabling..."
                  : "Enable Spending Monitor"}
              </Button>
            </div>
          </div>
        ) : isEditing ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <Label htmlFor="monitor-toggle" className="font-medium">
                    Spending Monitor
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable or disable monitoring
                  </p>
                </div>
              </div>
              <Switch
                id="monitor-toggle"
                checked={isOptedIn}
                onCheckedChange={handleOptInToggle}
                disabled={registerConsent.isPending}
              />
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">
                  Select Categories to Monitor
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ALL_CATEGORIES.map((category) => (
                    <div
                      key={category}
                      className="flex items-center space-x-3 p-3 rounded-lg border bg-card"
                    >
                      <Checkbox
                        id={`category-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) =>
                          handleCategoryToggle(category, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`category-${category}`}
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                      >
                        <span className="text-lg">
                          {categoryIcons[category]}
                        </span>
                        <span>{category}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCategories.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Set Spending Thresholds (₹)</h4>
                  <div className="space-y-3">
                    {selectedCategories.map((category) => (
                      <div
                        key={category}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <span className="text-lg">
                          {categoryIcons[category]}
                        </span>
                        <Label
                          htmlFor={`threshold-${category}`}
                          className="flex-1 font-medium"
                        >
                          {category}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            ₹
                          </span>
                          <Input
                            id={`threshold-${category}`}
                            type="number"
                            min="0"
                            step="100"
                            placeholder="5000"
                            value={thresholds.get(category) || ""}
                            onChange={(e) =>
                              handleThresholdChange(category, e.target.value)
                            }
                            className="w-32"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveSettings}
                  disabled={
                    setMonitoredCategories.isPending ||
                    setCategoryThreshold.isPending ||
                    selectedCategories.length === 0
                  }
                  className="flex-1"
                >
                  {setMonitoredCategories.isPending ||
                  setCategoryThreshold.isPending
                    ? "Saving..."
                    : "Save Settings"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Monitoring Active</p>
                  <p className="text-xs text-muted-foreground">
                    Tracking {settings?.monitoredCategories.length ?? 0}{" "}
                    {(settings?.monitoredCategories.length ?? 0) === 1
                      ? "category"
                      : "categories"}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">
                {activeAlertCount > 0
                  ? `${activeAlertCount} Alert${activeAlertCount !== 1 ? "s" : ""}`
                  : "All Clear"}
              </Badge>
            </div>

            {alertsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const percentage =
                    alert.threshold > 0
                      ? (alert.spent / alert.threshold) * 100
                      : 0;
                  return (
                    <div
                      key={alert.category}
                      className="p-4 rounded-lg border bg-card space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {categoryIcons[alert.category] ?? "📦"}
                          </span>
                          <span className="font-medium">{alert.category}</span>
                        </div>
                        {getAlertStatusBadge(alert.status)}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {formatCurrency(alert.spent)} of{" "}
                            {formatCurrency(alert.threshold)}
                          </span>
                          <span
                            className={`flex items-center gap-1 font-medium ${getAlertStatusColor(alert.status)}`}
                          >
                            {getAlertIcon(alert.status)}
                            {percentage.toFixed(0)}%
                          </span>
                        </div>

                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${alert.status === "Active" ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>

                        {alert.status === "Active" && (
                          <div className="text-xs p-2 rounded bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                            <AlertTriangle className="inline h-3 w-3 mr-1" />
                            You're approaching your {alert.category} limit.{" "}
                            {formatCurrency(alert.threshold - alert.spent)}{" "}
                            remaining.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
                <p className="text-sm text-muted-foreground">
                  No spending alerts — all categories within limits
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
