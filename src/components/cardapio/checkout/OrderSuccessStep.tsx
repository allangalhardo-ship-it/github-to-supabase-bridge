import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PedidoCriado } from "./types";

interface OrderSuccessStepProps {
  pedido: PedidoCriado;
  onClose: () => void;
  trackingUrl: string;
}

export function OrderSuccessStep({ pedido, onClose, trackingUrl }: OrderSuccessStepProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido enviado! 🎉</h2>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 w-full max-w-xs">
        <p className="text-sm text-gray-500">Número do pedido</p>
        <p className="text-3xl font-bold text-emerald-600">#{pedido.numero_pedido}</p>
      </div>

      <p className="text-gray-600 text-sm mb-6 max-w-xs">
        Seu pedido foi recebido e está sendo preparado. Você pode acompanhar o status em tempo real.
      </p>

      <div className="space-y-3 w-full max-w-xs">
        <Button
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl gap-2"
          onClick={() => window.open(trackingUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Acompanhar pedido
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl"
          onClick={onClose}
        >
          Fazer novo pedido
        </Button>
      </div>
    </div>
  );
}
