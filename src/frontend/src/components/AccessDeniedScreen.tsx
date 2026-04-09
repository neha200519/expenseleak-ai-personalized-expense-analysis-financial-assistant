import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function AccessDeniedScreen() {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container max-w-md text-center space-y-6 p-8">
        <div className="flex justify-center">
          <img
            src="/assets/ExpenseLeak_AI_Logo_Transparent.png"
            alt="ExpenseLeak AI"
            className="w-full max-w-[180px] md:max-w-[220px] h-auto object-contain"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-chart-1 bg-clip-text text-transparent">
            ExpenseLeak AI
          </h1>
          <p className="text-xl text-muted-foreground">
            Personalized Expense Analysis & Financial Assistant
          </p>
        </div>
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Authentication Required</h2>
            <p className="text-sm text-muted-foreground">
              Please log in to access your personalized expense tracking and
              AI-powered insights.
            </p>
          </div>
          <Button
            onClick={login}
            disabled={isLoggingIn}
            size="lg"
            className="w-full"
          >
            {isLoggingIn ? "Logging in..." : "Login with Internet Identity"}
          </Button>
        </div>
      </div>
    </div>
  );
}
