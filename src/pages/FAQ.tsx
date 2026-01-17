import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate, Link } from "react-router-dom";

const FAQ = () => {
  const navigate = useNavigate();

  const faqCategories = [
    {
      categoria: "Sobre o Sistema",
      perguntas: [
        {
          pergunta: "O que é o GastroGestor?",
          resposta: "O GastroGestor é uma plataforma completa de gestão financeira e operacional voltada para estabelecimentos do setor de alimentação. Com ele, você pode controlar seu estoque, calcular custos de produção, precificar produtos corretamente e acompanhar suas vendas e lucratividade."
        },
        {
          pergunta: "Para quem o GastroGestor é indicado?",
          resposta: "O sistema é ideal para restaurantes, confeitarias, padarias, food trucks, lanchonetes, pizzarias, hamburguerias, cafeterias, bares, serviços de delivery, catering e buffets. Qualquer negócio que trabalhe com produção e venda de alimentos pode se beneficiar."
        },
        {
          pergunta: "Preciso instalar algum programa?",
          resposta: "Não! O GastroGestor funciona 100% online, diretamente no seu navegador. Você pode acessar de qualquer dispositivo (computador, tablet ou celular) com acesso à internet."
        },
        {
          pergunta: "Meus dados estão seguros?",
          resposta: "Sim! Utilizamos criptografia de ponta a ponta e seguimos as melhores práticas de segurança do mercado. Seus dados são armazenados em servidores seguros e fazemos backups regulares para garantir que nada seja perdido."
        }
      ]
    },
    {
      categoria: "Funcionalidades",
      perguntas: [
        {
          pergunta: "Como funciona o cálculo de custo dos produtos?",
          resposta: "O sistema calcula automaticamente o custo de cada produto com base na ficha técnica (receita) que você cadastra. Basta informar os insumos utilizados e suas quantidades, e o GastroGestor calculará o custo total considerando o preço atual de cada insumo."
        },
        {
          pergunta: "Posso importar dados de notas fiscais?",
          resposta: "Sim! O GastroGestor permite importar arquivos XML de notas fiscais eletrônicas (NF-e). O sistema extrai automaticamente os produtos, quantidades e valores, facilitando a atualização do seu estoque e preços."
        },
        {
          pergunta: "Como funciona o controle de estoque?",
          resposta: "O sistema registra todas as entradas (compras) e saídas (vendas/produção) de insumos. Você pode definir estoques mínimos e receber alertas quando um item estiver acabando. Também é possível fazer inventário e ajustes manuais."
        },
        {
          pergunta: "Posso cadastrar receitas intermediárias?",
          resposta: "Sim! Você pode criar insumos intermediários (como molhos, massas, caldos) que são usados em outras receitas. O custo é calculado automaticamente com base nos ingredientes utilizados."
        },
        {
          pergunta: "O sistema sugere preço de venda?",
          resposta: "Sim! Com base no custo calculado, margem de lucro desejada, impostos e taxas de aplicativos de delivery, o GastroGestor sugere preços de venda para garantir sua lucratividade."
        }
      ]
    },
    {
      categoria: "Assinatura e Pagamentos",
      perguntas: [
        {
          pergunta: "O GastroGestor é gratuito?",
          resposta: "Oferecemos um período de teste gratuito para você conhecer todas as funcionalidades. Após o período de teste, é necessário assinar um plano para continuar utilizando o sistema."
        },
        {
          pergunta: "Quais formas de pagamento são aceitas?",
          resposta: "Aceitamos cartões de crédito (Visa, Mastercard, American Express, Elo) e PIX. O pagamento é processado de forma segura através do Stripe."
        },
        {
          pergunta: "Posso cancelar minha assinatura a qualquer momento?",
          resposta: "Sim! Você pode cancelar sua assinatura quando quiser, sem multas ou taxas de cancelamento. O acesso continua ativo até o final do período já pago."
        },
        {
          pergunta: "Existe desconto para pagamento anual?",
          resposta: "Sim! Oferecemos desconto significativo para quem optar pelo plano anual. Entre em contato conosco para saber mais sobre condições especiais."
        }
      ]
    },
    {
      categoria: "Suporte",
      perguntas: [
        {
          pergunta: "Como entro em contato com o suporte?",
          resposta: "Você pode entrar em contato através do formulário na página de Contato, por e-mail (contato@gastrogestor.com.br) ou WhatsApp. Assinantes têm acesso prioritário ao suporte."
        },
        {
          pergunta: "Vocês oferecem treinamento?",
          resposta: "Sim! Disponibilizamos tutoriais em vídeo, artigos de ajuda e, para planos empresariais, oferecemos treinamento personalizado para sua equipe."
        },
        {
          pergunta: "O que fazer se encontrar um bug?",
          resposta: "Entre em contato conosco através do formulário de contato, selecionando 'Suporte técnico' como assunto. Descreva o problema em detalhes e, se possível, envie capturas de tela. Nossa equipe analisará e corrigirá o mais rápido possível."
        }
      ]
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

        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Perguntas Frequentes</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Encontre respostas para as dúvidas mais comuns sobre o GastroGestor.
          </p>
        </div>

        <div className="space-y-8">
          {faqCategories.map((categoria, catIndex) => (
            <div key={catIndex}>
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                {categoria.categoria}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {categoria.perguntas.map((item, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`${catIndex}-${index}`}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="font-medium text-foreground">{item.pergunta}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {item.resposta}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center py-8 px-6 rounded-lg bg-muted/50 border">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Não encontrou o que procurava?
          </h3>
          <p className="text-muted-foreground mb-4">
            Nossa equipe está pronta para ajudar você.
          </p>
          <Button asChild>
            <Link to="/contato">Fale Conosco</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
