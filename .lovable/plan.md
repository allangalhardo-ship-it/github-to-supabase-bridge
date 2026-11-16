# Correção C1, C2 e C3 — preço base x preço por canal

## C1 — Produto com preço base R$ 0,00
**O que muda:** o assistente "Novo Produto" hoje grava o produto com preço 0 e só salva os preços por canal. Ao salvar os preços, o preço base passa a receber o preço do Balcão (ou do primeiro canal presencial, se não houver Balcão).
- Telas que mostram um preço único (Produção, Estoque > Acabados, seletor da Nova Venda, Nova Encomenda): se o preço base estiver zerado, mostram o do Balcão.
- Nova Encomenda: o item usa o preço do canal escolhido; sem preço no canal, cai no preço base e depois no Balcão (hoje cai direto no base = 0).
- Correção dos produtos existentes: atualizar uma vez, em todas as empresas, os produtos com preço base 0 que têm preço de Balcão preenchido.
- Conferência: "Copinho de Brigadeiro" a R$ 10,64 nas três telas; 20 unidades = R$ 212,80.

## C2 — Canal novo herda o preço base sem aviso
**O que muda:** ao criar um canal em Configurações, abre uma janela perguntando:
- (a) Copiar preços de outro canal (escolhe qual);
- (b) Usar o preço sugerido pela meta de custo, já considerando a taxa do canal (mesma conta da Precificação);
- (c) Definir depois.
Nas opções (a) e (b), os preços são gravados para todos os produtos ativos. Na (c), nada é gravado e a Precificação mostra o aviso "X produtos sem preço revisado no canal Y", com botão que abre o simulador.
- Observação: as taxas são cadastradas depois do canal. Na opção (b), se o canal ainda não tiver taxa, a janela avisa e pede a taxa antes de calcular.

## C3 — Coach usa o preço errado
**O que muda:** Coach, Insights e Alertas passam a buscar o preço do canal citado (preço gravado para aquele canal; sem ele, o preço base). O aviso "o custo come X% do preço... hoje R$ ..." usa o preço do Balcão (R$ 22,09 no Brownie), igual ao cartão do produto.

## Fora do escopo
Nenhuma outra tela ou regra muda. Nenhuma coluna nova no banco.

## Detalhes técnicos
- Helper novo `precoEfetivo(produto, precosCanais, canal?)` em `src/lib/precificacaoUtils.ts` + testes (C1 exemplo 10,64 x 20 = 212,80; fallback Balcão; canal específico).
- C1: `NovoProdutoWizard.tsx` (update preco_venda após salvar precos_canais), `Producao.tsx`, `Estoque.tsx`, `Vendas.tsx` (label do Combobox), `EncomendaFormDialog.tsx` (label + `getPreco` + `handleCanalChange`). Backfill via SQL: `UPDATE produtos SET preco_venda = pc.preco FROM precos_canais pc WHERE preco_venda = 0 AND pc.canal ILIKE 'balc%'`.
- C2: `CanaisVendaConfig.tsx` + novo `NovoCanalPrecosDialog.tsx` (upsert em precos_canais respeitando a unique (produto_id, canal, empresa_id)); aviso em `Precificacao.tsx` contando produtos ativos sem linha em precos_canais para canais ativos.
- C3: `BusinessCoach.tsx`, `SmartInsights.tsx`, `AlertasInteligentes.tsx`, `useDashboardData.ts` passam a carregar precos_canais e usar `precoEfetivo` com `encontrarCanal`.
- Validação: typecheck e testes; telas com login não consigo abrir daqui.
