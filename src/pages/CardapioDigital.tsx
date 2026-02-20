import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardapioConfig } from "@/components/configuracoes/CardapioConfig";
import { GestaoOpcionais } from "@/components/cardapio/GestaoOpcionais";
import { PedidosKanban } from "@/components/pedidos/PedidosKanban";
import { ClipboardList, Settings, ListChecks } from "lucide-react";

const CardapioDigital = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cardápio Digital</h1>
        <p className="text-muted-foreground">Gerencie pedidos, configure seu cardápio e opcionais</p>
      </div>

      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pedidos" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Pedidos</span>
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
          <TabsTrigger value="opcionais" className="gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Opcionais</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <PedidosKanban />
        </TabsContent>

        <TabsContent value="configuracoes">
          <CardapioConfig />
        </TabsContent>

        <TabsContent value="opcionais">
          <GestaoOpcionais />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CardapioDigital;
