import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput, PercentInput } from '@/components/ui/currency-input';
import { AlertTriangle } from 'lucide-react';
import { useCanaisVenda, CanalComTaxaTotal } from '@/hooks/useCanaisVenda';
import { separarTaxasCanal, taxaEfetivaAcimaDaPrevista } from '@/lib/taxaCanalUtils';
import { fmtNum } from '@/lib/format';
import { toLocalDateString } from '@/lib/dateUtils';

const CanalTaxasForm: React.FC<{ canal: CanalComTaxaTotal }> = ({ canal }) => {
  const { salvarTaxasCanal, isSalvandoTaxas } = useCanaisVenda();
  const atual = separarTaxasCanal(canal.taxas || []);
  const [comissao, setComissao] = useState(atual.comissao);
  const [online, setOnline] = useState(atual.online);
  const [mensalidade, setMensalidade] = useState(Number(canal.mensalidade || 0));
  const [prazo, setPrazo] = useState(String(canal.prazo_repasse_dias ?? 0));

  useEffect(() => {
    const a = separarTaxasCanal(canal.taxas || []);
    setComissao(a.comissao); setOnline(a.online);
    setMensalidade(Number(canal.mensalidade || 0)); setPrazo(String(canal.prazo_repasse_dias ?? 0));
  }, [canal]);

  // Aviso: taxa efetiva real dos últimos 30 dias x prevista
  const { data: aviso } = useQuery({
    queryKey: ['canal-taxa-efetiva', canal.id],
    queryFn: async () => {
      const ini = new Date(); ini.setDate(ini.getDate() - 30);
      const { data } = await supabase.from('vendas_pedidos' as any)
        .select('valor_bruto, taxa_entrega, taxa_prevista, taxa_real')
        .eq('canal_id', canal.id).gte('data_venda', toLocalDateString(ini)).not('taxa_real', 'is', null);
      return taxaEfetivaAcimaDaPrevista((data || []) as any[], Number(canal.mensalidade || 0));
    },
    enabled: canal.tipo === 'app_delivery',
  });

  return (
    <div className="border-t p-3 bg-muted/30 space-y-3">
      {aviso?.alerta && (
        <div className="flex gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Nos últimos 30 dias a taxa real ficou em {fmtNum(aviso.real, 1)}%, acima da prevista ({fmtNum(aviso.prevista, 1)}%). Vale revisar as taxas cadastradas.</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Comissão (%)</Label>
          <PercentInput value={comissao} onChange={setComissao} />
          <p className="text-xs text-muted-foreground">O quanto a plataforma fica de cada pedido.</p>
        </div>
        <div className="space-y-1">
          <Label>Taxa de pagamento online (%)</Label>
          <PercentInput value={online} onChange={setOnline} />
          <p className="text-xs text-muted-foreground">Cobrada só quando o cliente paga pelo app. Pago na entrega não tem essa taxa.</p>
        </div>
        <div className="space-y-1">
          <Label>Mensalidade fixa (R$ por mês)</Label>
          <CurrencyInput value={mensalidade} onChange={setMensalidade} />
          <p className="text-xs text-muted-foreground">Valor fixo do plano, cobrado uma vez em cada mês que você vendeu no canal.</p>
        </div>
        <div className="space-y-1">
          <Label>Prazo de repasse (dias)</Label>
          <Input type="number" min={0} step={1} value={prazo} onChange={e => setPrazo(e.target.value)} />
          <p className="text-xs text-muted-foreground">Quantos dias a plataforma leva para pagar você. 0 = no mesmo dia. Vale para as vendas novas.</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Usado no preço: {fmtNum(comissao + online, 1)}%</span>
        <Button size="sm" disabled={isSalvandoTaxas}
          onClick={() => salvarTaxasCanal({ canal_id: canal.id, comissao, online, mensalidade, prazo: Number(prazo) || 0 })}>
          Salvar taxas
        </Button>
      </div>
    </div>
  );
};

export default CanalTaxasForm;
