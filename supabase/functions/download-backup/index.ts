import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fileName } = await req.json();

    if (!fileName) {
      // Lista os arquivos disponíveis
      const { data: files, error: listError } = await supabase.storage
        .from('database-backups')
        .list('', { limit: 10, sortBy: { column: 'created_at', order: 'desc' } });

      if (listError) throw listError;

      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gera URL assinada válida por 1 hora
    const { data, error } = await supabase.storage
      .from('database-backups')
      .createSignedUrl(fileName, 3600);

    if (error) throw error;

    return new Response(JSON.stringify({ 
      signedUrl: data.signedUrl,
      fileName,
      expiresIn: '1 hora'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Download] Erro:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
