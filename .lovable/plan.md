# Plano Mestre — Auditoria Precificação & Ficha Técnica

**Objetivo:** fechar todas as falhas críticas, importantes e melhorias de UX da auditoria, garantindo que nenhum cálculo silencioso comprometa a precificação do usuário.

**Princípios:** uma fase por vez → migration → código → validação visual/funcional → próxima fase. Nada de mexer em tudo junto.

---

## FASE 1 — Fundação no Banco (schema crítico)

Migração única que destrava as 4 falhas mais graves. Sem essa base, o resto não fecha.

1. **`fichas_tecnicas.unidade`** (TEXT) — unidade da quantidade lançada (ex: `g`, `kg`, `ml`, `L`, `un`). Default = unidade do insumo.
2. **`insumos.fator_perda`** (NUMERIC default 0) — % de perda no processamento (cebola descascada, peixe limpo etc).
3. **`vendas.custo_snapshot`** (NUMERIC) — custo da ficha **congelado** no momento da venda. Trigger `BEFORE INSERT` calcula e grava.
4. **`receitas_intermediarias.custo_unitario`** (NUMERIC) — custo da sub-receita pré-calculado. Trigger recalcula quando muda a composição ou o custo de um insumo componente.
5. **Função SQL `converter_unidade(qtd, de, para)`** — kg↔g, L↔ml, un↔un. Erro explícito se incompatível.
6. **Função SQL central `calcular_custo_ficha(produto_id)`** — única fonte da verdade, considera unidade + fator_perda + sub-receitas explodidas.
7. **Trigger `baixar_estoque_venda` v2** — explode sub-receitas até o insumo base.
8. **Trigger CMP v2** — quando custo de insumo muda, recalcula `receitas_intermediarias.custo_unitario` em cascata.

**Validação:** rodar `SELECT calcular_custo_ficha(...)` em produtos reais e comparar com cálculo manual.

---

## FASE 2 — Hooks e Utils centralizados (frontend)

Eliminar as 6+ duplicações da fórmula `Σ(qt × custo)` e padronizar nomenclatura.

- Criar `src/utils/custoFicha.ts` com `calcularCustoFicha(ficha, insumos)` que respeita unidade + fator_perda + sub-receitas.
- Refatorar `useMenuEngineering`, `ProductCard`, `ProdutoListaCompacta`, `ProdutoDetalheDrawer`, `useFichaTecnica` para usar essa função.
- Renomear `lucroLiquido` → `margemContribuicao` em `precificacaoUtils.ts` (alias deprecated por 1 release).
- Remover fallback arbitrário `custo × 2/3`; quando inviável, retornar `null` e mostrar mensagem clara na UI.
- Hook `useTaxasCanais` com `.eq('empresa_id', ...)` explícito (defesa em profundidade além do RLS).

**Validação:** abrir produto, ficha técnica, lista de preços — todos os 3 lugares devem mostrar o mesmo custo até o centavo.

---

## FASE 3 — Ficha Técnica reformulada (UI)

Onde o usuário sente.

- Campo **unidade** na linha do insumo (Select: opções compatíveis com a unidade do insumo).
- Campo **fator de perda** (%) no cadastro do insumo (com tooltip explicativo + exemplos).
- Campo **rendimento** editável no produto (`rendimento_padrao`), com label "Esta ficha rende X unidades".
- Indicador visual de custo recalculado em tempo real (com breakdown: insumos + sub-receitas + perda).
- Aviso quando insumo da ficha foi deletado (`ft.insumo` nulo) — bloqueia salvar.
- Conversão automática mostrada inline ("250 g de farinha = R$ 1,25").

**Validação:** cadastrar produto com farinha em g, manteiga em g, ovos em un → custo bate com cálculo manual.

---

## FASE 4 — Sub-receitas funcionais (Receitas Intermediárias)

- UI para gerenciar sub-receitas (já existe a tabela `receitas_intermediarias` mas precisa do CRUD completo).
- Permitir adicionar sub-receita como item na ficha técnica do produto.
- Card mostrando "Custo desta sub-receita: R$ X / rendimento Y".
- Validação visual: produto que usa sub-receita mostra árvore de composição.

**Validação:** criar "Ganache" → usar em "Bolo de Chocolate" → vender 1 bolo → verificar baixa de cacau/creme/açúcar no estoque.

---

## FASE 5 — UX da Precificação + KPIs novos

- **Confirmação** ao aplicar preço com variação > 10% (dialog com antes/depois e impacto na margem).
- **Filtro de período** no BCG: 7d / 30d / 90d / sazonal.
- **Categoria visual "Novo / Sem dados"** no Menu Engineering (não classifica como Cão).
- Renderizar **MatrizScatter** (já existe no código mas não está montada).
- **Pricing Score 0-100** por produto: KPI único combinando margem, CMV, popularidade e impacto de custo.
- **Prime Cost widget**: CMV% + Mão de Obra% (puxa de configurações).
- **Theoretical vs Actual Food Cost**: comparativo do que deveria custar (ficha) vs custo real (baixa de estoque).
- **Charm pricing**: depois do preço sugerido, oferecer arredondamentos psicológicos (R$ 22,90 / 24,90).
- Estado vazio: botão direto "Criar ficha do primeiro produto".
- Mensagem clara quando inviável: "Margem 30% + Imposto 10% + Taxa 25% = 65%, restam 35% para custo. Reduza taxa ou aceite margem menor."
- Remover `src/components/precificacao/` v1 (dead code).
- Aumentar limite de 50% no `ImpactoReajusteReport`.

**Validação:** percorrer toda a tela de Precificação com olhar de usuário leigo, sem encontrar dúvida ou cálculo divergente.

---

## Detalhes técnicos críticos

### Conversão de unidades (Fase 1)
```text
kg ↔ g     × 1000
L  ↔ ml    × 1000
un ↔ un    × 1
incompatível (ex: kg → ml) → RAISE EXCEPTION
```

### Fórmula central da ficha (Fase 1)
```text
custo_item = quantidade_convertida × custo_unitario / (1 - fator_perda)
custo_ficha = Σ custo_item (insumos diretos)
            + Σ (qtd_sub × custo_unitario_sub_receita)
custo_unitario_produto = custo_ficha / rendimento_padrao
```

### Snapshot na venda (Fase 1)
```text
BEFORE INSERT ON vendas:
  IF NEW.produto_id IS NOT NULL AND NEW.custo_snapshot IS NULL:
    NEW.custo_snapshot := calcular_custo_ficha(NEW.produto_id) * NEW.quantidade
```

### Propagação CMP (Fase 1)
```text
AFTER UPDATE OF custo_unitario ON insumos:
  → recalcula custo de todas receitas_intermediarias que usam este insumo
  → trigger nas receitas_intermediarias propaga para sub-receitas que a usam
  → (já existente) detectar_impacto_custo_insumo continua disparando alertas
```

---

## Ordem de execução

| Fase | Risco | Tempo estimado | Bloqueia |
|------|-------|----------------|----------|
| 1. Schema + triggers | Alto (mexe em vendas/estoque) | 1 sessão | Tudo |
| 2. Utils centralizados | Baixo (refactor) | 1 sessão | Fase 3 |
| 3. UI Ficha Técnica | Médio | 1-2 sessões | Fase 4 |
| 4. Sub-receitas UI | Médio | 1 sessão | — |
| 5. UX Precificação | Baixo | 1-2 sessões | — |

Ao final de cada fase, eu paro, valido com você no preview e só então sigo.

**Confirma esse roteiro? Posso começar pela Fase 1 (migração crítica de schema + triggers).**