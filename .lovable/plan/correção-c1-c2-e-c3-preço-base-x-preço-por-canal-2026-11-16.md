# Correção C1, C2 e C3 — preço base x preço por canal

## Regra central (vale para C1 e C3)
"Canal presencial principal" = canal ativo chamado Balcão; se não houver, o primeiro canal ativo do tipo presencial. Toda tela que mostra um preço único do produto usa **sempre** o preço desse canal quando ele existir; o preço base é só o último recurso.

## C1 — Produto com preço base R$ 0,00
- Produção, Estoque > Acabados, seletor da Nova Venda e Nova Encomenda passam a mostrar o preço do Balcão (Brownie: R$ 22,09, não R$ 10,83).
- Nova Encomenda: item usa o preço do canal escolhido; sem preço no canal, usa Balcão, depois o preço base.
- **Preço base sempre sincronizado com o Balcão**, em todos os lugares que gravam preço do Balcão: assistente Novo Produto, editor de preços por canal do produto, simulador da Precificação ("Revisar e aplicar") e botão "Aplicar" da lista de sugestões.
- Correção dos produtos existentes (todas as empresas): preço base = preço do Balcão sempre que forem diferentes.

### Backfill — conferido no banco
Em `precos_canais`, o canal é gravado pelo **id** do canal (há 6 linhas antigas gravadas como texto "balcao", que ficam fora). Hoje: 37 produtos com preço no Balcão, **10 com preço base diferente** (2 deles zerados). A query abaixo altera essas 10 linhas:

```sql
WITH principal AS (
  SELECT DISTINCT ON (cv.empresa_id) cv.empresa_id, cv.id
  FROM canais_venda cv
  WHERE cv.ativo AND cv.tipo = 'presencial'
  ORDER BY cv.empresa_id, (cv.nome ILIKE 'balc%') DESC, cv.created_at
)
UPDATE produtos p
SET preco_venda = pc.preco
FROM precos_canais pc
JOIN principal pr ON pr.id::text = pc.canal AND pr.empresa_id = pc.empresa_id
WHERE pc.produto_id = p.id
  AND pc.empresa_id = p.empresa_id
  AND pc.preco > 0
  AND p.preco_venda <> pc.preco;
```
Antes de executar, rodo a mesma seleção para reconfirmar a contagem e mostro a você.

- Conferência: "Copinho de Brigadeiro" R$ 10,64 em Produção, Venda e Encomenda; 20 unidades = R$ 212,80.

## C2 — Canal novo herda o preço base sem aviso
Ao criar um canal em Configurações, abre uma janela:
- (a) Copiar preços de outro canal (escolhe qual);
- (b) Preço sugerido pela meta de custo com a taxa do canal (mesma conta da Precificação). Canais presenciais ou próprios calculam com taxa zero, sem pedir nada; só canais de app sem taxa cadastrada pedem a taxa antes;
- (c) Definir depois: nada é gravado e a Precificação mostra "X produtos sem preço revisado no canal Y", com botão para o simulador.

## C3 — Coach usa o preço errado
Coach, Insights e Alertas usam o preço do canal que citam (preço gravado nesse canal; sem ele, a regra central). O aviso "o custo come X%... hoje R$ ..." do Brownie passa a citar R$ 22,09.

## Fora do escopo
Nenhuma outra tela ou regra muda. Nenhuma coluna nova no banco.

## Detalhes técnicos
- `src/lib/precificacaoUtils.ts`: `canalPrincipal(canais)` e `precoEfetivo(produto, precosCanais, canais, canalId?)` + testes (10,64 × 20 = 212,80; Brownie mostra 22,09; fallback para preço base; canal específico).
- Sincronização: um helper `sincronizarPrecoBase(produtoId, canalId, preco)` chamado após salvar preços em `NovoProdutoWizard.tsx`, `usePrecosCanais.ts` (editor), simulador e `ProdutoListaCompacta.tsx`.
- C1 telas: `Producao.tsx`, `Estoque.tsx`, `Vendas.tsx`, `EncomendaFormDialog.tsx`.
- C2: `CanaisVendaConfig.tsx` + novo `NovoCanalPrecosDialog.tsx` (upsert respeitando unique produto_id+canal+empresa_id); aviso em `Precificacao.tsx`.
- C3: `BusinessCoach.tsx`, `SmartInsights.tsx`, `AlertasInteligentes.tsx`, `useDashboardData.ts`.
- Validação: typecheck e testes; telas com login não consigo abrir daqui.
