import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaleItem {
  produto: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface SalesData {
  tipo: 'comanda' | 'relatorio';
  plataforma: string;
  data: string;
  numero_pedido: string | null;
  cliente: string | null;
  subtotal: number;
  taxa_entrega: number;
  taxa_servico: number;
  incentivos_plataforma: number;
  incentivos_loja: number;
  total_geral: number;
  itens: SaleItem[];
}

async function processImageWithAI(imageBase64: string): Promise<SalesData | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const currentDate = new Date().toISOString().split('T')[0];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Você é um extrator de dados de comandas, cupons fiscais, recibos e relatórios de vendas de plataformas como iFood, 99Food, Rappi, etc.

Analise a imagem e extraia TODOS OS ITENS INDIVIDUAIS vendidos, além do BREAKDOWN FINANCEIRO COMPLETO.

Retorne APENAS um JSON válido no seguinte formato:
{
  "tipo": "comanda",
  "plataforma": "iFood",
  "data": "${currentDate}",
  "numero_pedido": "#4A5B ou null",
  "cliente": "nome do cliente ou null",
  "subtotal": 194.50,
  "taxa_entrega": 0,
  "taxa_servico": 0.99,
  "incentivos_plataforma": 10.00,
  "incentivos_loja": 5.00,
  "total_geral": 180.49,
  "itens": [
    {
      "produto": "Nome do Produto",
      "quantidade": 1,
      "valor_unitario": 29.60,
      "valor_total": 29.60
    }
  ]
}

REGRAS CRÍTICAS:
1. Extraia CADA ITEM INDIVIDUALMENTE - cada linha de produto é um item separado
2. Para cada item: nome, quantidade, valor unitário e valor total
3. Se o item tem "(1)" antes, quantidade = 1
4. Use a data de hoje (${currentDate}) se não houver data visível
5. O tipo é "comanda" para cupons/comandas e "relatorio" para relatórios de apps

BREAKDOWN FINANCEIRO (MUITO IMPORTANTE):
6. "subtotal" = soma dos itens ANTES de descontos/taxas
7. "taxa_entrega" = taxa de entrega cobrada do cliente (0 se "Grátis")
8. "taxa_servico" = taxa de serviço da plataforma (geralmente R$ 0,99 ou similar)
9. "incentivos_plataforma" = desconto BANCADO PELA PLATAFORMA (ex: "Incentivos iFood"). NÃO reduz o que o vendedor recebe.
10. "incentivos_loja" = desconto BANCADO PELA LOJA (ex: "Incentivos e cobrança da loja"). REDUZ o que o vendedor recebe.
11. "total_geral" = valor final pago pelo cliente
12. Se não encontrar algum campo financeiro, use 0
13. "numero_pedido" = número/código do pedido se visível (ex: "#4A5B", "Pedido 123")
14. "cliente" = nome do cliente se visível

DIFERENÇA CRÍTICA ENTRE INCENTIVOS:
- "Incentivos iFood" ou "Cupom iFood" → incentivos_plataforma (o iFood paga, o vendedor NÃO perde dinheiro)
- "Incentivos da loja" ou "Cupom da loja" ou "Desconto da loja" → incentivos_loja (o VENDEDOR paga, sai do seu bolso)

15. Retorne APENAS o JSON, sem explicações, sem markdown, sem \`\`\`

EXEMPLOS DE ITENS:
- "(1) Copo da Felicidade Mulan (300ml) R$ 29,60" → { "produto": "Copo da Felicidade Mulan (300ml)", "quantidade": 1, "valor_unitario": 29.60, "valor_total": 29.60 }
- "2x Pizza Margherita R$ 50,00" → { "produto": "Pizza Margherita", "quantidade": 2, "valor_unitario": 25.00, "valor_total": 50.00 }`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia TODOS os itens e o BREAKDOWN FINANCEIRO COMPLETO (subtotal, taxas, incentivos da plataforma vs da loja, total):" },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("AI API error:", response.status, error);
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Tente novamente em alguns segundos.");
    }
    if (response.status === 402) {
      throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    }
    throw new Error(`Failed to process image with AI: ${response.status}`);
  }

  const responseText = await response.text();
  console.log("AI raw response length:", responseText.length);
  
  if (!responseText || responseText.trim() === '') {
    throw new Error("AI returned empty response");
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("Failed to parse AI response as JSON");
    throw new Error("Invalid JSON response from AI");
  }

  if (data.error) {
    throw new Error(`AI error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const content = data.choices?.[0]?.message?.content || '';
  
  if (!content) {
    throw new Error("AI returned no content");
  }
  
  console.log("AI content preview:", content.substring(0, 300));
  
  try {
    let cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as SalesData;
      // Ensure all financial fields have defaults
      parsed.subtotal = parsed.subtotal || 0;
      parsed.taxa_entrega = parsed.taxa_entrega || 0;
      parsed.taxa_servico = parsed.taxa_servico || 0;
      parsed.incentivos_plataforma = parsed.incentivos_plataforma || 0;
      parsed.incentivos_loja = parsed.incentivos_loja || 0;
      parsed.numero_pedido = parsed.numero_pedido || null;
      console.log("Parsed data with financial breakdown:", JSON.stringify({
        subtotal: parsed.subtotal,
        taxa_entrega: parsed.taxa_entrega,
        taxa_servico: parsed.taxa_servico,
        incentivos_plataforma: parsed.incentivos_plataforma,
        incentivos_loja: parsed.incentivos_loja,
        total_geral: parsed.total_geral,
        itens_count: parsed.itens?.length
      }));
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Autenticação necessária.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Token inválido ou expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { content } = await req.json();
    
    if (!content) {
      return new Response(
        JSON.stringify({ success: false, message: 'Imagem não fornecida.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Processing image for user:", user.id);
    const parsedData = await processImageWithAI(content);
    
    if (parsedData && parsedData.itens && parsedData.itens.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: parsedData,
          message: `${parsedData.itens.length} itens encontrados.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          data: parsedData,
          message: "Não foi possível extrair itens da imagem. Certifique-se de que é uma imagem clara de uma comanda, cupom ou relatório de vendas." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error processing sales image:", error);
    const message = error instanceof Error ? error.message : "Erro ao processar imagem de vendas.";
    return new Response(
      JSON.stringify({ success: false, message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
