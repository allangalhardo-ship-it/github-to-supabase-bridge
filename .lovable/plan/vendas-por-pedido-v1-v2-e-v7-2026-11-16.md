# Vendas por pedido: V1, V2 e V7

## Ideia geral
Sigo a sua sugestão. A tabela de vendas continua guardando os **itens**, e entra uma tabela nova com o **cabeçalho do pedido**. Cada item fica ligado ao seu pedido. Assim, tudo que soma por produto continua funcionando, e só muda o que conta vendas ou agrupa por canal.

A tabela nova se chama `vendas_pedidos`, porque o nome `pedidos` já é usado pelos pedidos do Cardápio Digital.

## V1 – Pedido com itens e canal cadastrado

### Tabela nova `vendas_pedidos`
| coluna | o que guarda |
|---|---|
| empresa_id | dono do pedido |
| canal_id | canal cadastrado em Configurações (pode ficar vazio só nas vendas antigas em revisão) |
| canal_texto | nome original do canal (mantido para revisão e histórico) |
| cliente_id | cliente (opcional) |
| forma_pagamento | pix, dinheiro, debito, credito, outro (opcional) |
| data_venda | data |
| origem | manual, fechamento, planilha, foto, 99food (e encomenda/pedido, que já existem hoje) |
| numero_externo | número do pedido na plataforma |
| desconto | desconto dado ao cliente |
| taxa_entrega | taxa de entrega cobrada do cliente |
| taxa_canal | taxa/comissão do canal |
| valor_bruto | soma dos itens − desconto + taxa de entrega |
| valor_liquido | valor bruto − taxa do canal |
| status | ativo / cancelado |
| created_at / updated_at | datas de controle |

Cada empresa só vê e mexe nos próprios pedidos, como já acontece com as vendas.

### Mudanças na tabela de vendas (itens)
- Nova coluna `pedido_id`, ligada ao pedido. Ao apagar o pedido, os itens vão junto e o estoque é devolvido pelo gatilho que já existe.
- Nova coluna `preco_unitario`.
- O que já existe continua: `valor_total`, `valor_liquido`, `comissao_plataforma` e `custo_snapshot`. A **soma dos itens de um pedido é sempre igual ao bruto e ao líquido do pedido**, sem contar a taxa de entrega. O desconto é dividido entre os itens na proporção do valor de cada um. Por isso relatórios, Caixa e DRE continuam batendo.
- A taxa de entrega fica só no pedido. O Caixa passa a somá-la como entrada.

### Migração dos dados atuais
1. Cada venda atual vira um pedido com um item. Os valores são copiados sem mudança.
2. Vendas que vieram de encomenda ou de pedido do Cardápio, e que têm o mesmo número de origem, ficam juntas em um único pedido. Já são o mesmo pedido hoje.
3. O canal em texto é comparado com os canais cadastrados da **mesma empresa**:
   - sem diferenciar maiúsculas de minúsculas, sem acento e sem espaços;
   - com alguns apelidos: "99" = "99Food", "balcao" = "Balcão", "Ifood" = "iFood";
   - quando o texto for o código de um canal, liga direto.
4. Quando não houver canal correspondente, o pedido fica com o canal vazio e o texto original guardado. Nada se perde. Essas vendas aparecem em uma lista "Vendas com canal para revisar" na tela de Vendas, para escolher o canal.
5. **Antes de rodar**, mostro a contagem por empresa: quantas vendas serão ligadas e quantas ficarão para revisão. Prévia de hoje, juntando todas as contas:
   - **Não acharam canal:** instagram (302), rappi (291), whatsapp minúsculo (291), 99Food (178), Venda Direta (7), entre outros.
   - **Provável causa:** são contas que não têm esses canais cadastrados.
   - **Na revisão:** essas vendas ficam para revisão, e não crio canais sozinho.
6. **Conferência no fim:** em novembro de 2026, na conta demo, o bruto continua R$ 8.004,42 e o líquido R$ 7.498,54.

### Ticket médio e contagem
Passam a contar **pedidos**, não itens. Vale para o Painel (KPIs e ticket por canal), Coach, Insights, Análise de Vendas e Análise por Plataforma.

### Agrupamento por canal
Os relatórios passam a agrupar pelo canal cadastrado e mostram o nome do cadastro. Assim aparece uma linha por canal, sem variações do mesmo nome. Vendas sem canal aparecem em uma linha "Sem canal (revisar)".

## V2 – Venda rápida com carrinho
Substitui o formulário "Nova Venda" por uma tela única, pensada primeiro para o celular:
1. **Produtos:** grade para tocar e adicionar; tocar de novo soma +1. Os mais vendidos nos últimos 90 dias vêm primeiro, e há busca por nome. Cada item no carrinho tem botões − e +, preço editável e opção de remover.
2. **Canal:** botões com todos os canais ativos. O último usado vem marcado e fica guardado no aparelho. Ao trocar de canal, os preços são recalculados pelo preço daquele canal. Os preços editados à mão também são recalculados, e um aviso explica isso.
3. **Opcionais (área recolhida):** cliente (com busca), forma de pagamento, desconto e taxa de entrega.
4. **Rodapé fixo:**
   - total, taxa do canal, valor líquido e lucro previsto;
   - o lucro previsto é o líquido menos o custo da ficha técnica e o imposto médio;
   - os valores mudam a cada toque.
5. **Salvar:** o pedido e todos os itens são gravados de uma vez. Se algo falhar, nada fica pela metade. A baixa de estoque continua igual à de hoje, item por item.
6. **Sem internet:** o pedido inteiro entra na fila do aparelho e é enviado quando a internet voltar. Uma chave única evita gravar o mesmo pedido duas vezes.

## V7 – Ver, editar e cancelar venda
- A lista de Vendas mostra **uma linha por pedido**: data, canal, cliente, quantidade de itens, total e líquido. Tocar na linha abre o pedido com os itens.
- **Editar** abre a mesma tela do carrinho já preenchida. Dá para mudar itens, quantidades, canal, cliente, forma de pagamento e data. Ao salvar, o sistema compara com o pedido anterior:
  - **quantidade aumentou:** baixa a diferença do estoque;
  - **quantidade diminuiu:** devolve a diferença ao estoque;
  - **item removido:** devolve tudo daquele item;
  - **item novo:** baixa como uma venda nova.
- **Cancelar** pede confirmação e apaga o pedido e os itens. O estoque baixado volta pelo gatilho que já existe, e a entrada some do Caixa, que é calculado a partir das vendas.
- **Pedidos de encomenda ou do Cardápio:** abrem só para leitura, com o aviso "Altere em Encomendas" ou "Altere em Pedidos". Assim essas telas ficam como estão.
- **Conferência:** cancelar uma venda de 2 unidades devolve 2 unidades ao estoque, e o total do mês cai no mesmo valor.

## Lugares do sistema que serão ajustados

**Gravam vendas (passam a criar pedido + itens):**
- `src/pages/Vendas.tsx`: Nova Venda vira o carrinho, e a exclusão vira o cancelamento do pedido.
- `src/components/vendas/ImportarVendasDialog.tsx`: importação por planilha e por foto. Itens com o mesmo número de pedido ficam no mesmo pedido.
- `src/components/vendas/Importar99FoodDialog.tsx`: extrato 99Food, agrupado pelo número do pedido.
- `src/components/vendas/LancamentosManuaisTab.tsx`: fechamento do dia (origem "fechamento"). Vou conferir se ele grava vendas.
- `supabase/functions/ai-assistant/index.ts`: venda registrada pelo assistente.
- `supabase/functions/setup-demo-user` e `populate-demo-data`: dados da demo.
- Funções do banco `registrar_venda_encomenda` e `registrar_venda_pedido`: passam a criar o cabeçalho. Não mexo nas telas de Encomendas nem do Cardápio. As funções de estorno apagam o cabeçalho junto.
- `src/lib/syncService.ts` e `offlineStorage.ts`: a fila aceita "salvar pedido".

**Leem vendas (ajuste de contagem por pedido e canal pelo cadastro):**
- `src/hooks/useDashboardData.ts`: KPIs e ticket médio por canal.
- `src/components/dashboard/BusinessCoach.tsx`, `SmartInsights.tsx` e `MargemEvolutionChart.tsx`.
- `src/pages/Caixa.tsx` e `src/components/relatorios/FluxoCaixa.tsx`: uma linha por pedido no Caixa, mais a taxa de entrega.
- Função do banco `get_saldo_caixa`: soma a taxa de entrega dos pedidos.
- `src/components/relatorios/DREGerencial.tsx`, `AnaliseVendas.tsx` e `AnalisePlataformas.tsx`: canal pelo cadastro e contagem de pedidos. A Análise de Margens é conferida e só muda se agrupar por canal.
- `src/components/precificacao-v2/useMenuEngineering.ts` e `KpisAvancados.tsx`: a popularidade continua por produto, então só muda se usarem contagem de vendas.
- Funções do banco `get_dashboard_vendas` e `get_top_produtos`: a primeira passa a devolver `pedido_id` e o nome do canal cadastrado. A segunda continua igual.
- `supabase/functions/ai-chat` e `ai-daily-summary`: contagem de vendas por pedido.
- Só conferência, sem mudança prevista: `WelcomeChecklist.tsx` (basta existir uma venda), `ListaCompras.tsx` (soma por produto) e `CustosFixos.tsx` (soma do mês).

**Não mexo:** telas de Encomendas, Cardápio Digital, nem regras de importação além do agrupamento em pedidos.

## Ordem de execução (para não quebrar nada)
1. Migração: criar a tabela, as colunas e as funções, ainda sem mexer nos dados.
2. Prévia: contagem por empresa de vendas ligadas e para revisão. Mostro os números a você.
3. Migração dos dados. Depois confiro os totais de novembro (R$ 8.004,42 e R$ 7.498,54) e se todas as vendas ganharam pedido.
4. Ajuste de leituras, gravações, importações e funções.
5. Tela do carrinho (V2), e depois detalhe, edição e cancelamento (V7).
6. Testes automáticos:
   - divisão do desconto entre os itens;
   - cálculo do rodapé;
   - diferença de estoque na edição;
   - comparação de nomes de canal.

   Além disso, teste no navegador logado com a conta demo: venda de 3 produtos no WhatsApp para um cliente e cancelamento de uma venda de 2 unidades.

## Detalhes técnicos
- **Salvar com segurança:** a função do banco `salvar_venda_pedido(p_pedido jsonb, p_itens jsonb, p_pedido_id uuid default null, p_idempotency_key uuid)` cria ou edita tudo de uma vez.
- **Edição item a item:** cada item é comparado com o anterior.
  - Item que ficou igual: não muda nada.
  - Item alterado: o item antigo é apagado e um novo é criado. O gatilho atual devolve o estoque do antigo, e o novo baixa a quantidade atual. Na prática, o estoque muda só pela diferença.
  - Isso evita reescrever as funções de baixa de estoque.
- **Cancelamento:** função `cancelar_venda_pedido(p_pedido_id)`. Ela recusa pedidos de encomenda ou do Cardápio.
- **Restrições únicas:**
  - `(empresa_id, idempotency_key)`;
  - `(empresa_id, origem, numero_externo)` quando o número existir, para bloquear importação em dobro.
- **Comparação de canais:** `lower(unaccent(replace(nome,' ','')))` mais uma tabela fixa de apelidos. Isso também fica no front em `src/lib/canalUtils.ts`.
- **Compatibilidade:** a coluna de texto `vendas.canal` continua sendo preenchida com o nome do canal cadastrado, para não quebrar leituras antigas. O canal oficial passa a ser `vendas_pedidos.canal_id`.
- **Permissões:** `GRANT` para usuários logados e para o servidor, com RLS por `get_user_empresa_id()`, no mesmo padrão das tabelas atuais.
