import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, FileText, Filter, DollarSign, Package, ExternalLink } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface XmlNota {
  id: string;
  numero: string | null;
  fornecedor: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  created_at: string;
}

const ComprasTab = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filtroDataInicio, setFiltroDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroDataFim, setFiltroDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [notaToDelete, setNotaToDelete] = useState<string | null>(null);

  const { data: notas, isLoading } = useQuery({
    queryKey: ['xml-notas', usuario?.empresa_id, filtroDataInicio, filtroDataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xml_notas')
        .select('*')
        .gte('data_emissao', filtroDataInicio)
        .lte('data_emissao', filtroDataFim)
        .order('data_emissao', { ascending: false });

      if (error) throw error;
      return data as XmlNota[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xml_notas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xml-notas'] });
      queryClient.invalidateQueries({ queryKey: ['caixa'] });
      toast({ title: 'Nota excluída!' });
      setDeleteConfirmOpen(false);
      setNotaToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalCompras = notas?.reduce((acc, n) => acc + (n.valor_total || 0), 0) || 0;
  const qtdNotas = notas?.length || 0;

  return (
    <div className="space-y-4">
      {/* Link para importar */}
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/xml-import">
            <ExternalLink className="mr-2 h-4 w-4" />
            Importar Nota Fiscal
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:pt-4 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 dark:bg-red-900/30 shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Compras</p>
                <p className="text-base sm:text-xl font-bold text-red-600 truncate">{formatCurrency(totalCompras)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:pt-4 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Qtd. Notas</p>
                <p className="text-base sm:text-xl font-bold">{qtdNotas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : notas && notas.length > 0 ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[400px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Data</TableHead>
                  <TableHead className="w-[80px]">Número</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right w-[100px]">Valor</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {nota.data_emissao 
                        ? format(new Date(nota.data_emissao), 'dd/MM/yy', { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{nota.numero || '-'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[120px] truncate">
                      {nota.fornecedor || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600 whitespace-nowrap text-sm">
                      {formatCurrency(nota.valor_total)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setNotaToDelete(nota.id);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma compra encontrada</h3>
          <p className="text-muted-foreground mb-4">
            Importe notas fiscais para registrar suas compras.
          </p>
          <Button asChild>
            <Link to="/xml-import">
              <ExternalLink className="mr-2 h-4 w-4" />
              Importar Nota Fiscal
            </Link>
          </Button>
        </Card>
      )}

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => notaToDelete && deleteMutation.mutate(notaToDelete)}
        title="Excluir nota fiscal"
        description="Tem certeza que deseja excluir esta nota? Os movimentos de estoque relacionados NÃO serão revertidos."
      />
    </div>
  );
};

export default ComprasTab;
