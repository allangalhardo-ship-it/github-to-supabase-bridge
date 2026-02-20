import { CheckCircle2, ExternalLink, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";

interface OrderSuccessStepProps {
  numeroPedido: number;
  pedidoId: string;
}

export function OrderSuccessStep({ numeroPedido, pedidoId }: OrderSuccessStepProps) {
  const trackingUrl = `${window.location.origin}/pedido/${pedidoId}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30"
      >
        <CheckCircle2 className="h-12 w-12 text-white" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 justify-center mb-2">
          <PartyPopper className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-black text-gray-900">Pedido enviado!</h2>
        </div>
        <p className="text-gray-500 mt-1">
          Seu pedido <span className="font-black text-gray-900">#{numeroPedido}</span> foi recebido
        </p>
        <p className="text-sm text-gray-400 mt-1">Você receberá atualizações pelo WhatsApp</p>
      </motion.div>
      
      <motion.a
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        href={trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-10 inline-flex items-center gap-2.5 bg-gray-900 text-white font-bold px-8 py-4 rounded-2xl hover:bg-gray-800 transition-colors active:scale-[0.98] shadow-lg"
      >
        <ExternalLink className="h-4 w-4" />
        Acompanhar pedido
      </motion.a>
      
      <p className="text-xs text-gray-400 mt-4 max-w-[250px] break-all">{trackingUrl}</p>
    </div>
  );
}
