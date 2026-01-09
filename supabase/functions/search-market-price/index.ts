import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, category, city, state } = await req.json();

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY não configurada");
    }

    const searchQuery = `Qual o preço médio de venda de "${productName}"${category ? ` (categoria: ${category})` : ''} em ${city}, ${state}, Brasil? 
    Pesquise em sites de delivery como iFood, Rappi, e também em cardápios de restaurantes locais.
    Retorne:
    - Preço mínimo encontrado
    - Preço máximo encontrado  
    - Preço médio
    - Fontes consultadas`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "Você é um assistente especializado em pesquisa de preços de mercado para produtos alimentícios no Brasil. Sempre forneça dados específicos e cite as fontes. Responda em português brasileiro de forma estruturada."
          },
          {
            role: "user",
            content: searchQuery
          }
        ],
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API Perplexity: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Não foi possível obter informações de preço.";
    const citations = data.citations || [];

    return new Response(
      JSON.stringify({ 
        result: content,
        citations,
        productName,
        searchedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-market-price:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao pesquisar preços";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
