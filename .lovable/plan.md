# Etapa 7 — Encomendas completas (N2) e Tempo de preparo (N1)

## Como funciona hoje
- **Campos:** cliente (nome/WhatsApp), data e hora de entrega, local, observações, itens (produto, quantidade, preço), valor do sinal (só o valor), forma de pagamento, total. O canal escolhido só serve para preencher o preço; não fica gravado.
- **Situações:** pendente → em produção → pronta → entregue, ou cancelada. Não existe "Orçamento".
- **Ao marcar como entregue:** o banco cria linhas de venda (origem "encomenda", canal fixo "encomenda", data da entrega), que viram um pedido em Vendas e baixam o estoque pelas regras normais. No Caixa entram dois lançamentos manuais: o saldo na data da entrega e o sinal **na data em que a encomenda foi criada** (não na data real do pagamento, que não é guardada). Se a encomenda já tem venda, não cria de novo.
- **Ao cancelar:** apaga a venda, o pedido e os lançamentos do Caixa, inclusive o sinal (não pergunta se foi devolvido). O sinal só aparece no Caixa depois da entrega, não quando é pago.
- **Painel:** não tem lembretes de encomendas. Não existe lista do que produzir nem imagem de orçamento ou recibo.
- **Tempo de preparo:** não existe.

## N2 — Encomendas completas
1. **Venda na entrega:** o pedido em Vendas passa a usar o canal escolhido e o desconto. O vínculo fica guardado na própria encomenda, então ela nunca gera venda duas vezes. Cancelar desfaz o pedido pelo mesmo cancelamento das Vendas (devolve estoque) e retira o saldo do Caixa.
2. **Sinal:** campos para valor, data e forma de pagamento. O sinal entra no Caixa na data do pagamento, como "Sinal da encomenda de [cliente]". Na entrega entra só o saldo (total − sinal). Ao cancelar com sinal pago, aparece a pergunta "O sinal foi devolvido?". Se sim, lança uma saída; se não, o sinal continua como entrada.
3. **Aba "O que produzir":** período padrão de 7 dias.
   - **Produzir:** quantidade por produto e por dia, menos o estoque pronto.
   - **Comprar:** só os insumos que faltam pela ficha técnica, incluindo receitas base, com custo estimado pelo último preço de compra.
   - **Botão:** copiar a lista ou enviar pelo WhatsApp.
4. **Orçamento e recibo:** a nova situação "Orçamento" não entra na lista da semana; o botão "Aprovar" transforma em encomenda confirmada. Os botões "Enviar orçamento" e "Enviar recibo" geram uma imagem que pode ser compartilhada no celular ou baixada.
5. **Lembretes no Painel e em Encomendas:** "Entregas de hoje", "Entregas de amanhã" e "Saldo a receber de encomendas", com total e lista. Encomendas atrasadas aparecem destacadas.
6. **Preço:** segue a mesma regra de preço por canal das Vendas, com desconto em reais.

## N1 — Tempo de preparo e lucro por hora
- Campo opcional "Tempo de preparo (min)", para o lote inteiro, na receita base e no produto.
- **Tempo por unidade:** tempo do lote ÷ rendimento. Em produtos feitos com receitas base, soma o tempo das receitas usadas ao tempo de montagem.
- **Lucro por hora:** lucro por unidade ÷ tempo por unidade, usando o mesmo lucro da margem. Aparece no detalhe do produto e na Precificação.
- **Aviso:** "Rende pouco por hora de trabalho" quando o produto fica abaixo da metade da média.
- **Horas da semana:** a aba "O que produzir" mostra as horas necessárias. Em Configurações entra o campo "Horas de produção disponíveis por semana"; se faltar tempo, aparece um aviso.
- Pró-labore, gás e energia continuam como custos fixos. Sem tempo informado, nada muda.

## Ordem
1. Banco
2. Venda, sinal e cancelamento
3. Formulário com canal, desconto e orçamento
4. Lembretes
5. Aba "O que produzir"
6. Imagem
7. N1

Em cada passo, vou testar os critérios de aceite.

## Ponto de atenção
Na etapa passada, as mudanças no banco não chegaram ao Supabase usado pelo app. Antes de começar, vou conferir se a alteração chega lá. Se não chegar, te passo o código para colar no editor do Supabase (SQL Editor), um passo por vez.

## Detalhes técnicos
- **Colunas novas em `encomendas`:** `canal_id`, `desconto`, `sinal_data`, `sinal_forma_pagamento`, `sinal_devolvido`, `pedido_id`; nova situação `orcamento`.
- **Colunas novas em outras tabelas:** `tempo_preparo_min` em `insumos` (receitas base) e em `produtos`; `horas_producao_semana` em `configuracoes`.
- **`registrar_venda_encomenda`:** passa a usar `salvar_venda_pedido` com origem `encomenda`, o canal e uma chave de idempotência igual ao id da encomenda. O sinal vira um movimento de Caixa próprio, gravado ao salvar a encomenda (ele não é desfeito ao trocar a situação). `estornar_venda_encomenda` passa a usar `cancelar_venda_pedido` e só trata o sinal conforme a resposta sobre a devolução.
- **Encomendas antigas já entregues:** ficam como estão.
- **Cálculos em arquivos separados, com testes:** `src/lib/encomendaProducao.ts` (produzir, comprar, horas) e `src/lib/tempoPreparo.ts`.
- **Imagem:** gerada com `html-to-image` e compartilhada pelo recurso de compartilhamento do aparelho (Web Share).
