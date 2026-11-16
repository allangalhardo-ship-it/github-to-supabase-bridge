# Itens C6, V8 e C10

## C6 – Corrigir lançamento manual do Caixa
- Nas linhas com origem "Manual", aparecem um lápis e uma lixeira.
- O lápis abre a mesma janela do Novo Lançamento, já preenchida. Dá para mudar categoria, descrição, valor e data.
- A lixeira pede confirmação antes de excluir.
- Nas linhas de Venda e NF-e não aparecem botões. No lugar deles fica um aviso: "Altere na tela de Vendas" ou "Altere na tela de Compras".
- Os totais (Entradas, Saídas e Saldo) são recalculados na hora. Por exemplo, ao excluir uma saída manual de R$ 200,00, as Saídas do Mês caem R$ 200,00.

## V8 – Vendas em dobro no Caixa
- (a) Novo Lançamento: ao escolher Entrada com a categoria "Venda", aparece o aviso "As vendas já entram sozinhas no Caixa", com o botão "Ir para Vendas". Para salvar mesmo assim, é preciso marcar "Entendi, quero lançar mesmo assim".
- (b) Dados de demonstração: deixam de ser criados os lançamentos manuais "Vendas Balcão/iFood..." e "Taxa ...". Os lançamentos de custos fixos mensais continuam.
- (c) Conta demo atual: antes de apagar, mostro a contagem dos lançamentos manuais de venda e de taxa de plataforma. Depois apago só esses, filtrando pela empresa demo, pela origem manual e pelas categorias venda e taxa_plataforma.
- Ponto de atenção: o Caixa não gera saídas automáticas de taxa. Por isso, depois do item (c), as taxas dos aplicativos da demo deixam de aparecer como saída. Elas continuam no DRE, que calcula pelas vendas. Estou fazendo exatamente o que o item pede.
- Conferência: no mês atual, a soma das entradas de venda no Caixa deve ser igual ao total da tela de Vendas.

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
- `src/pages/CustosFixos.tsx`: buscar as vendas do mês atual (de `vendas.valor_total`, igual ao DRE com o período "mês atual"), mudar os rótulos e mostrar dois percentuais.
- Não mexe em outras telas nem em outras regras.
