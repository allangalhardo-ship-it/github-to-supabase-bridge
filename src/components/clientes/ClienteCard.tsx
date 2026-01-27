import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Phone, 
  MapPin, 
  Calendar, 
  MoreVertical, 
  Edit, 
  Trash2,
  Link as LinkIcon,
  Copy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Cliente } from '@/hooks/useClientes';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Props {
  cliente: Cliente;
  onEdit: () => void;
  onDelete: () => void;
  onWhatsApp: (mensagem: string) => void;
  onCopyLink: () => void;
}

export function ClienteCard({ cliente, onEdit, onDelete, onWhatsApp, onCopyLink }: Props) {
  const { toast } = useToast();

  const temEndereco = cliente.endereco_rua || cliente.endereco_bairro || cliente.endereco_cidade;
  
  // Verificar se aniversário está próximo (7 dias)
  const aniversarioProximo = () => {
    if (!cliente.data_nascimento) return false;
    const hoje = new Date();
    const nascimento = parseISO(cliente.data_nascimento);
    const aniversarioEsteAno = new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate());
    const diff = differenceInDays(aniversarioEsteAno, hoje);
    return diff >= 0 && diff <= 7;
  };

  const formatarEndereco = () => {
    const partes = [];
    if (cliente.endereco_rua) {
      partes.push(`${cliente.endereco_rua}${cliente.endereco_numero ? `, ${cliente.endereco_numero}` : ''}`);
    }
    if (cliente.endereco_bairro) partes.push(cliente.endereco_bairro);
    if (cliente.endereco_cidade) {
      partes.push(`${cliente.endereco_cidade}${cliente.endereco_estado ? `/${cliente.endereco_estado}` : ''}`);
    }
    return partes.join(' - ');
  };

  const enviarMensagemPadrao = () => {
    onWhatsApp(`Olá ${cliente.nome}! 👋`);
  };

  const enviarLinkPedido = () => {
    onWhatsApp(`Olá ${cliente.nome}! 🛒\n\nAcesse o link abaixo para fazer seu pedido:\n[LINK_PEDIDO]`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">{cliente.nome}</h3>
              {aniversarioProximo() && (
                <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                  🎂 Aniversário próximo
                </Badge>
              )}
            </div>
            
            {cliente.whatsapp && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Phone className="h-3 w-3" />
                <span>{cliente.whatsapp}</span>
              </div>
            )}

            {temEndereco && (
              <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-1">{formatarEndereco()}</span>
              </div>
            )}

            {cliente.data_nascimento && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>{format(parseISO(cliente.data_nascimento), "dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
            )}

            {cliente.preferencias && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                "{cliente.preferencias}"
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {cliente.whatsapp && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={enviarMensagemPadrao}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {cliente.whatsapp && (
                  <>
                    <DropdownMenuItem onClick={enviarMensagemPadrao}>
                      <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                      Enviar mensagem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={enviarLinkPedido}>
                      <LinkIcon className="h-4 w-4 mr-2 text-blue-600" />
                      Enviar link de pedido
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={onCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link de pedido
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
