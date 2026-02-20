import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardapioConfig } from "@/components/configuracoes/CardapioConfig";
import { GestaoOpcionais } from "@/components/cardapio/GestaoOpcionais";
import { EntregaConfig } from "@/components/configuracoes/EntregaConfig";
import { Settings, ListChecks, Truck } from "lucide-react";

const CardapioDigital = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cardápio Digital</h1>
        <p className="text-muted-foreground">Configure seu cardápio online, entregas e opcionais</p>
      </div>

      <Tabs defaultValue="configuracoes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
          <TabsTrigger value="entrega" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Entrega</span>
          </TabsTrigger>
          <TabsTrigger value="opcionais" className="gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Opcionais</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuracoes">
          <CardapioConfig />
        </TabsContent>

        <TabsContent value="entrega">
          <EntregaConfig />
        </TabsContent>

        <TabsContent value="opcionais">
          <GestaoOpcionais />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CardapioDigital;
