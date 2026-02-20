import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckoutStep } from "./types";

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: 'carrinho', label: 'Carrinho' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'pagamento', label: 'Pagamento' },
  { key: 'confirmacao', label: 'Confirmar' },
];

interface StepIndicatorProps {
  currentStep: CheckoutStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-between px-2">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  isCompleted && "bg-emerald-500 text-white",
                  isCurrent && "bg-emerald-500 text-white ring-4 ring-emerald-100",
                  !isCompleted && !isCurrent && "bg-gray-200 text-gray-500"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  isCurrent ? "text-emerald-700" : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 mt-[-14px]",
                  index < currentIndex ? "bg-emerald-400" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
