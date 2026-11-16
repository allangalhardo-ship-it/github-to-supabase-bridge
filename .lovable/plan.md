# Etapa 6B — Importação por planilha, taxa prevista x real e a receber

Será feita em 3 entregas, nesta ordem, com verificação no fim de cada uma: V5 (base de taxas) → V4B (planilha) → V6 (a receber). A importação por foto não muda.

## V5 — Taxa prevista x taxa real
- **Cadastro do canal**: três campos com uma frase cada — Comissão (%), Taxa de pagamento online (%), Mensalidade fixa (R$/mês). Hoje as taxas ficam numa lista livre por canal; as existentes viram "Comissão" (soma atual), então nenhum preço ou cálculo muda para quem já usa.
- **Pedido** guarda `taxa_prevista` e `taxa_real` (vazia até vir do relatório). Prevista = itens × comissão + (pago online pela plataforma ? itens × taxa online : 0). Líquido usa a real quando existir.
- Pedidos existentes: taxa prevista = taxa atual gravada; líquido não muda.
- **Análise por Plataforma**: por canal — bruto, prevista, real, diferença em R$, taxa efetiva % ((reais + mensalidade) ÷ bruto).
- **DRE**: mensalidade entra em "Taxas de Apps/Delivery" uma vez em cada mês com venda no canal.
- **Precificação**: usa comissão + taxa online. Aviso no canal se a taxa efetiva real dos últimos 30 dias passar a prevista em mais de 2 p.p.

## V4B — Um único assistente
- Janela "Importar" com só "Foto" e "Planilha" (a aba 99Food entra em Planilha).
- Arrastar um ou mais .xlsx/.xls/.csv; identificação automática pelos cabeçalhos: iFood pedidos, iFood financeiro, 99Food, genérica. Mostra o formato e permite trocar.
- iFood pedidos + financeiro juntos: cruza pelo número do pedido (itens de um, comissão/taxas reais do outro).
- Conferência com as mesmas regras da foto (vínculo, subtotal, sem produto, descontos, combo, entrega/pagamento).
- Lista resumida (data, número, subtotal, líquido, situação) com contadores no topo: prontos, com item para escolher, duplicados, a atualizar. Toque abre o detalhe.
- Duplicado vale entre foto e planilha (número + plataforma). Se a planilha trouxer taxa real de um pedido já existente, atualiza a taxa real e avisa "X pedidos atualizados".
- Instruções de exportação por plataforma continuam.

## V6 — A receber das plataformas
- Canal ganha "Prazo de repasse (dias)", padrão 0.
- Pago online pela plataforma: líquido vira "A receber" até data da venda + prazo; não soma no Saldo Atual até lá.
- Recebido pela loja: valor recebido entra hoje; a comissão fica como "a descontar do próximo repasse".
- Caixa: cartão "A receber das plataformas" com total; ao clicar, lista por canal e data prevista (descontos de repasse mostrados abatendo).
- Fluxo de Caixa: a receber nas datas previstas. DRE não muda. Venda cancelada some do a receber (é calculado a partir do pedido, sem lançamento separado).
- Pedidos antigos: prazo considerado 0, então o Saldo de hoje não muda.

## Critérios de aceite (vou testar no banco com rollback)
- 99Food e iFood entram pela aba Planilha sem escolher formato.
- Pedido já importado por foto não vira venda nova pela planilha.
- Canal 23% + 3,2% online + 30 dias, venda online R$ 100 → líquido R$ 73,80, fora do Saldo hoje, "A receber" em 30 dias.
- Mesma venda em dinheiro → R$ 100 no Caixa hoje, R$ 23,00 a descontar do próximo repasse.
- Totais do mês, DRE e Vendas iguais aos de antes para vendas já existentes (comparo antes/depois).

## Detalhes técnicos
- Migração: `canais_venda` + `comissao_pct`, `taxa_online_pct`, `mensalidade`, `prazo_repasse_dias` (backfill comissão = soma de `taxas_canais`); `vendas_pedidos` + `taxa_prevista`, `taxa_real`, `data_repasse_prevista`. `salvar_venda_pedido`/`recalcular_totais_pedido` passam a calcular prevista, usar real quando houver e gravar data de repasse; nova RPC `atualizar_taxa_real_pedido`. `get_saldo_caixa` passa a ignorar líquido com repasse futuro e descontar comissão de pedidos recebidos pela loja quando o repasse ocorrer. `taxas_canais` continua existindo para não quebrar leituras antigas.
- Lógica pura nova em `src/lib/taxaCanalUtils.ts`, `src/lib/repasseUtils.ts`, `src/lib/planilhaFormatos.ts` com testes dos números acima.
- Arquivos: `ImportarVendasDialog.tsx` (abas, planilha), `Importar99FoodDialog.tsx` (parser reaproveitado), `CanaisVendaConfig.tsx`, `AnalisePlataformas.tsx`, `DREGerencial.tsx`, `useMenuEngineering.ts`/precificação, `Caixa.tsx`, `FluxoCaixa.tsx`.
- Ressalva: sem planilhas reais de exemplo, a identificação usará os cabeçalhos conhecidos; se você tiver um arquivo de cada, mande que eu valido.
