import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: backupData } = await req.json();
    
    if (!backupData || !backupData.data) {
      throw new Error("Dados de backup inválidos");
    }

    const results: Record<string, { success: number; errors: string[] }> = {};
    
    // Ordem de importação respeitando foreign keys
    const tableOrder = [
      "empresas",
      "usuarios", 
      "insumos",
      "produtos",
      "fichas_tecnicas",
      "canais_venda",
      "precos_canais",
      "clientes",
      "configuracoes",
      "custos_fixos",
      "receitas_intermediarias",
      "historico_precos",
      "historico_precos_produtos",
      // Estas tabelas têm triggers, importar por último
      // "vendas",
      // "producoes", 
      // "estoque_movimentos",
      // "pedidos"
    ];

    for (const tableName of tableOrder) {
      const tableData = backupData.data[tableName];
      
      if (!tableData || tableData.length === 0) {
        results[tableName] = { success: 0, errors: [] };
        continue;
      }

      results[tableName] = { success: 0, errors: [] };

      // Inserir em lotes de 50
      const batchSize = 50;
      for (let i = 0; i < tableData.length; i += batchSize) {
        const batch = tableData.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from(tableName)
          .upsert(batch, { 
            onConflict: "id",
            ignoreDuplicates: false 
          });

        if (error) {
          results[tableName].errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
        } else {
          results[tableName].success += batch.length;
        }
      }
    }

    // Importar tabelas com triggers desabilitando temporariamente (não temos acesso via RPC)
    // Por isso, vamos importar estoque_movimentos sem trigger
    const movementTables = ["estoque_movimentos", "vendas", "producoes", "pedidos"];
    
    for (const tableName of movementTables) {
      const tableData = backupData.data[tableName];
      
      if (!tableData || tableData.length === 0) {
        results[tableName] = { success: 0, errors: ["Nenhum dado para importar"] };
        continue;
      }

      results[tableName] = { success: 0, errors: [] };

      // Inserir em lotes menores para evitar conflitos de trigger
      const batchSize = 20;
      for (let i = 0; i < tableData.length; i += batchSize) {
        const batch = tableData.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from(tableName)
          .upsert(batch, { 
            onConflict: "id",
            ignoreDuplicates: true 
          });

        if (error) {
          results[tableName].errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
        } else {
          results[tableName].success += batch.length;
        }
      }
    }

    const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação concluída: ${totalSuccess} registros importados, ${totalErrors} erros`,
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro na importação:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
