# Correção dos achados da auditoria — Gastro Gestor

Conferi ponto a ponto os 58 achados no código e nas migrações do banco. Resumo do veredito antes do plano:

## O que a auditoria acertou (confirmado no código)

- **Rendimento da receita ignorado**: a função de custo aceita o rendimento, mas nenhuma das ~13 telas passa esse valor. Todo custo, margem e CMV de receita em lote aparece inflado.
- **Fórmulas de preço sugerido diferentes**: são **quatro**, não três (card do produto, matriz, sugestão por canal e editor de preços por canal). Resultados diferentes para o mesmo produto.
- **Custo médio ponderado**: o banco calcula certo e o app sobrescreve logo depois (compra manual, importação de nota, implantação de saldo). E a ordem dos dois gatilhos do banco faz o cálculo contar a quantidade da compra duas vezes.
- **Estoque recalculado no app** somando todo o histórico do insumo e gravando de volta — lento e pode apagar uma baixa simultânea.
- **Checkout da loja online**: preço, quantidade e total vêm do navegador do cliente e nada no servidor confere.
- **Pedidos da loja online não entram em Vendas nem no Caixa** (encomendas fazem isso certo).
- **Estorno de venda**: quando a venda usou parte do estoque pronto e parte dos insumos, o estoque pronto não volta.
- **Quantidade vendida "adivinhada"** dividindo valor pelo preço atual, em vez de usar a quantidade real (e existe até um custo congelado na venda que não é usado).
- **Ponto de equilíbrio**: só desconta imposto/taxa no modo estimativa e compara receita do período filtrado com o custo fixo do mês inteiro.
- **Margem de contribuição** com duas definições (Dashboard sem taxas, DRE com taxas).
- **Fila offline nunca é alimentada** — a promessa de "sincroniza depois" na interface não existe de fato, e falhas seriam retentadas para sempre.
- Demais itens médios/baixos: datas em UTC (vencimento e filtros), unidade ditada por voz sem validação, fallback silencioso "custo × 3", variação Infinity no histórico de preços, listas sem paginação (Estoque, Vendas, Pedidos, checagem de duplicidade na importação), exclusão de nota sem estorno em um caminho paralelo, cancelamento de encomenda sem estorno financeiro, duplo clique sem trava, verificação de admin duplicada, `refetchOnMount: 'always'`, heartbeat sem checar conexão.

## O que a auditoria errou ou exagerou

- **"Nenhuma venda dá baixa automática de estoque" está errado.** Existem gatilhos no banco que baixam insumos e estoque pronto a cada venda gravada, e desfazem na exclusão. Vendas manuais, importadas e encomendas entregues baixam estoque sim. O problema real e mais estreito: **pedidos do cardápio digital** não geram venda, então não baixam nada.
- **"A fila offline não tem limite de tentativas nem descarte"**: não há *nenhum* controle de tentativa — o efeito é retentativa infinita, o que é pior do que o texto sugere.
- "Venda Rápida não parece acoplada": é pior — o componente não é importado em lugar nenhum (código morto).
- A exclusão de nota sem estorno **não** é código inativo: está ligada a um botão real.
- `SmartInsights` foi citado em achados que não estão nele (o arquivo tem o problema da meta fixa ÷ 0,20, não o da quantidade).

## Plano de ação por fases

Cada fase termina com validação antes de seguir. Nada de mexer em várias fases ao mesmo tempo.

### Fase 1 — Segurança do dinheiro (urgente)
1. Recalcular o pedido da loja online no servidor: uma função no servidor recebe o carrinho, busca preços e taxa de entrega no banco, monta o total e grava o pedido. O navegador deixa de decidir valor.
2. Fechar a permissão de gravação direta de pedidos pelo público, mantendo o acompanhamento do pedido funcionando.
3. Trava contra duplo clique e reenvio no checkout.

### Fase 2 — Ligar a loja online ao financeiro e ao estoque
4. Ao marcar um pedido como concluído, gerar a venda e o movimento de caixa (mesmo padrão já usado em encomendas), com proteção contra lançamento duplicado.
5. Como a venda gravada dispara os gatilhos existentes, a baixa de estoque passa a acontecer automaticamente — sem criar lógica nova.
6. Corrigir o estorno para devolver a parte do estoque pronto quando a venda foi atendida em parte por insumos.
7. Estorno financeiro ao cancelar encomenda já entregue e trava contra duplo clique na entrega.

### Fase 3 — Unificar custo e preço (fonte única)
8. Passar o rendimento em todos os pontos que calculam custo de ficha, e conferir tela por tela (produtos, vendas, dashboard, relatórios, matriz).
9. Uma única função de preço sugerido, usada pelas quatro telas, com uma definição só de CMV e imposto. Remover o fallback silencioso "custo × 3" e mostrar aviso quando o cálculo é inviável.
10. Alinhar o custo mostrado no diálogo de ficha técnica com o do simulador de substituição.
11. Validar unidade ditada por voz contra a unidade do insumo e avisar em vez de assumir.

### Fase 4 — Custo médio ponderado
12. Corrigir a ordem dos gatilhos do banco para a média não contar a compra duas vezes.
13. Parar de sobrescrever o custo pelo app nas três telas de entrada, mantendo a implantação de saldo inicial como exceção explícita.
14. Um único registro no histórico de preços por compra.
15. Parar de recalcular estoque no app: confiar no gatilho atômico do banco.

### Fase 5 — Relatórios coerentes
16. Usar a quantidade real da venda (e o custo congelado quando existir) em Dashboard, DRE, evolução de margem e insights.
17. Uma definição só de margem de contribuição (com taxas de canal), usada no Dashboard e no DRE.
18. Ponto de equilíbrio: descontar imposto e taxa sempre, e proporcionalizar o custo fixo ao período filtrado.
19. Alinhar o critério de estoque baixo entre Dashboard e relatório de Posição de Estoque.
20. Corrigir fusos nas datas (vencimento, fluxo de caixa, perdas) e o Infinity no histórico de preços.

### Fase 6 — Offline e performance
21. Decidir o offline: enfileirar de verdade venda e caixa quando falhar por falta de conexão, com limite de tentativas — ou remover a promessa da interface. Recomendo enfileirar apenas esses dois fluxos e remover o resto da promessa.
22. Paginação e filtro de data no banco em Estoque, Vendas, Pedidos e na checagem de duplicidade da importação.
23. Limpezas: verificação de admin única, `refetchOnMount` ajustado, heartbeat só com conexão, remover monitor de performance e Venda Rápida não usados (ou ligar a Venda Rápida ao botão principal, se você quiser a tela).

### Fase 7 — Produto (opcional, decidir depois)
Escalonamento de complexidade na navegação (área "avançado" para DRE, fluxo de caixa, matriz), caminho de preço rápido sem ficha técnica completa e liberar o coach de regras locais no teste gratuito.

## Como garantir que nada quebra

- Uma fase por vez, cada uma validada no preview com a base demo antes da próxima.
- Antes de cada fase que muda cálculo, registro dos números atuais de um produto e um período conhecidos, para comparar depois e explicar cada diferença.
- Mudanças de banco em migrações pequenas e reversíveis; gatilhos ajustados sem apagar dados.
- Onde há duplicação, o novo cálculo entra em um único arquivo compartilhado e as telas passam a chamá-lo — sem cópia nova.
- Checagem de tipos e testes existentes rodando ao fim de cada fase.

## Detalhes técnicos

- Nova edge function `criar-pedido-publico` (service role) recalculando `subtotal`/`valor_total` a partir de `produtos`, `precos_canais` e `bairros_entrega`; política de INSERT público em `pedidos` restrita depois disso.
- `registrarVendaPedido` reaproveitando o padrão de `useEncomendas.ts:179-223`, com chave de idempotência por `pedido_id` em `vendas`.
- SQL: renomear/recriar os gatilhos de `estoque_movimentos` para que `calcular_custo_medio_ponderado` rode antes de `atualizar_estoque_insumo` (ou passar a usar o estoque anterior dentro da função); corrigir `reverter_estoque_venda` para estornar `qtd_do_acabado` registrada; travar rendimento ≤ 0 em `calcular_custo_ficha`.
- `src/utils/custoFicha.ts`: manter assinatura, corrigir os ~13 call sites e trocar o fallback silencioso de unidade por erro tratado na UI.
- `src/lib/precificacaoUtils.ts` passa a ser a única fonte de preço sugerido, consumida por `useMenuEngineering.ts`, `SugestaoPrecoCanal.tsx`, `PrecosCanaisEditor.tsx` e cards de produto.
- Dashboard/DRE: usar `vendas.quantidade` e `vendas.custo_snapshot`; extrair `calcularMargemContribuicao` compartilhada.
- Datas: helper `parseDataLocal` para strings `YYYY-MM-DD` e filtros por `created_at` convertidos para o fuso de São Paulo.
