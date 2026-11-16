# Plano: 5 itens (C4, C5, C11, C12, C13)

Nada muda na estrutura do banco. Só telas citadas e as regras pedidas.

## C4 - Data da venda um dia antes
- Causa confirmada: a lista de Vendas usa `new Date("2026-11-12")`, que o navegador lê como meia-noite UTC e volta pro dia 11 no Brasil.
- Troco por `parseDataLocal` (já existe em `src/lib/format.ts`) nas duas linhas de `Vendas.tsx` e em qualquer outro lugar que mostre `data_venda` desse jeito (relatórios, Painel). Coach e Insights já estão certos.

## C5 - Cliente virando canal
- Em `Vendas.tsx` removo a linha que troca o canal por `Cliente: nome`. A venda fica com o canal escolhido (padrão balcao) e o cliente só em `cliente_id`.
- Na lista, o nome do cliente aparece como informação separada, abaixo do canal.
- Correção dos dados antigos: troco o canal das vendas que começam com "Cliente: " para "balcao". O cliente vinculado continua igual.

## C11 - Números e nomes no padrão brasileiro
- Em `src/lib/format.ts` crio `formatPercentBR` (23,7%) e `formatQuantidadeBR` (230 g, 1,5 kg, sem zeros sobrando). Para dinheiro uso o `formatCurrencyBRL` que já existe.
- Troco os `toFixed` que aparecem na tela: Painel, Insumos, Estoque (incluindo a aba Acabados), canais em Configurações e onde mais aparecer.
- Crio nomes legíveis para as categorias do Caixa ("Taxa de plataforma", "Venda", etc.) e para o canal ("Balcão").

## C12 - WhatsApp como Canal Próprio
- Verificado: hoje a conta nova não ganha canais automáticos, quem cadastra é a pessoa no "Configure seu negócio". A demo copia os canais da Docesarin.
- Ajuste: na criação da demo, WhatsApp e Instagram passam a nascer como "proprio". No cadastro manual de canal, quando o nome digitado for WhatsApp ou Instagram, o tipo já vem como Canal Próprio (a pessoa pode trocar). Canais que já existem não mudam.

## C13 - Três detalhes
- (a) Nas 6 buscas com "Digite para buscar...", a tecla espaço deixa de fechar a lista. "leite cond" passa a achar "Leite condensado".
- (b) No cadastro de produto em 3 passos, o aviso "Preços salvos" não cobre mais os botões. "Finalizar" fecha o assistente e mostra o produto na lista, sem abrir a ficha técnica de novo.
- (c) Na Nova Encomenda, o calendário fecha assim que você escolhe o dia.

## Detalhes técnicos
- C4: `parseDataLocal(venda.data_venda)` no lugar de `new Date(...)`. Procuro com rg os outros lugares com `new Date(x.data_venda)` ou `data_movimento`.
- C5: a correção é um UPDATE de dados em `vendas` (`canal LIKE 'Cliente: %'` → `'balcao'`), não muda o banco. Também confiro `caixa_movimentos.descricao` caso tenha o mesmo texto.
- C11: uso `Intl.NumberFormat('pt-BR')` com `maximumFractionDigits` (quantidade com até 3 casas, percentual com 1). Os mapas de rótulos ficam em `format.ts`.
- C12: em `setup-demo-user`, defino o tipo pelo nome (`/whats|insta/i` → proprio). Em `CanaisVendaConfig`, sugiro o tipo pelo nome digitado.
- C13a: provavelmente é o `onKeyDown` do Popover/Command que trata o espaço como seleção. Vou impedir que o espaço chegue até a lista e manter o filtro com `includes`.
- C13b: o toast em mobile/desktop vai pra posição que não cobre o rodapé, ou fica silencioso dentro do assistente. Também tiro o callback que reabre a ficha depois de finalizar.
- C13c: `Popover` controlado (`open`/`setOpen(false)` no `onSelect`).
- No fim, rodo a checagem de tipos e mando o relatório item por item.
