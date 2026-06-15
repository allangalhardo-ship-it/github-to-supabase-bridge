
# Plano de execução — Precificação A→F

## Princípio-guia (importante!)

Em vez de **dropar** `produtos.preco_venda` (o que quebraria 50+ arquivos, RPCs do banco, edge functions, histórico de vendas e migrações antigas), vou:

1. **Aposentar** `preco_venda` como fonte de verdade no UI/cadastro
2. **Manter a coluna** sincronizada automaticamente como espelho do **preço do canal Balcão** (trigger no banco)
3. Tudo no app passa a operar via `precos_canais`; código legado que ainda lê `preco_venda` continua funcionando (lê o valor espelhado)
4. Em uma fase futura (não agora), com tudo migrado e validado, podemos finalmente dropar a coluna

Isso evita big-bang. O sistema continua funcional a cada passo.

---

## Ordem de execução (mais segura → mais arriscada)

### Fase 1 — Base de cálculo correta (sem mexer em UI)
**E. Margem ponderada por vendas reais** (hook `useMenuEngineering`)
- Trocar a ponderação atual (por cadastro de `precos_canais`) por **vendas reais dos últimos 30 dias por canal**
- Adicionar tooltip explicando a fonte
- **Risco:** baixo. Só mexe em 1 arquivo. Validar na demo.

### Fase 2 — Desambiguação visual (baixo risco)
**A.1. Renomear "Preço de Venda" → "Preço de Balcão" em todo cadastro/listagem de produtos**
- Apenas labels, tooltips e textos. Zero mudança de lógica.
- Arquivos: `ProductCard`, `Produtos.tsx`, `DuplicarProdutoDialog`, `OnboardingWizard`, `ImportProdutosDialog`
- **Risco:** mínimo. Reversível.

### Fase 3 — Custo + margem visíveis no cadastro
**B. Card de custo/margem em tempo real no produto**
- Componente novo `CustoMargemCard` exibindo: custo da ficha, margem por canal cadastrado, alerta se preço < custo
- Aparece na tela de Produtos (ao lado/abaixo do preço) e dentro de FichaTecnicaDialog
- **Risco:** baixo (componente novo, não altera fluxo existente).

**C. Ficha técnica inline no card do produto**
- Já existe `FichaTecnicaForm`; passar de modal para expansível inline no `ProductCard` (accordion)
- Modal continua disponível como fallback
- **Risco:** médio (mexe no card do produto).

### Fase 4 — Wizard guiado
**D. Wizard de novo produto (3 passos)**
- Passo 1: Identificação (nome, categoria, imagem)
- Passo 2: Ficha técnica (mostra custo somando)
- Passo 3: Preços por canal (margem ao vivo + alerta)
- Substitui o dialog atual de "Novo Produto" apenas no botão "+ Novo Produto"
- Edição continua no fluxo atual
- **Risco:** baixo (componente novo).

### Fase 5 — Alerta proativo de custo
**F. Notificação quando custo do insumo sobe X%**
- Trigger no banco: ao mudar `insumos.custo_unitario`, calcular impacto nos produtos que usam o insumo
- Se margem ficar < `margem_desejada_padrao × 0.7`, gerar registro em tabela `alertas_custo` (nova)
- Mostrar badge no menu Precificação + lista no `AlertasInteligentes` do dashboard
- **Risco:** médio (cria tabela nova + trigger).

### Fase 6 — A "pesada": aposentar `preco_venda` da UI
**A.2. Migrar todas as leituras de `produto.preco_venda` para `precos_canais` (com fallback)**
- Criar helper `getPrecoCanal(produto, canalId, fallbackBalcao=true)` em `src/lib/precificacaoUtils.ts`
- Substituir uso em todos os 50+ arquivos por esse helper
- **Locais críticos a revisar:**
  - **Vendas**: `VendaRapidaSheet`, `LancamentosManuais`, `ImportarVendasDialog`, `importUtils` (cálculo unidades vendidas em `get_top_produtos` RPC usa `preco_venda` — manter)
  - **Cardápio digital**: `ProductCard`, `ProductDetailModal`, `CartStep`, `CheckoutDrawer` → usar preço do canal "Cardápio Digital" ou Balcão
  - **Encomendas**: `EncomendaFormDialog` → usar canal selecionado
  - **Dashboard/Relatórios**: `useDashboardData`, `DREGerencial`, `MargensRelatorio`, `MargemEvolutionChart` → continuam lendo `preco_venda` (espelho do Balcão) sem problema
  - **RPCs (`get_dashboard_vendas`, `get_top_produtos`)**: continuam funcionais via espelho
  - **Precificação**: `useMenuEngineering`, `ProdutoListaCompacta`, etc. — usar canal "ativo" selecionado pelo usuário

**A.3. Trigger de espelhamento no banco**
- Trigger em `precos_canais`: ao inserir/atualizar preço do canal Balcão (tipo=presencial), atualizar `produtos.preco_venda`
- Trigger em `produtos`: ao inserir produto novo sem preço, criar `precos_canais` para Balcão com valor padrão 0 (ou pedir no wizard)

**A.4. Esconder campo `preco_venda` do form de produto**
- Remover input "Preço de Venda" do dialog de novo/editar produto
- Substituir por botão "Definir preços por canal" que abre `PrecosCanaisEditor`

**Risco:** alto. Vai exigir validação cuidadosa em: criar venda, importar venda 99/iFood, pedido pelo cardápio, encomenda, relatórios, dashboard.

---

## Estratégia de validação a cada fase

Após cada fase eu valido na base demo (`demo@gastrogestor.com.br`) com queries SQL + screenshot da tela, e te mostro os números antes/depois antes de seguir. Você dá o "ok" e eu sigo.

---

## Detalhes técnicos relevantes

**Tabelas envolvidas:**
- `produtos` (coluna `preco_venda` — mantida como espelho)
- `precos_canais` (`produto_id`, `canal`, `preco`)
- `canais_venda` (tipo `presencial` = Balcão)
- `vendas` (histórico — não mexer)

**Novas peças:**
- `src/lib/precificacaoUtils.ts` → `getPrecoCanal()`, `getPrecoBalcao()`, `getCustoFicha()`
- `src/components/produtos/CustoMargemCard.tsx`
- `src/components/produtos/NovoProdutoWizard.tsx`
- Migration: trigger `sync_preco_venda_balcao`, tabela `alertas_custo`

**Compatibilidade preservada:**
- RPCs `get_dashboard_vendas`, `get_top_produtos`, `get_saldo_caixa` → não tocadas
- Vendas históricas → não tocadas
- `setup-demo-user`, `populate-demo-data`, `migrate-base` → continuam criando `preco_venda` (servirá como Balcão inicial)

---

## Próximo passo

Se aprovar, começo pela **Fase 1 (E)** que é a mais isolada e já valida o conceito de "margem ponderada por vendas reais" na demo. Confirma a estratégia geral de **não dropar** `preco_venda` e seguir nessa ordem?
