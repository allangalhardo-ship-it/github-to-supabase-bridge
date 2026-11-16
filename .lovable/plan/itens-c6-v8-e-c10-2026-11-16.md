# Itens C6, V8 e C10

## C6 – Corrigir lançamento manual do Caixa
- Nas linhas com origem "Manual", aparecem um lápis e uma lixeira.
- O lápis abre a mesma janela do Novo Lançamento, já preenchida. Dá para mudar categoria, descrição, valor e data.
- A lixeira pede confirmação antes de excluir.
- Nas linhas de Venda, NF-e e compra manual (lançada na tela de Compras) não aparecem botões. No lugar deles fica um aviso: "Altere na tela de Vendas" ou "Altere na tela de Compras".
- Os totais (Entradas, Saídas e Saldo) são recalculados na hora. Por exemplo, ao excluir uma saída manual de R$ 200,00, as Saídas do Mês caem R$ 200,00.

## V8 – Vendas em dobro no Caixa
- (a) Novo Lançamento: ao escolher Entrada com a categoria "Venda", aparece o aviso "As vendas já entram sozinhas no Caixa", com o botão "Ir para Vendas". Para salvar mesmo assim, é preciso marcar "Entendi, quero lançar mesmo assim".
- (b) Dados de demonstração: deixam de ser criados os lançamentos manuais "Vendas Balcão/iFood..." e "Taxa ...". Os lançamentos de custos fixos mensais continuam.
- (c) Conta demo atual: antes de apagar, mostro a contagem dos lançamentos manuais de venda e de taxa de plataforma. Depois apago só esses, filtrando pela empresa demo, pela origem manual e pelas categorias venda e taxa_plataforma.
- (d) Entrada automática de venda pelo valor líquido: usa o valor líquido quando ele existe e é maior que zero; se não, usa o valor total. Vale para a lista do Caixa, para Entradas do Mês, Saldo e Resultado, e para o relatório Fluxo de Caixa.
- (e) Quando houver taxa, a descrição mostra o bruto e a taxa. Exemplo: "Petisqueira Brownie (1x) - iFood | bruto R$ 61,90, taxa R$ 16,71".
- Não serão criadas saídas automáticas de taxa. O DRE continua mostrando as taxas como hoje.
- Conferência: no mês atual, a soma das entradas de venda no Caixa deve ser igual ao total líquido da tela de Vendas.

## C10 – Dois percentuais de custos fixos
- O campo "Faturamento Mensal" passa a se chamar "Meta de faturamento mensal".
- Os dois percentuais aparecem lado a lado:
  - "sobre a meta de faturamento": custos fixos ÷ meta.
  - "sobre o faturado no mês": custos fixos ÷ vendas do mês atual. Usa a mesma conta do DRE (soma do valor das vendas do mês e custos fixos mensais).
- A classificação (saudável, atenção ou alarmante) e a recomendação em reais vão dizer em qual percentual se baseiam. A régua principal segue usando a meta. Se não houver meta, usa o faturado no mês, e o texto avisa qual dos dois está sendo usado.

## Detalhes técnicos
- `src/pages/Caixa.tsx`: guardar o id real nos itens manuais, usar mutations de update e delete em `caixa_movimentos` (as permissões de editar e excluir já existem) e invalidar o saldo (`get_saldo_caixa`). Inclui o aviso de categoria "Venda".
- `supabase/functions/setup-demo-user/index.ts`: remover o bloco `entradasCaixa` do caixaPayload. Depois, publicar a função.
- Limpeza de dados com `DELETE ... WHERE empresa_id = <demo> AND origem='manual' AND categoria IN ('venda','taxa_plataforma')`, rodada depois de uma contagem prévia.
- Entrada líquida: buscar `valor_liquido` em `Caixa.tsx` e `FluxoCaixa.tsx` e usar `COALESCE(NULLIF(valor_liquido,0), valor_total)`. Antes, ler a função `get_saldo_caixa`. Se ela somar vendas pelo bruto, uma migration troca essa soma pela mesma regra.
- Compra manual: conferir se aparece como linha no Caixa (hoje só NF-e entra). Se aparecer, tratar como somente leitura.
- `src/pages/CustosFixos.tsx`: buscar as vendas do mês atual (de `vendas.valor_total`, igual ao DRE com o período "mês atual"), mudar os rótulos e mostrar dois percentuais.
- Não mexe em outras telas nem em outras regras.
