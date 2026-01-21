import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileDataView, Column } from "@/components/ui/mobile-data-view";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Plus, Trash2, ChefHat, FlaskConical, Pencil } from "lucide-react";
import { Receita, formatCurrency } from "./types";

interface ReceitasListProps {
  receitas: Receita[] | undefined;
  isLoading: boolean;
  onNewReceita: () => void;
  onEditReceita: (receita: Receita) => void;
  onOpenIngredientes: (receita: Receita) => void;
  onDeleteReceita: (id: string) => void;
  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (open: boolean) => void;
  confirmDelete: () => void;
}

export function ReceitasList({
  receitas,
  isLoading,
  onNewReceita,
  onEditReceita,
  onOpenIngredientes,
  onDeleteReceita,
  deleteConfirmOpen,
  setDeleteConfirmOpen,
  confirmDelete,
}: ReceitasListProps) {
  const receitaColumns: Column<Receita>[] = useMemo(() => [
    {
      key: 'nome',
      header: 'Nome',
      mobilePriority: 1,
      render: (receita) => (
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden max-w-full">
          <span className="shrink-0">
            <ChefHat className="h-4 w-4 text-primary" />
          </span>
          <span className="font-medium truncate flex-1 min-w-0">{receita.nome}</span>
        </div>
      ),
    },
    {
      key: 'unidade',
      header: 'Und. Rend.',
      align: 'center',
      mobilePriority: 3,
      render: (receita) => receita.unidade_medida,
    },
    {
      key: 'rendimento',
      header: 'Quanto Rende',
      align: 'center',
      mobilePriority: 4,
      render: (receita) => receita.rendimento_receita ? `${receita.rendimento_receita} ${receita.unidade_medida}` : '-',
    },
    {
      key: 'custo',
      header: 'Custo Unit.',
      align: 'right',
      mobilePriority: 2,
      render: (receita) => formatCurrency(Number(receita.custo_unitario)),
    },
  ], []);

  const renderReceitaActions = (receita: Receita) => (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:text-primary/80"
        onClick={() => onOpenIngredientes(receita)}
        title="Ver/Editar ingredientes"
      >
        <FlaskConical className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onEditReceita(receita)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={() => onDeleteReceita(receita.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (receitas && receitas.length > 0) {
    return (
      <>
        <MobileDataView
          data={receitas}
          columns={receitaColumns}
          keyExtractor={(receita) => receita.id}
          renderActions={renderReceitaActions}
          renderMobileHeader={(receita) => (
            <div className="flex items-start gap-2 min-w-0">
              <span className="shrink-0 mt-0.5">
                <ChefHat className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0 whitespace-normal break-words leading-snug">
                {receita.nome}
              </span>
            </div>
          )}
          renderMobileSubtitle={(receita) => (
            <div className="flex items-center gap-2 flex-wrap">
              <span>{receita.unidade_medida}</span>
              {receita.rendimento_receita && (
                <Badge variant="outline" className="text-xs">
                  Rende: {receita.rendimento_receita} {receita.unidade_medida}
                </Badge>
              )}
            </div>
          )}
          renderMobileHighlight={(receita) => (
            <div className="text-right">
              <p className="font-bold text-foreground">{formatCurrency(Number(receita.custo_unitario))}</p>
              <p className="text-xs text-muted-foreground">por {receita.unidade_medida}</p>
            </div>
          )}
          emptyMessage="Nenhuma receita cadastrada"
          emptyAction={
            <Button onClick={onNewReceita}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Receita
            </Button>
          }
        />
        <DeleteConfirmationDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          onConfirm={confirmDelete}
          title="Excluir receita"
          description="Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita."
        />
      </>
    );
  }

  return (
    <Card className="p-12 text-center">
      <ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">Nenhuma receita cadastrada</h3>
      <p className="text-muted-foreground mb-4">
        Receitas são preparações base (ex: ganache, recheio) que podem ser usadas como ingrediente em produtos.
      </p>
      <Button onClick={onNewReceita}>
        <Plus className="mr-2 h-4 w-4" />
        Nova Receita
      </Button>
    </Card>
  );
}
