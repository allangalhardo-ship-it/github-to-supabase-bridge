import { Empresa } from "./types";
import { Clock, MapPin, Share2 } from "lucide-react";
import { toast } from "sonner";

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
      try {
        await navigator.share({ title: empresa.nome, url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  return (
    <header className="relative">
      {/* Banner */}
      <div className="h-40 sm:h-52 bg-gradient-to-br from-emerald-600 to-emerald-800 relative overflow-hidden">
        {empresa.banner_url ? (
          <img src={empresa.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Share button */}
        <button
          onClick={compartilhar}
          className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {/* Info card overlapping banner */}
      <div className="max-w-2xl mx-auto px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-emerald-50 flex-shrink-0 border-2 border-white shadow">
              {empresa.logo_url ? (
                <img src={empresa.logo_url} alt={empresa.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-emerald-600">
                  {empresa.nome.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{empresa.nome}</h1>
              {empresa.cardapio_descricao && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{empresa.cardapio_descricao}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {/* Status */}
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  aberto 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "bg-red-50 text-red-700"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${aberto ? "bg-emerald-500" : "bg-red-500"}`} />
                  {aberto ? "Aberto agora" : "Fechado"}
                </span>
                
                {texto && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {texto}
                  </span>
                )}

                {empresa.entrega_ativa && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="h-3 w-3" />
                    {empresa.tempo_estimado_entrega || "30-50 min"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
