import { CheckCircle2, ExternalLink } from "lucide-react";

interface OrderSuccessStepProps {
  numeroPedido: number;
  pedidoId: string;
}

export function OrderSuccessStep({ numeroPedido, pedidoId }: OrderSuccessStepProps) {
  const trackingUrl = `${window.location.origin}/pedido/${pedidoId}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Pedido enviado!</h2>
      <p className="text-gray-500 mt-2">Seu pedido <span className="font-bold text-emerald-700">#{numeroPedido}</span> foi recebido</p>
      <p className="text-sm text-gray-400 mt-1">Você receberá atualizações pelo WhatsApp</p>
      
      <a
        href={trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        Acompanhar pedido
      </a>
      
      <p className="text-xs text-gray-400 mt-4">Ou acesse: {trackingUrl}</p>
    </div>
  );
}
