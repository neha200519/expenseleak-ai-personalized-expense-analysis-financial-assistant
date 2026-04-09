import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Delete, PlusCircle } from "lucide-react";
import { useState } from "react";
import PageTransition from "../components/PageTransition";

export default function CalculatorPage() {
  const navigate = useNavigate();
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const handleNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(`${display}.`);
    }
  };

  const handleOperation = (nextOperation: string) => {
    const inputValue = Number.parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = performCalculation(currentValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const performCalculation = (
    firstValue: number,
    secondValue: number,
    op: string,
  ): number => {
    switch (op) {
      case "+":
        return firstValue + secondValue;
      case "-":
        return firstValue - secondValue;
      case "×":
        return firstValue * secondValue;
      case "÷":
        return secondValue !== 0 ? firstValue / secondValue : 0;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = Number.parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = performCalculation(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    if (!waitingForOperand && display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    const key = e.key;

    if (key >= "0" && key <= "9") {
      handleNumber(key);
    } else if (key === ".") {
      handleDecimal();
    } else if (key === "+" || key === "-") {
      handleOperation(key);
    } else if (key === "*") {
      handleOperation("×");
    } else if (key === "/") {
      e.preventDefault();
      handleOperation("÷");
    } else if (key === "Enter" || key === "=") {
      e.preventDefault();
      handleEquals();
    } else if (key === "Escape" || key === "c" || key === "C") {
      handleClear();
    } else if (key === "Backspace") {
      handleBackspace();
    }
  };

  return (
    <PageTransition>
      <div className="container py-8 max-w-2xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <img
                src="/assets/generated/calculator-icon-transparent.dim_64x64.png"
                alt="Calculator"
                className="h-8 w-8"
              />
              Calculator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="calculator-container" onKeyDown={handleKeyPress}>
              {/* Display */}
              <div className="mb-4 p-6 bg-muted rounded-lg text-right">
                <div className="text-sm text-muted-foreground mb-1 h-5">
                  {previousValue !== null && operation
                    ? `${previousValue} ${operation}`
                    : ""}
                </div>
                <div className="text-4xl font-bold text-foreground break-all">
                  {display}
                </div>
              </div>

              {/* Calculator Buttons */}
              <div className="grid grid-cols-4 gap-3">
                {/* Row 1 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleClear}
                  className="text-lg font-semibold h-16 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  AC
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleBackspace}
                  className="text-lg font-semibold h-16"
                >
                  <Delete className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleOperation("÷")}
                  className="text-lg font-semibold h-16 bg-primary/10 hover:bg-primary/20"
                >
                  ÷
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleOperation("×")}
                  className="text-lg font-semibold h-16 bg-primary/10 hover:bg-primary/20"
                >
                  ×
                </Button>

                {/* Row 2 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("7")}
                  className="text-lg font-semibold h-16"
                >
                  7
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("8")}
                  className="text-lg font-semibold h-16"
                >
                  8
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("9")}
                  className="text-lg font-semibold h-16"
                >
                  9
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleOperation("-")}
                  className="text-lg font-semibold h-16 bg-primary/10 hover:bg-primary/20"
                >
                  -
                </Button>

                {/* Row 3 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("4")}
                  className="text-lg font-semibold h-16"
                >
                  4
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("5")}
                  className="text-lg font-semibold h-16"
                >
                  5
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("6")}
                  className="text-lg font-semibold h-16"
                >
                  6
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleOperation("+")}
                  className="text-lg font-semibold h-16 bg-primary/10 hover:bg-primary/20"
                >
                  +
                </Button>

                {/* Row 4 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("1")}
                  className="text-lg font-semibold h-16"
                >
                  1
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("2")}
                  className="text-lg font-semibold h-16"
                >
                  2
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("3")}
                  className="text-lg font-semibold h-16"
                >
                  3
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleEquals}
                  className="text-lg font-semibold h-16 row-span-2 bg-primary hover:bg-primary/90"
                >
                  =
                </Button>

                {/* Row 5 */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumber("0")}
                  className="text-lg font-semibold h-16 col-span-2"
                >
                  0
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDecimal}
                  className="text-lg font-semibold h-16"
                >
                  .
                </Button>
              </div>

              <div className="mt-4 text-sm text-muted-foreground text-center">
                Keyboard shortcuts: Numbers, +, -, *, /, Enter (=), Esc (Clear),
                Backspace
              </div>

              {/* Add as Expense button — visible when display has valid non-zero number */}
              {display !== "0" &&
                display !== "Error" &&
                !Number.isNaN(Number(display)) &&
                Number(display) > 0 && (
                  <Button
                    type="button"
                    className="mt-4 w-full h-12 text-sm font-semibold gap-2"
                    style={{
                      background: "var(--primary)",
                      color: "var(--text-on-primary)",
                    }}
                    onClick={() => {
                      // Navigate directly with amount in query string
                      window.location.href = `/add-expense?amount=${encodeURIComponent(display)}`;
                    }}
                    data-ocid="calculator.add_expense_button"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add ₹{display} as Expense
                  </Button>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
