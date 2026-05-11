const STEPS = [
  { n: 1, label: "Cards" },
  { n: 2, label: "Your Info" },
  { n: 3, label: "Shipping" },
  { n: 4, label: "Review" },
];

export function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((step, i) => (
        <div key={step.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step.n < currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.n === currentStep
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step.n < currentStep ? "✓" : step.n}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                step.n === currentStep
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px flex-1 mx-2 transition-colors ${
                step.n < currentStep ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
