import { CheckoutStep } from "./types";
import { ShoppingCart, User, MapPin, CreditCard, Check } from "lucide-react";

const steps: { key: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { key: "carrinho", label: "Carrinho", icon: ShoppingCart },
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
    <div className="flex items-center justify-between px-2 py-3">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
              isActive
                ? "bg-emerald-600 text-white scale-110"
                : isDone
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-400"
            }`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className={`text-[10px] font-medium hidden sm:block ${
              isActive ? "text-emerald-700" : isDone ? "text-emerald-600" : "text-gray-400"
            }`}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-4 sm:w-8 h-0.5 mx-1 rounded ${
                isDone ? "bg-emerald-300" : "bg-gray-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
