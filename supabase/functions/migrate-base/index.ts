import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MigrationResult {
  insumos: { copied: number; updated: number; skipped: number };
  receitasIntermediarias: { copied: number; updated: number; skipped: number };
  produtos: { copied: number; updated: number; skipped: number };
  fichasTecnicas: { copied: number; skipped: number };
  precosCanais: { copied: number; updated: number; skipped: number };
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso negado - apenas admins' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, empresaOrigemId, empresaDestinoId } = await req.json();

    // ACTION: Preview - retorna contagens antes de migrar
    if (action === 'preview') {
      console.log(`[migrate-base] Preview: ${empresaOrigemId} -> ${empresaDestinoId}`);

      const [insumosRes, produtosRes, fichasRes, receitasRes, precosRes] = await Promise.all([
        supabase.from('insumos').select('id', { count: 'exact' }).eq('empresa_id', empresaOrigemId).eq('is_intermediario', false),
        supabase.from('produtos').select('id', { count: 'exact' }).eq('empresa_id', empresaOrigemId),
        supabase.from('fichas_tecnicas').select('id, produto_id', { count: 'exact' }).in('produto_id', 
          (await supabase.from('produtos').select('id').eq('empresa_id', empresaOrigemId)).data?.map(p => p.id) || []
        ),
        supabase.from('insumos').select('id', { count: 'exact' }).eq('empresa_id', empresaOrigemId).eq('is_intermediario', true),
        supabase.from('precos_canais').select('id', { count: 'exact' }).eq('empresa_id', empresaOrigemId),
      ]);

      return new Response(JSON.stringify({
        preview: {
          insumos: insumosRes.count || 0,
          receitasIntermediarias: receitasRes.count || 0,
          produtos: produtosRes.count || 0,
          fichasTecnicas: fichasRes.count || 0,
          precosCanais: precosRes.count || 0,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Migrate - executa a migração
    if (action === 'migrate') {
      console.log(`[migrate-base] Migrating: ${empresaOrigemId} -> ${empresaDestinoId}`);

      const result: MigrationResult = {
        insumos: { copied: 0, updated: 0, skipped: 0 },
        receitasIntermediarias: { copied: 0, updated: 0, skipped: 0 },
        produtos: { copied: 0, updated: 0, skipped: 0 },
        fichasTecnicas: { copied: 0, skipped: 0 },
        precosCanais: { copied: 0, updated: 0, skipped: 0 },
      };

      // Maps para relacionar IDs antigos com novos
      const insumoIdMap = new Map<string, string>();
      const produtoIdMap = new Map<string, string>();

      // ========== 1. MIGRAR INSUMOS SIMPLES ==========
      console.log('[migrate-base] Step 1: Migrando insumos simples...');
      
      const { data: insumosOrigem } = await supabase
        .from('insumos')
        .select('*')
        .eq('empresa_id', empresaOrigemId)
        .eq('is_intermediario', false);

      const { data: insumosDestino } = await supabase
        .from('insumos')
        .select('id, nome')
        .eq('empresa_id', empresaDestinoId);

      const insumosDestinoMap = new Map(
        (insumosDestino || []).map(i => [normalizeString(i.nome), i.id])
      );

      for (const insumo of insumosOrigem || []) {
        const normalizedNome = normalizeString(insumo.nome);
        const existingId = insumosDestinoMap.get(normalizedNome);

        if (existingId) {
          // Sobrescrever
          const { error } = await supabase
            .from('insumos')
            .update({
              unidade_medida: insumo.unidade_medida,
              custo_unitario: insumo.custo_unitario,
              estoque_minimo: insumo.estoque_minimo,
            })
            .eq('id', existingId);

          if (!error) {
            result.insumos.updated++;
            insumoIdMap.set(insumo.id, existingId);
          }
        } else {
          // Criar novo
          const { data: newInsumo, error } = await supabase
            .from('insumos')
            .insert({
              empresa_id: empresaDestinoId,
              nome: insumo.nome,
              unidade_medida: insumo.unidade_medida,
              custo_unitario: insumo.custo_unitario,
              estoque_atual: 0, // Não copiar estoque
              estoque_minimo: insumo.estoque_minimo,
              is_intermediario: false,
            })
            .select('id')
            .single();

          if (!error && newInsumo) {
            result.insumos.copied++;
            insumoIdMap.set(insumo.id, newInsumo.id);
          }
        }
      }

      console.log(`[migrate-base] Insumos: ${result.insumos.copied} copiados, ${result.insumos.updated} atualizados`);

      // ========== 2. MIGRAR RECEITAS INTERMEDIÁRIAS ==========
      console.log('[migrate-base] Step 2: Migrando receitas intermediárias...');

      const { data: receitasOrigem } = await supabase
        .from('insumos')
        .select('*')
        .eq('empresa_id', empresaOrigemId)
        .eq('is_intermediario', true);

      for (const receita of receitasOrigem || []) {
        const normalizedNome = normalizeString(receita.nome);
        const existingId = insumosDestinoMap.get(normalizedNome);

        let receitaDestinoId: string;

        if (existingId) {
          // Atualizar receita existente
          await supabase
            .from('insumos')
            .update({
              unidade_medida: receita.unidade_medida,
              custo_unitario: receita.custo_unitario,
              rendimento_receita: receita.rendimento_receita,
            })
            .eq('id', existingId);
          
          receitaDestinoId = existingId;
          result.receitasIntermediarias.updated++;
          insumoIdMap.set(receita.id, existingId);

          // Deletar ingredientes antigos para recriar
          await supabase
            .from('receitas_intermediarias')
            .delete()
            .eq('insumo_id', existingId);
        } else {
          // Criar nova receita
          const { data: newReceita, error } = await supabase
            .from('insumos')
            .insert({
              empresa_id: empresaDestinoId,
              nome: receita.nome,
              unidade_medida: receita.unidade_medida,
              custo_unitario: receita.custo_unitario,
              estoque_atual: 0,
              estoque_minimo: receita.estoque_minimo,
              is_intermediario: true,
              rendimento_receita: receita.rendimento_receita,
            })
            .select('id')
            .single();

          if (!error && newReceita) {
            receitaDestinoId = newReceita.id;
            result.receitasIntermediarias.copied++;
            insumoIdMap.set(receita.id, newReceita.id);
          } else {
            continue;
          }
        }

        // Copiar ingredientes da receita
        const { data: ingredientes } = await supabase
          .from('receitas_intermediarias')
          .select('*')
          .eq('insumo_id', receita.id);

        for (const ing of ingredientes || []) {
          const ingredienteDestinoId = insumoIdMap.get(ing.insumo_ingrediente_id);
          if (ingredienteDestinoId) {
            await supabase.from('receitas_intermediarias').insert({
              insumo_id: receitaDestinoId,
              insumo_ingrediente_id: ingredienteDestinoId,
              quantidade: ing.quantidade,
            });
          }
        }
      }

      console.log(`[migrate-base] Receitas: ${result.receitasIntermediarias.copied} copiadas, ${result.receitasIntermediarias.updated} atualizadas`);

      // ========== 3. MIGRAR PRODUTOS ==========
      console.log('[migrate-base] Step 3: Migrando produtos...');

      const { data: produtosOrigem } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', empresaOrigemId);

      const { data: produtosDestino } = await supabase
        .from('produtos')
        .select('id, nome')
        .eq('empresa_id', empresaDestinoId);

      const produtosDestinoMap = new Map(
        (produtosDestino || []).map(p => [normalizeString(p.nome), p.id])
      );

      for (const produto of produtosOrigem || []) {
        const normalizedNome = normalizeString(produto.nome);
        const existingId = produtosDestinoMap.get(normalizedNome);

        if (existingId) {
          // Sobrescrever
          const { error } = await supabase
            .from('produtos')
            .update({
              preco_venda: produto.preco_venda,
              categoria: produto.categoria,
              rendimento_padrao: produto.rendimento_padrao,
              observacoes_ficha: produto.observacoes_ficha,
              ativo: produto.ativo,
              imagem_url: produto.imagem_url,
            })
            .eq('id', existingId);

          if (!error) {
            result.produtos.updated++;
            produtoIdMap.set(produto.id, existingId);
          }
        } else {
          // Criar novo
          const { data: newProduto, error } = await supabase
            .from('produtos')
            .insert({
              empresa_id: empresaDestinoId,
              nome: produto.nome,
              preco_venda: produto.preco_venda,
              categoria: produto.categoria,
              rendimento_padrao: produto.rendimento_padrao,
              observacoes_ficha: produto.observacoes_ficha,
              ativo: produto.ativo,
              imagem_url: produto.imagem_url,
              estoque_acabado: 0, // Não copiar estoque
            })
            .select('id')
            .single();

          if (!error && newProduto) {
            result.produtos.copied++;
            produtoIdMap.set(produto.id, newProduto.id);
          }
        }
      }

      console.log(`[migrate-base] Produtos: ${result.produtos.copied} copiados, ${result.produtos.updated} atualizados`);

      // ========== 4. MIGRAR FICHAS TÉCNICAS ==========
      console.log('[migrate-base] Step 4: Migrando fichas técnicas...');

      for (const [produtoOrigemId, produtoDestinoId] of produtoIdMap.entries()) {
        // Deletar fichas existentes do produto destino
        await supabase
          .from('fichas_tecnicas')
          .delete()
          .eq('produto_id', produtoDestinoId);

        // Buscar fichas do produto origem
        const { data: fichas } = await supabase
          .from('fichas_tecnicas')
          .select('*')
          .eq('produto_id', produtoOrigemId);

        for (const ficha of fichas || []) {
          const insumoDestinoId = insumoIdMap.get(ficha.insumo_id);
          if (insumoDestinoId) {
            const { error } = await supabase.from('fichas_tecnicas').insert({
              produto_id: produtoDestinoId,
              insumo_id: insumoDestinoId,
              quantidade: ficha.quantidade,
            });

            if (!error) {
              result.fichasTecnicas.copied++;
            }
          } else {
            result.fichasTecnicas.skipped++;
          }
        }
      }

      console.log(`[migrate-base] Fichas técnicas: ${result.fichasTecnicas.copied} copiadas, ${result.fichasTecnicas.skipped} puladas`);

      // ========== 5. MIGRAR PREÇOS DE CANAIS ==========
      console.log('[migrate-base] Step 5: Migrando preços de canais...');

      for (const [produtoOrigemId, produtoDestinoId] of produtoIdMap.entries()) {
        const { data: precos } = await supabase
          .from('precos_canais')
          .select('*')
          .eq('produto_id', produtoOrigemId);

        for (const preco of precos || []) {
          // Verificar se já existe
          const { data: existing } = await supabase
            .from('precos_canais')
            .select('id')
            .eq('produto_id', produtoDestinoId)
            .eq('canal', preco.canal)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('precos_canais')
              .update({ preco: preco.preco })
              .eq('id', existing.id);
            result.precosCanais.updated++;
          } else {
            const { error } = await supabase.from('precos_canais').insert({
              empresa_id: empresaDestinoId,
              produto_id: produtoDestinoId,
              canal: preco.canal,
              preco: preco.preco,
            });

            if (!error) {
              result.precosCanais.copied++;
            }
          }
        }
      }

      console.log(`[migrate-base] Preços canais: ${result.precosCanais.copied} copiados, ${result.precosCanais.updated} atualizados`);
      console.log('[migrate-base] Migração concluída com sucesso!');

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[migrate-base] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
