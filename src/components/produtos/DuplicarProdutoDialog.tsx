import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Copy, Loader2 } from 'lucide-react';

interface FichaTecnicaItem {
  id: string;
  quantidade: number;
  insumos: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
  };
}

interface DuplicarProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: {
    id: string;
    nome: string;
    categoria: string | null;
    preco_venda: number;
    ativo: boolean;
    rendimento_padrao?: number | null;
    imagem_url?: string | null;
    observacoes_ficha?: string | null;
    fichas_tecnicas?: FichaTecnicaItem[];
  };
  onSuccess?: (novoProdutoId: string) => void;
}

const DuplicarProdutoDialog: React.FC<DuplicarProdutoDialogProps> = ({
  open,
  onOpenChange,
  produto,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (open) {
      setNovoNome(`${produto.nome} (Cópia)`);
    }
  }, [open, produto.nome]);

  const handleDuplicate = async () => {
    if (!novoNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para o novo produto.',
        variant: 'destructive',
      });
      return;
    }

    setDuplicating(true);

    try {
      // Get user's empresa_id
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .single();

      if (userError) throw userError;

      // Create new product
      const { data: novoProduto, error: produtoError } = await supabase
        .from('produtos')
        .insert({
          empresa_id: userData.empresa_id,
          nome: novoNome.trim(),
          categoria: produto.categoria,
          preco_venda: produto.preco_venda,
          ativo: produto.ativo,
          rendimento_padrao: produto.rendimento_padrao,
          imagem_url: produto.imagem_url,
          observacoes_ficha: produto.observacoes_ficha,
        })
        .select()
        .single();

      if (produtoError) throw produtoError;

      // Copy ficha técnica items
      if (produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0) {
        const fichasParaInserir = produto.fichas_tecnicas.map((ft) => ({
          produto_id: novoProduto.id,
          insumo_id: ft.insumos.id,
          quantidade: ft.quantidade,
        }));

        const { error: fichaError } = await supabase
          .from('fichas_tecnicas')
          .insert(fichasParaInserir);

        if (fichaError) throw fichaError;
      }

      queryClient.invalidateQueries({ queryKey: ['produtos'] });

      toast({
        title: 'Produto duplicado!',
        description: `"${novoNome}" foi criado com sucesso.`,
      });

      onOpenChange(false);
      
      // Callback to open ficha técnica for the new product
      if (onSuccess) {
        onSuccess(novoProduto.id);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Produto
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Uma cópia de "{produto.nome}" será criada com todos os ingredientes da ficha técnica.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <div className="space-y-2">
            <Label htmlFor="novo-nome">Nome do novo produto</Label>
            <Input
              id="novo-nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Digite o nome..."
              autoFocus
            />
          </div>

          {produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0 && (
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <p className="text-muted-foreground mb-1">Será copiado:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• {produto.fichas_tecnicas.length} ingrediente(s) da ficha técnica</li>
                {produto.rendimento_padrao && (
                  <li>• Rendimento: {produto.rendimento_padrao} unidades</li>
                )}
                {produto.observacoes_ficha && (
                  <li>• Observações/modo de preparo</li>
                )}
              </ul>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Após criar, a ficha técnica será aberta para você fazer os ajustes necessários.
          </p>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={duplicating}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={duplicating || !novoNome.trim()}>
            {duplicating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar e Editar Ficha
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

export default DuplicarProdutoDialog;
