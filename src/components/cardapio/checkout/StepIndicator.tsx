import { CheckoutStep } from "./types";
import { ShoppingBag, User, MapPin, CreditCard, Check } from "lucide-react";

const steps: { key: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { key: "carrinho", label: "Sacola", icon: ShoppingBag },
  { key: "identificacao", label: "Dados", icon: User },
  { key: "entrega", label: "Entrega", icon: MapPin },
  { key: "pagamento", label: "Pagar", icon: CreditCard },
  { key: "confirmacao", label: "Confirmar", icon: Check },
];

interface StepIndicatorProps {
  currentStep: CheckoutStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-between px-1 py-4">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30"
                  : isDone
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${
                isActive ? "text-red-600" : isDone ? "text-emerald-600" : "text-gray-400"
              }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 mx-0.5 rounded-full transition-colors ${
                isDone ? "bg-emerald-400" : "bg-gray-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
