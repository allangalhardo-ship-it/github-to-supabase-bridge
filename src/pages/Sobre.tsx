import { ArrowLeft, Target, Eye, Heart, Users, TrendingUp, Shield, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import logoImage from '@/assets/logo.png';
import { ChangelogDialog } from "@/components/pwa/ChangelogDialog";
import { getCurrentVersion } from "@/lib/changelog";

const Sobre = () => {
  const navigate = useNavigate();

  const valores = [
    {
      icon: Target,
      titulo: "Simplicidade",
      descricao: "Ferramentas intuitivas que qualquer pessoa pode usar, sem necessidade de conhecimento técnico avançado."
    },
    {
      icon: TrendingUp,
      titulo: "Resultados",
      descricao: "Foco em métricas que realmente importam para o crescimento do seu negócio."
    },
    {
      icon: Shield,
      titulo: "Segurança",
      descricao: "Seus dados estão protegidos com as melhores práticas de segurança do mercado."
    },
    {
      icon: Heart,
      titulo: "Dedicação",
      descricao: "Comprometidos em ajudar pequenos e médios empreendedores a prosperarem."
    }
  ];

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

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={logoImage} alt="GastroGestor" className="h-24 w-24 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">GastroGestor</h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Versão {getCurrentVersion()}</span>
            <ChangelogDialog 
              trigger={
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                  <History className="h-3 w-3" />
                  Ver novidades
                </Button>
              }
            />
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A plataforma completa de gestão financeira e operacional para estabelecimentos do setor de alimentação.
          </p>
        </div>

        {/* Nossa História */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Nossa História
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-muted-foreground mb-4">
              O GastroGestor nasceu da necessidade real de empreendedores do setor de alimentação que 
              buscavam uma solução simples e eficiente para gerenciar seus negócios. Cansados de planilhas 
              complexas e sistemas caros, decidimos criar uma plataforma que realmente entende os desafios 
              do dia a dia de quem trabalha com comida.
            </p>
            <p className="text-muted-foreground">
              Desde então, temos ajudado restaurantes, confeitarias, food trucks e diversos outros 
              estabelecimentos a controlar seus custos, precificar corretamente seus produtos e aumentar 
              sua lucratividade.
            </p>
          </div>
        </section>

        {/* Missão e Visão */}
        <section className="mb-12 grid md:grid-cols-2 gap-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold text-foreground">Nossa Missão</h3>
              </div>
              <p className="text-muted-foreground">
                Democratizar o acesso a ferramentas de gestão profissional, permitindo que pequenos e 
                médios empreendedores do setor de alimentação tenham controle total sobre seus negócios 
                e tomem decisões baseadas em dados.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold text-foreground">Nossa Visão</h3>
              </div>
              <p className="text-muted-foreground">
                Ser a plataforma de gestão mais utilizada por estabelecimentos de alimentação no Brasil, 
                reconhecida pela simplicidade, eficiência e impacto positivo nos resultados de nossos clientes.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Nossos Valores */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Nossos Valores</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {valores.map((valor, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <valor.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{valor.titulo}</h3>
                      <p className="text-sm text-muted-foreground">{valor.descricao}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-8 px-6 rounded-lg bg-primary/5 border border-primary/20">
          <h2 className="text-2xl font-bold text-foreground mb-3">Pronto para começar?</h2>
          <p className="text-muted-foreground mb-6">
            Junte-se a centenas de empreendedores que já transformaram seus negócios com o GastroGestor.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link to="/cadastro">Criar Conta Grátis</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contato">Fale Conosco</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Sobre;
