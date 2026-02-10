import { CardapioConfig } from "@/components/configuracoes/CardapioConfig";

const CardapioDigital = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cardápio Digital</h1>
        <p className="text-muted-foreground">Configure e gerencie seu cardápio online</p>
      </div>

      <CardapioConfig />
    </div>
  );
};

export default CardapioDigital;
