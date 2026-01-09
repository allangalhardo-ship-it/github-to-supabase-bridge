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
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total em Compras</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalCompras)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Qtd. Notas</p>
                <p className="text-xl font-bold">{qtdNotas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : notas && notas.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="text-muted-foreground">
                      {nota.data_emissao 
                        ? format(new Date(nota.data_emissao), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{nota.numero || '-'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {nota.fornecedor || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
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
