import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Logo } from '@/components/brand/Logo';
import {
  ChefHat,
  TrendingUp,
  Calculator,
  Package,
  BarChart3,
  Shield,
  Star,
  ArrowRight,
  Check,
  Smartphone,
  Bot,
  Tags,
} from 'lucide-react';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Features data
const features = [
  {
    icon: Calculator,
    title: 'Precificação Inteligente',
    description: 'Calcule automaticamente o preço ideal de cada produto considerando custos, impostos e margem desejada.',
  },
  {
    icon: Package,
    title: 'Controle de Estoque',
    description: 'Acompanhe insumos e produtos em tempo real. Alertas automáticos de estoque baixo.',
  },
  {
    icon: TrendingUp,
    title: 'Margem de Contribuição',
    description: 'Visualize o lucro real de cada venda, não apenas percentuais. Saiba exatamente quanto ganha.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios Detalhados',
    description: 'Dashboards visuais com métricas de vendas, custos e rentabilidade por canal.',
  },
  {
    icon: Bot,
    title: 'Assistente com IA',
    description: 'Tire dúvidas sobre seu negócio e receba insights personalizados em português.',
  },
  {
    icon: Tags,
    title: 'Multicanal',
    description: 'Gerencie preços diferentes para balcão, iFood, 99Food e outros apps de delivery.',
  },
];

// Testimonials data
const testimonials = [
  {
    name: 'Maria Silva',
    business: 'Doces da Maria',
    image: null,
    rating: 5,
    text: 'Antes eu não sabia se estava tendo lucro ou prejuízo. Com o GastroGestor, finalmente entendo meus números e consigo precificar corretamente.',
  },
  {
    name: 'João Santos',
    business: 'Açaí do João',
    image: null,
    rating: 5,
    text: 'O controle de estoque me salvou! Não perco mais ingredientes vencidos e sei exatamente quando comprar.',
  },
  {
    name: 'Ana Costa',
    business: 'Bolo no Pote AC',
    image: null,
    rating: 5,
    text: 'A precificação por canal é incrível. Agora sei que no iFood preciso cobrar mais por causa das taxas. Meu lucro aumentou 30%!',
  },
];

// FAQ data
const faqItems = [
  {
    question: 'O GastroGestor funciona para qualquer tipo de comida?',
    answer: 'Sim! O sistema é ideal para qualquer microempreendedor de alimentação: doces, salgados, marmitas, açaí, bolo no pote, lanches, etc. Se você produz e vende comida, o GastroGestor é para você.',
  },
  {
    question: 'Preciso saber usar computador ou planilhas?',
    answer: 'Não! O GastroGestor foi desenvolvido para ser simples e intuitivo. Se você sabe usar WhatsApp, consegue usar nosso sistema. Além disso, temos um assistente de IA para tirar suas dúvidas.',
  },
  {
    question: 'Como funciona a precificação automática?',
    answer: 'Você cadastra seus insumos com os preços de compra e cria a ficha técnica de cada produto. O sistema calcula automaticamente o custo, considera impostos e taxas de delivery, e sugere o preço ideal baseado na margem que você deseja.',
  },
  {
    question: 'Posso usar no celular?',
    answer: 'Sim! O GastroGestor funciona perfeitamente no celular. Você pode acessar pelo navegador ou instalar como aplicativo. Em breve também estará disponível na Google Play e App Store.',
  },
  {
    question: 'Tem período de teste gratuito?',
    answer: 'Sim! Oferecemos um período de teste gratuito para você conhecer todas as funcionalidades antes de assinar. Sem compromisso e sem precisar de cartão de crédito.',
  },
  {
    question: 'Como funciona o suporte?',
    answer: 'Oferecemos suporte via chat dentro do app, WhatsApp e email. Nossa equipe está sempre pronta para ajudar você a aproveitar ao máximo o sistema.',
  },
];

// Screenshot component placeholder
const AppScreenshot = ({ title, description, imageSrc }: { title: string; description: string; imageSrc?: string }) => (
  <motion.div
    variants={fadeInUp}
    className="relative group"
  >
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-lg">
      {/* Browser frame */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-warning/60" />
          <div className="w-3 h-3 rounded-full bg-success/60" />
        </div>
        <div className="flex-1 mx-4">
          <div className="h-6 bg-background rounded-md flex items-center justify-center">
            <span className="text-xs text-muted-foreground">gastrogestor.lovable.app</span>
          </div>
        </div>
      </div>
      
      {/* Screenshot placeholder - using gradient background */}
      <div className="aspect-video bg-gradient-to-br from-primary-light via-background to-surface-alt flex items-center justify-center p-8">
        <div className="text-center">
          <ChefHat className="h-16 w-16 mx-auto text-primary mb-4" />
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        </div>
      </div>
    </div>
    
    {/* Label */}
    <div className="mt-4 text-center">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </motion.div>
);

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Começar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div variants={fadeInUp}>
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
                Gestão simplificada para micro food business
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
            >
              Saiba exatamente quanto você{' '}
              <span className="text-primary">ganha em cada venda</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              O GastroGestor é o sistema de gestão feito para quem vende comida em delivery. 
              Controle custos, precifique corretamente e aumente sua margem de lucro.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cadastro">
                <Button size="lg" className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-lg px-8">
                  Começar Grátis
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#screenshots">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
                  Ver Como Funciona
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Período de teste grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Funciona no celular</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-surface-alt">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa em um só lugar
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas pensadas especialmente para microempreendedores de alimentação
            </motion.p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow border-border/50 bg-card">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section id="screenshots" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Conheça o Sistema
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Interface simples e intuitiva, feita para você que não tem tempo a perder
            </motion.p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AppScreenshot
              title="Dashboard"
              description="Visão geral do seu negócio com métricas em tempo real"
            />
            <AppScreenshot
              title="Precificação"
              description="Calcule o preço ideal para cada produto"
            />
            <AppScreenshot
              title="Estoque"
              description="Controle de insumos com alertas automáticos"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-12"
          >
            <div className="inline-flex items-center gap-2 bg-primary/5 rounded-full px-6 py-3">
              <Smartphone className="h-5 w-5 text-primary" />
              <span className="text-foreground font-medium">
                Funciona perfeitamente no celular!
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-surface-alt">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              O que dizem nossos clientes
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Empreendedores como você já estão transformando seus negócios
            </motion.p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full bg-card border-border/50">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-foreground mb-4 italic">"{testimonial.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-semibold">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.business}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Perguntas Frequentes
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tire suas dúvidas sobre o GastroGestor
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-foreground hover:text-primary">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-primary-dark">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para ter controle do seu negócio?
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              Junte-se a centenas de empreendedores que já estão aumentando seus lucros com o GastroGestor
            </p>
            <Link to="/cadastro">
              <Button size="lg" className="bg-white text-primary-dark hover:bg-white/90 text-lg px-8 gap-2">
                Começar Agora — É Grátis
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ChefHat className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">GastroGestor</span>
              </div>
              <p className="text-white/60 text-sm">
                Sistema de gestão para microempreendedores de alimentação.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><a href="#screenshots" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><Link to="/assinatura" className="hover:text-white transition-colors">Preços</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><Link to="/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</Link></li>
                <li><Link to="/politica-de-privacidade" className="hover:text-white transition-colors">Privacidade</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><Link to="/contato" className="hover:text-white transition-colors">Fale Conosco</Link></li>
                <li><Link to="/sobre" className="hover:text-white transition-colors">Sobre</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} GastroGestor. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Shield className="h-4 w-4" />
              <span>Seus dados estão seguros conosco</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
