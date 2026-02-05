import { Clock, Phone } from "lucide-react";
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
      {/* Banner Hero - Premium Gradient */}
      <div className="relative h-[220px] md:h-[300px] overflow-hidden">
        {/* Background: gradiente suave rosa para bege ou imagem */}
        {hasBanner ? (
          <>
            <img 
              src={empresa.banner_url!} 
              alt={`Banner ${empresa.nome}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Overlay claro para legibilidade */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent" />
          </>
        ) : (
          <>
            {/* Gradiente premium rosa/bege */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, #fff5f5 0%, #fef3e2 50%, #fff8f0 100%)'
              }}
            />
            {/* Pattern sutil de textura */}
            <div 
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23d4a574' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              }}
            />
            {/* Overlay de transição suave para a área de conteúdo */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
          </>
        )}
        
        {/* Conteúdo do header */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-8 max-w-4xl mx-auto">
          {/* Badge de status */}
          <div className="mb-4">
            {estaAberto ? (
              <Badge className="bg-emerald-500 text-white border-0 px-4 py-1.5 text-xs font-semibold shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                Aberto agora
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-rose-500/90 text-white border-0 px-4 py-1.5 text-xs font-semibold shadow-lg">
                <span className="w-2 h-2 bg-white/60 rounded-full mr-2" />
                Fechado
              </Badge>
            )}
          </div>
          
          {/* Logo + Nome */}
          <div className="flex items-center gap-4 mb-3">
            {hasLogo && (
              <img 
                src={empresa.logo_url!}
                alt={`Logo ${empresa.nome}`}
                className="w-14 h-14 md:w-20 md:h-20 rounded-2xl object-cover border-4 border-white shadow-xl"
              />
            )}
            <div>
              <h1 
                className="text-2xl md:text-4xl font-bold text-gray-800 drop-shadow-sm"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {empresa.nome}
              </h1>
            </div>
          </div>
          
          {/* Descrição */}
          {empresa.cardapio_descricao && (
            <p className="text-gray-600 text-sm md:text-base mb-4 max-w-lg line-clamp-2">
              {empresa.cardapio_descricao}
            </p>
          )}
          
          {/* Info row */}
          <div className="flex flex-wrap items-center gap-3 text-gray-600 text-xs md:text-sm">
            {empresa.horario_funcionamento && (
              <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm border border-gray-100">
                <Clock className="h-3.5 w-3.5 text-rose-400" />
                {empresa.horario_funcionamento}
              </span>
            )}
            {empresa.whatsapp_dono && (
              <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm border border-gray-100">
                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                {empresa.whatsapp_dono}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
