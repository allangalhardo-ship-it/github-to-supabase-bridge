import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tabelas principais para backup
const TABLES_TO_BACKUP = [
  'empresas',
  'usuarios',
  'insumos',
  'produtos',
  'fichas_tecnicas',
  'vendas',
  'producoes',
  'estoque_movimentos',
  'custos_fixos',
  'clientes',
  'pedidos',
  'canais_venda',
  'precos_canais',
  'configuracoes',
  'receitas_intermediarias',
  'historico_precos',
  'historico_precos_produtos',
];

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Backup] Iniciando backup do banco de dados...');

    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];

    // Exportar cada tabela
    for (const table of TABLES_TO_BACKUP) {
      try {
        console.log(`[Backup] Exportando tabela: ${table}`);
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(10000); // Limite de segurança

        if (error) {
          console.error(`[Backup] Erro na tabela ${table}:`, error.message);
          errors.push(`${table}: ${error.message}`);
        } else {
          backupData[table] = data || [];
          console.log(`[Backup] ${table}: ${data?.length || 0} registros`);
        }
      } catch (tableError) {
        console.error(`[Backup] Exceção na tabela ${table}:`, tableError);
        errors.push(`${table}: ${tableError}`);
      }
    }

    // Criar o arquivo de backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.json`;

    const backupContent = JSON.stringify({
      timestamp: new Date().toISOString(),
      tables: TABLES_TO_BACKUP,
      totalRecords: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
      errors: errors.length > 0 ? errors : undefined,
      data: backupData,
    }, null, 2);

    console.log(`[Backup] Salvando backup: ${fileName}`);

    // Upload para o bucket
    const { error: uploadError } = await supabase.storage
      .from('database-backups')
      .upload(fileName, backupContent, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Erro ao salvar backup: ${uploadError.message}`);
    }

    // Limpar backups antigos (manter últimos 4 = 1 mês)
    console.log('[Backup] Verificando backups antigos...');
    const { data: existingFiles } = await supabase.storage
      .from('database-backups')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (existingFiles && existingFiles.length > 4) {
      const filesToDelete = existingFiles.slice(4).map(f => f.name);
      console.log(`[Backup] Removendo ${filesToDelete.length} backups antigos`);
      
      await supabase.storage
        .from('database-backups')
        .remove(filesToDelete);
    }

    const result = {
      success: true,
      fileName,
      timestamp: new Date().toISOString(),
      tablesBackedUp: TABLES_TO_BACKUP.length,
      totalRecords: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('[Backup] Backup concluído com sucesso:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[Backup] Erro fatal:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
