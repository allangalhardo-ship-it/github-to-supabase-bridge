import { PedidosKanban } from "@/components/pedidos/PedidosKanban";
import { ClipboardList } from "lucide-react";

const Pedidos = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          Pedidos
        </h1>
        <p className="text-muted-foreground">Gerencie todos os pedidos recebidos em tempo real</p>
      </div>

      <PedidosKanban />
    </div>
  );
};

export default Pedidos;
