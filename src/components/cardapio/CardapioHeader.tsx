import { Clock, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empresa } from "./types";

interface CardapioHeaderProps {
  empresa: Empresa;
}

// Helper para verificar se está aberto baseado no horário
function verificarAberto(horario: string | null): boolean {
  if (!horario) return true; // Se não tem horário, assume aberto
  
  // Lógica simplificada - em produção seria mais complexa
  const agora = new Date();
  const hora = agora.getHours();
  
  // Exemplo: se contém "9h às 18h", considera aberto entre 9h e 18h
  const match = horario.match(/(\d{1,2})h?\s*(?:às|a|-)\s*(\d{1,2})h?/i);
  if (match) {
    const inicio = parseInt(match[1]);
    const fim = parseInt(match[2]);
    return hora >= inicio && hora < fim;
  }
  
  return true;
}

export function CardapioHeader({ empresa }: CardapioHeaderProps) {
  const estaAberto = verificarAberto(empresa.horario_funcionamento);
  const hasBanner = !!empresa.banner_url;
  const hasLogo = !!empresa.logo_url;

  return (
    <header className="relative">
      {/* Banner Hero */}
      <div className="relative h-[200px] md:h-[280px] bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 overflow-hidden">
        {/* Imagem de banner se existir */}
        {hasBanner ? (
          <img 
            src={empresa.banner_url!} 
            alt={`Banner ${empresa.nome}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Pattern overlay para dar textura quando não tem banner */
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        )}
        
        {/* Gradient overlay escuro */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
        
        {/* Conteúdo do header */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6 max-w-4xl mx-auto">
          {/* Badge de status */}
          <div className="mb-3">
            {estaAberto ? (
              <Badge className="bg-emerald-500 text-white border-0 px-3 py-1 text-xs font-semibold">
                <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                Aberto agora
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-red-500/90 text-white border-0 px-3 py-1 text-xs font-semibold">
                <span className="w-2 h-2 bg-white/60 rounded-full mr-2" />
                Fechado
              </Badge>
            )}
          </div>
          
          {/* Logo + Nome */}
          <div className="flex items-center gap-3 mb-2">
            {hasLogo && (
              <img 
                src={empresa.logo_url!}
                alt={`Logo ${empresa.nome}`}
                className="w-12 h-12 md:w-16 md:h-16 rounded-xl object-cover border-2 border-white/30 shadow-lg"
              />
            )}
            <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
              {empresa.nome}
            </h1>
          </div>
          
          {/* Descrição */}
          {empresa.cardapio_descricao && (
            <p className="text-white/90 text-sm md:text-base mb-3 max-w-lg line-clamp-2">
              {empresa.cardapio_descricao}
            </p>
          )}
          
          {/* Info row */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-white/90 text-xs md:text-sm">
            {empresa.horario_funcionamento && (
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
                <Clock className="h-3.5 w-3.5" />
                {empresa.horario_funcionamento}
              </span>
            )}
            {empresa.whatsapp_dono && (
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
                <Phone className="h-3.5 w-3.5" />
                {empresa.whatsapp_dono}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
