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
  cliente: string | null;
  total_geral: number;
  itens: SaleItem[];
}

// Process image with AI to extract sales data
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
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um extrator de dados de comandas, cupons fiscais, recibos e relatórios de vendas.

Analise a imagem e extraia TODOS OS ITENS INDIVIDUAIS vendidos.

Retorne APENAS um JSON válido no seguinte formato:
{
  "tipo": "comanda",
  "plataforma": "nome da plataforma ou estabelecimento",
  "data": "${currentDate}",
  "cliente": "nome do cliente se identificável ou null",
  "total_geral": 194.50,
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
1. Extraia CADA ITEM INDIVIDUALMENTE - se há 7 "Copo da Felicidade", liste 7 itens separados OU 1 item com quantidade 7
2. Para cada item, identifique: nome do produto, quantidade, valor unitário e valor total
3. Se o item aparecer múltiplas vezes com (1) antes, trate cada linha como 1 unidade
4. Use a data de hoje (${currentDate}) se não houver data visível
5. O tipo é "comanda" para cupons/comandas e "relatorio" para relatórios de apps
6. Identifique o nome do cliente se visível
7. NÃO agrupe itens iguais - cada linha de produto deve ser um item separado
8. Retorne APENAS o JSON, sem explicações, sem markdown, sem \`\`\`

EXEMPLOS DE ITENS A EXTRAIR:
- "(1) Copo da Felicidade Mulan (300ml) R$ 29,60" → { "produto": "Copo da Felicidade Mulan (300ml)", "quantidade": 1, "valor_unitario": 29.60, "valor_total": 29.60 }
- "2x Pizza Margherita R$ 50,00" → { "produto": "Pizza Margherita", "quantidade": 2, "valor_unitario": 25.00, "valor_total": 50.00 }`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia TODOS os itens individuais desta comanda/cupom/relatório. Liste cada produto separadamente:" },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("AI API error:", response.status, error);
    throw new Error(`Failed to process image with AI: ${response.status}`);
  }

  const responseText = await response.text();
  console.log("AI raw response text:", responseText);
  
  if (!responseText || responseText.trim() === '') {
    console.error("AI returned empty response");
    throw new Error("AI returned empty response");
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error("Failed to parse AI response as JSON:", parseError, "Response:", responseText);
    throw new Error("Invalid JSON response from AI");
  }

  // Check if the AI returned an error
  if (data.error) {
    console.error("AI returned error:", data.error);
    throw new Error(`AI error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const content = data.choices?.[0]?.message?.content || '';
  
  if (!content) {
    console.error("AI returned no content in choices:", JSON.stringify(data));
    throw new Error("AI returned no content");
  }
  
  console.log("AI content:", content.substring(0, 500));
  
  // Try to extract JSON from the response
  try {
    // Remove markdown code blocks if present
    let cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as SalesData;
      console.log("Parsed data:", JSON.stringify(parsed, null, 2));
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e, "Content:", content);
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth error:", userError);
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

    console.log("Processing image...");
    const parsedData = await processImageWithAI(content);
    console.log("Parsed result:", parsedData);
    
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
