import { Empresa } from "./types";
import { Clock, MapPin, Share2, Star, Bike } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CardapioHeaderProps {
  empresa: Empresa;
}

function parseHorario(horario: string | null): { aberto: boolean; texto: string } {
  if (!horario) return { aberto: true, texto: "" };
  const now = new Date();
  const diaSemana = now.getDay();
  const horaAtual = now.getHours();
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const diaAtual = dias[diaSemana];
  const partes = horario.split("|").map(p => p.trim().toLowerCase());
  for (const parte of partes) {
    if (parte.includes(diaAtual) || parte.includes("seg-sex") && diaSemana >= 1 && diaSemana <= 5) {
      const match = parte.match(/(\d{1,2})h?\s*(?:às|a|-)\s*(\d{1,2})h?/);
      if (match) {
        const abertura = parseInt(match[1]);
        const fechamento = parseInt(match[2]);
        const aberto = horaAtual >= abertura && horaAtual < fechamento;
        return { aberto, texto: horario };
      }
    }
  }
  return { aberto: true, texto: horario };
}

export function CardapioHeader({ empresa }: CardapioHeaderProps) {
  const { aberto, texto } = parseHorario(empresa.horario_funcionamento);

  const compartilhar = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: empresa.nome, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  return (
    <header className="relative">
      {/* Banner with overlay */}
      <div className="h-44 sm:h-56 relative overflow-hidden">
        {empresa.banner_url ? (
          <img src={empresa.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-500 via-red-600 to-rose-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        
        {/* Share button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={compartilhar}
          className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors border border-white/10"
        >
          <Share2 className="h-4 w-4" />
        </motion.button>

        {/* Status badge on banner */}
        <div className="absolute top-4 left-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-md border ${
            aberto 
              ? "bg-emerald-500/90 text-white border-emerald-400/30" 
              : "bg-red-500/90 text-white border-red-400/30"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${aberto ? "bg-white" : "bg-red-200"}`} />
            {aberto ? "Aberto agora" : "Fechado"}
          </span>
        </div>
      </div>

      {/* Info card overlapping banner */}
      <div className="max-w-2xl mx-auto px-4 -mt-20 relative z-10">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-xl shadow-black/8 p-5 border border-gray-100/80"
        >
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-18 h-18 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0 border-2 border-white shadow-lg ring-1 ring-gray-100" style={{ width: '72px', height: '72px' }}>
              {empresa.logo_url ? (
                <img src={empresa.logo_url} alt={empresa.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-2xl font-black text-white">
                  {empresa.nome.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-gray-900 truncate tracking-tight">{empresa.nome}</h1>
              {empresa.cardapio_descricao && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{empresa.cardapio_descricao}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {texto && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {texto}
                  </span>
                )}

                {empresa.entrega_ativa && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                    <Bike className="h-3 w-3 text-gray-400" />
                    {empresa.tempo_estimado_entrega || "30-50 min"}
                  </span>
                )}

                {empresa.pedido_minimo > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                    Min. R$ {empresa.pedido_minimo.toFixed(0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </header>
  );
}
