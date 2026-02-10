import { CardapioConfig } from "@/components/configuracoes/CardapioConfig";
import { GestaoOpcionais } from "@/components/cardapio/GestaoOpcionais";

const CardapioDigital = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cardápio Digital</h1>
        <p className="text-muted-foreground">Configure e gerencie seu cardápio online</p>
      </div>

      <CardapioConfig />
      <GestaoOpcionais />
    </div>
  );
};

export default CardapioDigital;
