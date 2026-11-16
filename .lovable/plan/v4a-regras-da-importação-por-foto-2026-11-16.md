# V4A - Regras da importação por foto

A leitura da foto (o que a IA enxerga) não muda. Só ajusto o que acontece depois da leitura e algumas instruções de classificação.

## O que vai mudar, item por item

1. **Vínculo de produto**: a ligação automática por "parecido" acaba. Liga sozinho só com ligação salva de importação anterior ou nome igual (sem diferença de maiúscula, acento e espaço). Nos outros casos, aparecem até 3 sugestões marcadas "sugestão". Elas são ordenadas por palavras em comum, e o mesmo tamanho (200ml, 300ml, 60ml) pesa forte; tamanho diferente derruba a nota. A pessoa precisa escolher um produto ou "Sem produto". Cada escolha fica salva.
2. **Valor do pedido**: o pedido entra pelo subtotal do comprovante. Item sem produto entra como "sem produto": conta na receita, não baixa estoque e aparece em Vendas para ligar depois.
3. **Taxa de serviço**: aparece só como informação, não desconta do líquido.
4. **Comissão**: comissão prevista do canal = % × (subtotal − desconto da loja). A tela mostra "Comissão prevista do canal (X%)".
5. **Descontos**: cada linha de desconto vem separada da leitura, com o texto original. Uma lista fixa de nomes classifica sempre igual. "Incentivos e cobrança da loja" e "Desconto da loja" são da loja. "Incentivos iFood", "Desconto da plataforma" e "Entrega promocional para cliente" são da plataforma. Linha desconhecida mostra a pergunta "Quem pagou este desconto? Loja / Plataforma", e a importação fica travada até a resposta.
6. **Data**: sem data no comprovante, o campo fica destacado e a importação trava até a pessoa confirmar a data. Datas sem ano ("06 de jul 22:19", "28 de fev") usam a ocorrência mais recente que não esteja no futuro.
7. **Combos**: o combo vira uma linha com o valor cheio. Os itens de dentro viram componentes com valor zero, que só ligam ao produto e baixam estoque. Tamanho entra no nome do componente. Complementos de montagem continuam na descrição.
8. **Entrega e pagamento**: o pedido guarda quem entregou (loja ou plataforma), a taxa de entrega, a forma de pagamento e quem recebeu (plataforma ou cobrado na entrega). Com entrega da loja, a taxa de entrega vira receita separada no pedido. "Cobrar do cliente" fica registrado como recebido pela loja.
9. **Cardápio próprio (Brendi e similares)**: entra como canal próprio, sem comissão. Se o cupom tiver nome e telefone, aparece "Cadastrar cliente?" com confirmação. Se o telefone já existir, liga ao cliente que já está cadastrado.
10. **Duplicidade**: segue igual, pelo número do pedido + plataforma.

## Ponto de atenção (decisão sua)
Hoje, ao importar, o sistema também grava lançamentos manuais no Caixa: entrada do subtotal e saídas de taxa de serviço, desconto e comissão. Desde o V8, o Caixa já mostra as vendas sozinho pelo valor líquido, então cada pedido importado conta duas vezes. Proponho parar de gravar esses lançamentos, como fizemos no V8. Os lançamentos antigos de importação não serão apagados sem você pedir.

## Pronto quando (vou testar)
- iFood: subtotal 45,89, serviço 0,99, desconto da loja 8,00 e comissão de 27% dão líquido **R$ 27,66**.
- Item sem nome igual e sem ligação salva nunca fica ligado sozinho.
- Print sem data não importa sem confirmar a data.
- Pedido com combo soma exatamente o subtotal.

## Detalhes técnicos
- `process-sales-image`: o prompt passa a pedir `data_encontrada`/`data_texto` (em vez de usar hoje), `descontos[]` com `{texto, valor}`, `itens[].componentes[]`, `entrega_por`, `forma_pagamento`, `cobrar_do_cliente`, `telefone_cliente` e `canal_proprio`. A classificação e a data por extenso ficam no código, não na IA.
- Novo `src/lib/importacaoFotoRegras.ts` com testes: normalização de nome, sugestões (palavras + tamanho), classificação de descontos, data sem ano, cálculo de líquido e montagem do pedido com combo.
- Banco: `vendas_pedidos` ganha `entrega_por` e `pagamento_recebido_por`, os dois texto e opcionais. O pedido é gravado pela `salvar_venda_pedido`, que aceita itens sem produto e com valor zero. A migração ajusta a função para gravar os campos novos, sem mudar o resto.
- Valor líquido = subtotal − desconto da loja − comissão prevista. A taxa de serviço e o incentivo da plataforma ficam só como informação.
- `ImportarVendasDialog.tsx`: badges "salvo / igual / sugestão / escolhido / sem produto", bloqueio por data/desconto pendente e o total pelo subtotal.
