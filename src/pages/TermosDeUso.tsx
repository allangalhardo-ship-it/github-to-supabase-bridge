import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const TermosDeUso = () => {
  const navigate = useNavigate();

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

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-6">Termos de Uso</h1>
          
          <p className="text-muted-foreground mb-4">
            <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">
              Ao acessar e usar o GastroGestor ("Aplicativo"), você concorda em cumprir e estar vinculado a estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não poderá acessar ou usar nosso Aplicativo.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">
              O GastroGestor é uma plataforma de gestão financeira e operacional voltada para estabelecimentos do setor 
              de alimentação. O Aplicativo oferece funcionalidades como controle de estoque, gestão de vendas, 
              cálculo de custos e precificação de produtos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground mb-2">
              Para utilizar nossos serviços, você deve criar uma conta fornecendo informações verdadeiras, 
              completas e atualizadas. Você é responsável por:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Manter a confidencialidade de sua senha</li>
              <li>Todas as atividades realizadas em sua conta</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Uso Aceitável</h2>
            <p className="text-muted-foreground mb-2">Você concorda em não:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Usar o Aplicativo para fins ilegais ou não autorizados</li>
              <li>Violar quaisquer leis aplicáveis ao usar o serviço</li>
              <li>Tentar acessar áreas restritas do sistema</li>
              <li>Transmitir vírus ou código malicioso</li>
              <li>Coletar informações de outros usuários sem autorização</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Propriedade Intelectual</h2>
            <p className="text-muted-foreground">
              Todo o conteúdo do Aplicativo, incluindo textos, gráficos, logos, ícones, imagens e software, 
              é propriedade exclusiva do GastroGestor ou de seus licenciadores e está protegido por leis 
              de propriedade intelectual.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Pagamentos e Assinaturas</h2>
            <p className="text-muted-foreground">
              Alguns recursos podem estar disponíveis apenas mediante assinatura paga. Os preços e condições 
              de pagamento serão informados antes da contratação. O cancelamento pode ser feito a qualquer 
              momento, sendo aplicadas as regras de reembolso vigentes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">
              O Aplicativo é fornecido "como está". Não garantimos que o serviço será ininterrupto ou livre 
              de erros. Em nenhuma circunstância seremos responsáveis por danos indiretos, incidentais ou 
              consequenciais decorrentes do uso do Aplicativo.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Modificações</h2>
            <p className="text-muted-foreground">
              Reservamo-nos o direito de modificar estes Termos a qualquer momento. As alterações entrarão 
              em vigor após a publicação. O uso contínuo do Aplicativo após as alterações constitui 
              aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Rescisão</h2>
            <p className="text-muted-foreground">
              Podemos suspender ou encerrar seu acesso ao Aplicativo a qualquer momento, por qualquer motivo, 
              incluindo violação destes Termos, sem aviso prévio.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Lei Aplicável</h2>
            <p className="text-muted-foreground">
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa 
              será resolvida no foro da comarca da sede da empresa.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre estes Termos de Uso, entre em contato conosco através do e-mail: 
              <a href="mailto:contato@gastrogestor.com.br" className="text-primary hover:underline ml-1">
                contato@gastrogestor.com.br
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
