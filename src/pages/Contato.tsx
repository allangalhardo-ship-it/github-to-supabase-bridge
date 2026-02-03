import { useState } from "react";
import { ArrowLeft, Mail, Phone, MessageSquare, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Contato = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    assunto: "",
    mensagem: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.assunto || !formData.mensagem) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    // Simula envio (em produção, integrar com edge function + Resend)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setLoading(false);
    setEnviado(true);
    
    toast({
      title: "Mensagem enviada!",
      description: "Responderemos em breve. Obrigado pelo contato!"
    });
  };

  const canaisContato = [
    {
      icon: Mail,
      titulo: "E-mail",
      info: "contato@gastrogestor.com.br",
      descricao: "Respondemos em até 24h úteis"
    },
    {
      icon: Phone,
      titulo: "WhatsApp",
      info: "(11) 99999-9999",
      descricao: "Seg-Sex, 9h às 18h"
    },
    {
      icon: MessageSquare,
      titulo: "Chat",
      info: "Chat ao vivo",
      descricao: "Disponível para assinantes"
    }
  ];

  if (enviado) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Mensagem Enviada!</h1>
            <p className="text-muted-foreground max-w-md mb-8">
              Obrigado por entrar em contato. Nossa equipe analisará sua mensagem e 
              responderemos o mais breve possível.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/")}>
                Ir para Home
              </Button>
              <Button variant="outline" onClick={() => {
                setEnviado(false);
                setFormData({ nome: "", email: "", assunto: "", mensagem: "" });
              }}>
                Enviar Nova Mensagem
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-16">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Fale Conosco</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Tem alguma dúvida, sugestão ou precisa de ajuda? Estamos aqui para ajudar!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {canaisContato.map((canal, index) => (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <canal.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{canal.titulo}</h3>
                <p className="text-primary font-medium mb-1">{canal.info}</p>
                <p className="text-sm text-muted-foreground">{canal.descricao}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Envie sua Mensagem
            </CardTitle>
            <CardDescription>
              Preencha o formulário abaixo e entraremos em contato em breve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    placeholder="Seu nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assunto">Assunto *</Label>
                <Select 
                  value={formData.assunto} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assunto: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o assunto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="duvida">Dúvida sobre o sistema</SelectItem>
                    <SelectItem value="suporte">Suporte técnico</SelectItem>
                    <SelectItem value="assinatura">Assinatura e pagamentos</SelectItem>
                    <SelectItem value="sugestao">Sugestão de funcionalidade</SelectItem>
                    <SelectItem value="parceria">Parceria comercial</SelectItem>
                    <SelectItem value="outro">Outro assunto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem *</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Descreva sua dúvida ou solicitação em detalhes..."
                  rows={5}
                  value={formData.mensagem}
                  onChange={(e) => setFormData(prev => ({ ...prev, mensagem: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contato;
