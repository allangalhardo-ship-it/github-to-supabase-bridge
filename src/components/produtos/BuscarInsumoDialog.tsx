import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, FlaskConical, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  is_intermediario: boolean;
}

interface BuscarInsumoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (insumo: Insumo) => void;
  insumosExcluidos: string[];
}

const BuscarInsumoDialog: React.FC<BuscarInsumoDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
  insumosExcluidos,
}) => {
  const [busca, setBusca] = useState('');

  const { data: insumos, isLoading } = useQuery({
    queryKey: ['insumos-busca'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome, unidade_medida, custo_unitario, is_intermediario')
        .order('nome');
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: open,
  });

  const insumosFiltrados = useMemo(() => {
    if (!insumos) return [];
    
    return insumos
      .filter(i => !insumosExcluidos.includes(i.id))
      .filter(i => 
        busca === '' || 
        i.nome.toLowerCase().includes(busca.toLowerCase())
      );
  }, [insumos, insumosExcluidos, busca]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSelect = (insumo: Insumo) => {
    onSelect(insumo);
    onOpenChange(false);
    setBusca('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Buscar Insumo
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Digite para buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[50vh]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando insumos...
            </div>
          ) : insumosFiltrados.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum insumo encontrado.</p>
            </div>
          ) : (
            <div className="divide-y">
              {insumosFiltrados.map((insumo) => (
                <button
                  key={insumo.id}
                  onClick={() => handleSelect(insumo)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {insumo.is_intermediario ? (
                      <FlaskConical className="h-4 w-4 text-purple-500" />
                    ) : (
                      <span className="text-xs font-medium text-primary">
                        {insumo.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{insumo.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {insumo.unidade_medida} • {formatCurrency(insumo.custo_unitario)}
                    </p>
                  </div>
                  <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {insumosFiltrados.length} insumo(s) disponível(is)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuscarInsumoDialog;
