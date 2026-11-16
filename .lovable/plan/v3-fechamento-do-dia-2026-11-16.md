# V3 - Fechamento do dia

## O que muda (resumo)
- Tela de Vendas ganha o botão "Fechamento do dia" ao lado de "Nova Venda".
- Nova janela: data (padrão hoje), grade produtos x canais (presenciais/próprios visíveis; aplicativos ocultos com opção "Mostrar canais de aplicativo"), busca por nome, mais vendidos primeiro.
- No celular: escolhe o canal em botões no topo e vê a lista de produtos com menos/mais.
- Rodapé fixo: total do dia, taxa dos canais, líquido e lucro previsto, atualizando a cada alteração.
- Salvar cria um pedido por canal com quantidade, origem "fechamento", preços do canal. Estoque e Caixa seguem as regras atuais (mesma função de salvar venda).
- Se já houver fechamento no dia: aviso com "Somar ao existente" ou "Substituir" (cancela os pedidos de fechamento do dia, devolvendo estoque, e cria os novos).
- Na lista de Vendas, a origem aparece como "Fechamento" e o pedido abre, edita e cancela como os demais.

Nenhuma outra tela ou regra é alterada. Não precisa mudar o banco: a função de salvar já aceita a origem informada e só bloqueia edição de "encomenda" e "pedido".

## Detalhes técnicos
- `src/lib/fechamentoDia.ts` (novo): montar pedidos por canal a partir da grade (ignora zeros), totais do rodapé reutilizando `calcularCarrinho`, classificação de canal visível por padrão (tipo presencial/próprio vs app_delivery via `canalUtils`). Testes em `fechamentoDia.test.ts`: 12 Balcão + 8 Feira gera 2 pedidos e 20 unidades; células vazias ignoradas.
- `src/components/vendas/FechamentoDiaDialog.tsx` (novo): grade desktop / lista mobile, preço por canal via `precos_canais` com fallback do preço único (`precoCanalUtils`), ordem por vendas dos últimos 30 dias. Salvar: consulta `vendas_pedidos` com origem 'fechamento' e status ativo na data; se existir, pergunta somar/substituir; substituir chama `cancelar_venda_pedido` em cada um antes; depois `salvar_venda_pedido` por canal com `idempotency_key` gerada por abertura da janela (evita duplicar em clique duplo). Modal com `max-h-[90vh] overflow-y-auto`, tela cheia no mobile.
- `src/pages/Vendas.tsx`: botão + estado de abertura + recarregar lista ao salvar.
- `src/components/vendas/PedidoDetalheDialog.tsx`: `ORIGEM_LABEL.fechamento = 'Fechamento'`.
- `src/components/vendas/VendaRapidaDialog.tsx`: ao editar, manter a origem original do pedido (conferir; ajustar só se hoje força "manual").

## Verificação
- Teste no banco (com rollback): 12 Balcão + 8 Feira → 2 pedidos origem fechamento e estoque do produto -20; substituir devolve estoque e recria.
- Testes unitários e build.
