import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Share2 } from "lucide-react";

interface EmpresaCardapio {
  id: string;
  nome: string;
  slug: string | null;
  cardapio_ativo: boolean;
  cardapio_descricao: string | null;
  horario_funcionamento: string | null;
  whatsapp_dono: string | null;
}

export function CardapioConfig() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  const [empresa, setEmpresa] = useState<EmpresaCardapio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    cardapio_ativo: false,
    cardapio_descricao: "",
    horario_funcionamento: "",
    whatsapp_dono: "",
    slug: "",
  });

  useEffect(() => {
    if (empresaId) {
      carregarDados();
    }
  }, [empresaId]);

  const carregarDados = async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, slug, cardapio_ativo, cardapio_descricao, horario_funcionamento, whatsapp_dono")
        .eq("id", empresaId)
        .single();

      if (error) throw error;

      setEmpresa(data);
      setFormData({
        cardapio_ativo: data.cardapio_ativo || false,
        cardapio_descricao: data.cardapio_descricao || "",
        horario_funcionamento: data.horario_funcionamento || "",
        whatsapp_dono: data.whatsapp_dono || "",
        slug: data.slug || "",
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações do cardápio");
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    if (!empresaId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("empresas")
        .update({
          cardapio_ativo: formData.cardapio_ativo,
          cardapio_descricao: formData.cardapio_descricao || null,
          horario_funcionamento: formData.horario_funcionamento || null,
          whatsapp_dono: formData.whatsapp_dono || null,
          slug: formData.slug || null,
        })
        .eq("id", empresaId);

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      if (error.code === "23505") {
        toast.error("Este slug já está em uso. Escolha outro.");
      } else {
        toast.error("Erro ao salvar configurações");
      }
    } finally {
      setSaving(false);
    }
  };

  const getLinkCardapio = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/cardapio/${formData.slug}`;
  };

  const copiarLink = () => {
    navigator.clipboard.writeText(getLinkCardapio());
    toast.success("Link copiado!");
  };

  const compartilharWhatsApp = () => {
    const mensagem = `Confira nosso cardápio: ${getLinkCardapio()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Cardápio Digital
                {formData.cardapio_ativo ? (
                  <Badge variant="default" className="bg-green-500">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Configure seu cardápio online para receber pedidos via WhatsApp
              </CardDescription>
            </div>
            <Switch
              checked={formData.cardapio_ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, cardapio_ativo: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
      {/* Link do cardápio */}
          {formData.slug && (
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Link do seu cardápio</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={getLinkCardapio()}
                  readOnly
                  className="flex-1 bg-background"
                />
                <Button variant="outline" size="icon" onClick={copiarLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={getLinkCardapio()} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" size="icon" onClick={compartilharWhatsApp}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Configurações */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL amigável) *</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/cardapio/</span>
                <Input
                  id="slug"
                  placeholder="minha-doceria"
                  value={formData.slug}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") 
                  })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp para receber pedidos *</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={formData.whatsapp_dono}
                onChange={(e) => setFormData({ ...formData, whatsapp_dono: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Os clientes serão direcionados para este número ao finalizar o pedido
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do cardápio</Label>
              <Textarea
                id="descricao"
                placeholder="Ex: Delícias artesanais feitas com amor ❤️"
                value={formData.cardapio_descricao}
                onChange={(e) => setFormData({ ...formData, cardapio_descricao: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario">Horário de funcionamento</Label>
              <Input
                id="horario"
                placeholder="Ex: Seg-Sex 9h às 18h | Sáb 9h às 14h"
                value={formData.horario_funcionamento}
                onChange={(e) => setFormData({ ...formData, horario_funcionamento: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={salvar} disabled={saving || !formData.slug || !formData.whatsapp_dono}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>

      {/* Dicas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 Dicas para vender mais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>✅ Adicione fotos atraentes aos seus produtos</p>
          <p>✅ Mantenha os preços atualizados</p>
          <p>✅ Compartilhe o link nas suas redes sociais</p>
          <p>✅ Coloque o link na bio do Instagram</p>
          <p>✅ Crie um QR Code do link para cartões e panfletos</p>
        </CardContent>
      </Card>
    </div>
  );
}
