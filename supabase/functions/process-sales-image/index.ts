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
  data: string | null;
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
          content: `Você é um extrator de dados de comandas, cupons, recibos e prints de pedidos de plataformas como iFood, 99Food, Rappi, Brendi, Anota AI etc.

Leia a imagem com atenção e transcreva os dados. NÃO invente valores.

Retorne APENAS um JSON válido neste formato:
{
  "tipo": "comanda",
  "plataforma": "iFood",
  "canal_proprio": false,
  "data": "2026-07-06 ou null",
  "data_texto": "texto da data como aparece (ex: '06 de jul 22:19') ou null",
  "numero_pedido": "#4A5B ou null",
  "cliente": "nome do cliente ou null",
  "telefone_cliente": "telefone do cliente ou null",
  "subtotal": 194.50,
  "taxa_entrega": 0,
  "entrega_por": "loja | plataforma | null",
  "taxa_servico": 0.99,
  "descontos": [ { "texto": "Incentivos iFood", "valor": 10.00 } ],
  "incentivos_plataforma": 10.00,
  "incentivos_loja": 5.00,
  "forma_pagamento": "pix | credito | debito | dinheiro | online | vale_refeicao | null",
  "cobrar_do_cliente": 0,
  "total_geral": 180.49,
  "itens": [
    {
      "produto": "Nome do Produto",
      "quantidade": 1,
      "valor_unitario": 29.60,
      "valor_total": 29.60,
      "componentes": []
    }
  ]
}

REGRAS:
1. Cada linha de produto vendida é um item. Quantidade "(1)" ou "1x" = 1.
2. DATA: preencha "data" (AAAA-MM-DD) SOMENTE se a data com ano estiver escrita. Se aparecer só dia e mês (ex: "06 de jul 22:19", "28 de fev"), coloque "data": null e copie o texto em "data_texto". Se não houver data nenhuma, os dois ficam null. NUNCA use a data de hoje.
3. "subtotal" = soma dos itens antes de descontos e taxas, como está no comprovante.
4. "taxa_entrega" = taxa de entrega cobrada do cliente (0 se grátis). "entrega_por": "loja" se o comprovante indicar entrega própria/da loja; "plataforma" se a entrega for feita pela plataforma (ex: "Entrega iFood", "entregador parceiro"); null se não estiver claro.
5. "taxa_servico" = taxa de serviço cobrada do cliente pela plataforma.
6. "descontos": liste CADA linha de desconto/incentivo/cupom separadamente, com o texto EXATO do comprovante e o valor positivo. Inclua "Entrega promocional para cliente" quando aparecer com valor.
7. "incentivos_plataforma" e "incentivos_loja": seu melhor palpite da soma (o sistema reclassifica pelo texto de "descontos").
8. "forma_pagamento": como o cliente pagou. "cobrar_do_cliente": valor que o entregador deve cobrar na entrega ("Cobrar do cliente R$ X"); 0 se o pedido foi pago online.
9. "canal_proprio": true para cardápio próprio (Brendi, Anota AI, Goomer, cardápio digital da loja, WhatsApp); false para iFood, 99Food, Rappi, Keeta.
10. COMBOS: quando um item for um combo/promoção com produtos dentro (ex: "Compre 2 Leve 4" com quatro copos listados abaixo), o combo é o item com o valor cheio, e os produtos de dentro vão em "componentes" como { "produto": "Copo da Felicidade Mulan 300ml", "quantidade": 1 }. NÃO crie itens separados para os produtos de dentro e não some o valor deles. Adicionais pagos já estão no valor do combo. A opção de tamanho (200ml, 300ml) entra no nome do componente.
11. Complementos de montagem (sabores, frutas, cremes, coberturas do açaí) NÃO são itens nem componentes: acrescente ao nome do item entre parênteses.
12. Campo não encontrado: use 0 (valores) ou null (textos).
13. Retorne APENAS o JSON, sem explicações e sem markdown.

EXEMPLOS DE ITENS:
- "(1) Copo da Felicidade Mulan (300ml) R$ 29,60" → { "produto": "Copo da Felicidade Mulan (300ml)", "quantidade": 1, "valor_unitario": 29.60, "valor_total": 29.60, "componentes": [] }
- "2x Pizza Margherita R$ 50,00" → { "produto": "Pizza Margherita", "quantidade": 2, "valor_unitario": 25.00, "valor_total": 50.00, "componentes": [] }`
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
      (parsed as any).descontos = Array.isArray((parsed as any).descontos) ? (parsed as any).descontos : [];
      parsed.itens = (parsed.itens || []).map((i: any) => ({ ...i, componentes: Array.isArray(i.componentes) ? i.componentes : [] }));
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
