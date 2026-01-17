import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaleItem {
  data: string;
  valor: number;
  canal: string;
  status: string;
  descricao: string;
}

interface SalesData {
  plataforma: string;
  periodo: string;
  itens: SaleItem[];
  totalVendas: number;
}

// Process image with AI to extract sales data
async function processImageWithAI(imageBase64: string): Promise<SalesData | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um extrator de dados de relatórios de vendas de plataformas de delivery (iFood, Rappi, 99Food, Uber Eats, etc) e prints de pedidos.
Extraia os dados da imagem e retorne APENAS um JSON válido no seguinte formato:
{
  "plataforma": "nome da plataforma identificada (iFood, Rappi, etc)",
  "periodo": "período do relatório se identificável",
  "totalVendas": 0,
  "itens": [
    {
      "data": "YYYY-MM-DD",
      "valor": 25.90,
      "canal": "iFood",
      "status": "Concluído",
      "descricao": "ID do pedido ou descrição"
    }
  ]
}

REGRAS IMPORTANTES:
- Extraia TODAS as vendas/pedidos visíveis na imagem
- Para datas, converta para formato YYYY-MM-DD. Se só tiver dia/mês, use o ano atual
- Para valores, extraia o valor líquido (após taxas) se disponível, senão o valor total
- Para status, identifique se o pedido foi Concluído/Entregue ou Cancelado
- Só inclua vendas com status Concluído/Entregue/Finalizado
- Para o canal, identifique a plataforma (iFood, Rappi, 99Food, Uber Eats, etc)
- Se não conseguir ler algum campo, use string vazia ou 0
- Retorne APENAS o JSON, sem explicações ou markdown`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados de vendas desta imagem de relatório/print de pedidos:" },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("AI API error:", error);
    throw new Error("Failed to process image with AI");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Try to extract JSON from the response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SalesData;
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - require valid token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Autenticação necessária.' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate token and get user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, message: 'Token inválido ou expirado.' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Token is valid - proceed with processing
    const { content } = await req.json();
    
    if (!content) {
      return new Response(
        JSON.stringify({ success: false, message: 'Imagem não fornecida.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const parsedData = await processImageWithAI(content);
    
    if (parsedData && parsedData.itens && parsedData.itens.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: parsedData,
          message: `${parsedData.itens.length} vendas encontradas.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Não foi possível extrair dados de vendas da imagem. Certifique-se de que é uma imagem clara de um relatório de vendas ou print de pedidos." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error processing sales image:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Erro ao processar imagem de vendas." 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
