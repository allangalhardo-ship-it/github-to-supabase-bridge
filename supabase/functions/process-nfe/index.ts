import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NFeItem {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ean?: string;
}

interface NFeData {
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedor: {
    nome: string;
    cnpj: string;
  };
  valorTotal: number;
  itens: NFeItem[];
}

// Parse XML NFe
function parseXmlNfe(xmlContent: string): NFeData | null {
  try {
    // Extract basic info using regex (simplified parser for NFe structure)
    const getTagValue = (tag: string, content: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : '';
    };

    const numero = getTagValue('nNF', xmlContent);
    const serie = getTagValue('serie', xmlContent);
    const dataEmissao = getTagValue('dhEmi', xmlContent) || getTagValue('dEmi', xmlContent);
    const fornecedorNome = getTagValue('xNome', xmlContent);
    const fornecedorCnpj = getTagValue('CNPJ', xmlContent);
    const valorTotal = parseFloat(getTagValue('vNF', xmlContent) || '0');

    // Parse items
    const itens: NFeItem[] = [];
    const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/gi;
    let detMatch;
    
    while ((detMatch = detRegex.exec(xmlContent)) !== null) {
      const detContent = detMatch[1];
      const prodContent = detContent.match(/<prod>([\s\S]*?)<\/prod>/i)?.[1] || '';
      
      itens.push({
        codigo: getTagValue('cProd', prodContent),
        descricao: getTagValue('xProd', prodContent),
        unidade: getTagValue('uCom', prodContent),
        quantidade: parseFloat(getTagValue('qCom', prodContent) || '0'),
        valorUnitario: parseFloat(getTagValue('vUnCom', prodContent) || '0'),
        valorTotal: parseFloat(getTagValue('vProd', prodContent) || '0'),
        ean: getTagValue('cEAN', prodContent) || getTagValue('cEANTrib', prodContent),
      });
    }

    if (!numero && itens.length === 0) {
      return null;
    }

    return {
      numero,
      serie,
      dataEmissao,
      fornecedor: {
        nome: fornecedorNome,
        cnpj: fornecedorCnpj,
      },
      valorTotal,
      itens,
    };
  } catch (error) {
    console.error('Error parsing XML:', error);
    return null;
  }
}

// Process image with AI (OCR)
async function processImageWithAI(imageBase64: string): Promise<NFeData | null> {
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
          content: `Você é um extrator de dados de notas fiscais brasileiras (NFe/NFC-e/cupom fiscal).
Extraia os dados da imagem e retorne APENAS um JSON válido no seguinte formato:
{
  "numero": "número da nota",
  "dataEmissao": "YYYY-MM-DD",
  "fornecedor": { "nome": "nome do estabelecimento", "cnpj": "CNPJ" },
  "valorTotal": 123.45,
  "itens": [
    { "codigo": "código", "descricao": "descrição do produto", "unidade": "UN", "quantidade": 1, "valorUnitario": 10.00, "valorTotal": 10.00 }
  ]
}
Se não conseguir ler algum campo, use string vazia ou 0. Retorne APENAS o JSON, sem explicações.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados desta nota fiscal/cupom fiscal:" },
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
      return JSON.parse(jsonMatch[0]) as NFeData;
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }
  
  return null;
}

// Process NFe access key (44 digits)
async function processAccessKey(chave: string): Promise<{ message: string; data?: NFeData }> {
  // NFe access key format: 44 digits
  // Format: UF(2) + AAMM(4) + CNPJ(14) + MOD(2) + SERIE(3) + NUMERO(9) + TIPO(1) + CODIGO(8) + DV(1)
  
  if (!/^\d{44}$/.test(chave)) {
    return { message: "Chave de acesso inválida. Deve conter 44 dígitos." };
  }

  // Extract info from key
  const uf = chave.substring(0, 2);
  const aamm = chave.substring(2, 6);
  const cnpj = chave.substring(6, 20);
  const modelo = chave.substring(20, 22);
  const serie = chave.substring(22, 25);
  const numero = chave.substring(25, 34);

  // For now, return parsed info from the key itself
  // A full implementation would query SEFAZ API (requires certificate)
  return {
    message: "Chave validada. Para consulta completa, integração com API SEFAZ é necessária.",
    data: {
      numero: numero.replace(/^0+/, ''),
      serie: serie.replace(/^0+/, ''),
      dataEmissao: `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}-01`,
      fornecedor: {
        nome: '',
        cnpj: cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
      },
      valorTotal: 0,
      itens: [],
    }
  };
}

// Process QR Code URL
async function processQrCode(qrCodeUrl: string): Promise<{ message: string; data?: NFeData }> {
  // QR Code from NFC-e contains a URL like:
  // https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=...
  // Or the chave parameter directly
  
  try {
    const url = new URL(qrCodeUrl);
    const chave = url.searchParams.get('p') || url.searchParams.get('chNFe');
    
    if (chave && /^\d{44}$/.test(chave)) {
      return processAccessKey(chave);
    }
    
    return { 
      message: "URL do QR Code identificada. Para consulta completa, integração com API SEFAZ é necessária.",
      data: undefined
    };
  } catch {
    // Maybe it's just the key
    if (/^\d{44}$/.test(qrCodeUrl)) {
      return processAccessKey(qrCodeUrl);
    }
    return { message: "Formato de QR Code não reconhecido." };
  }
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
    const { type, content } = await req.json();
    
    let result: { success: boolean; data?: NFeData; message?: string } = { success: false };

    switch (type) {
      case 'xml':
        const parsedXml = parseXmlNfe(content);
        if (parsedXml) {
          result = { success: true, data: parsedXml };
        } else {
          result = { success: false, message: "Não foi possível processar o XML. Verifique se é um arquivo NFe válido." };
        }
        break;

      case 'image':
        const parsedImage = await processImageWithAI(content);
        if (parsedImage) {
          result = { success: true, data: parsedImage };
        } else {
          result = { success: false, message: "Não foi possível extrair dados da imagem." };
        }
        break;

      case 'accessKey':
        const keyResult = await processAccessKey(content);
        result = { 
          success: !!keyResult.data, 
          data: keyResult.data, 
          message: keyResult.message 
        };
        break;

      case 'qrCode':
        const qrResult = await processQrCode(content);
        result = { 
          success: !!qrResult.data, 
          data: qrResult.data, 
          message: qrResult.message 
        };
        break;

      default:
        result = { success: false, message: "Tipo de processamento não suportado." };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing NFe:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Erro ao processar nota fiscal." 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
