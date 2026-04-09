import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSaveCallerUserProfile } from "../hooks/useQueries";

interface ProfileSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileSetupModal({
  open,
  onClose,
}: ProfileSetupModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("30000");
  const saveProfile = useSaveCallerUserProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    const budget = Number.parseFloat(monthlyBudget) || 0;

    try {
      await saveProfile.mutateAsync({
        name: name.trim(),
        email: email.trim() || "",
        currency: "INR",
        monthlyBudget: budget,
      });
      toast.success("Profile created successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to create profile");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-3">
            <img
              src="/assets/ExpenseLeak_AI_Logo_Transparent.png"
              alt="ExpenseLeak AI"
              className="h-14 w-14 object-contain"
            />
          </div>
          <DialogTitle className="text-center">
            Welcome to ExpenseLeak AI!
          </DialogTitle>
          <DialogDescription className="text-center">
            Set up your profile to start tracking expenses and get personalized
            AI-powered financial insights.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name *</Label>
            <Input
              id="profile-name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              data-ocid="profile_setup.name_input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email (optional)</Label>
            <Input
              id="profile-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-ocid="profile_setup.email_input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-budget">Monthly Budget (₹)</Label>
            <Input
              id="profile-budget"
              type="number"
              min="0"
              step="500"
              placeholder="e.g. 30000"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              data-ocid="profile_setup.budget_input"
            />
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Your target monthly spending limit in Indian Rupees
            </p>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Input
              value="Indian Rupee (₹ INR)"
              disabled
              style={{ background: "var(--bg-muted)", opacity: 0.7 }}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              All amounts will be displayed in Indian Rupees (₹)
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={saveProfile.isPending}
            data-ocid="profile_setup.submit_button"
          >
            {saveProfile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Profile...
              </>
            ) : (
              "Get Started →"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
