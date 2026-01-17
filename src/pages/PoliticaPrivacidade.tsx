import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PoliticaPrivacidade = () => {
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
          <h1 className="text-3xl font-bold text-foreground mb-6">Política de Privacidade</h1>
          
          <p className="text-muted-foreground mb-4">
            <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
          </p>

          <p className="text-muted-foreground mb-6">
            Esta Política de Privacidade descreve como o GastroGestor ("nós", "nosso" ou "Aplicativo") 
            coleta, usa e protege suas informações pessoais em conformidade com a Lei Geral de Proteção 
            de Dados (LGPD - Lei nº 13.709/2018).
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Dados que Coletamos</h2>
            <p className="text-muted-foreground mb-2">Coletamos os seguintes tipos de informações:</p>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">1.1 Dados Fornecidos por Você</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Nome completo e nome da empresa</li>
              <li>Endereço de e-mail</li>
              <li>Número de telefone</li>
              <li>CPF ou CNPJ</li>
              <li>Informações de produtos, vendas e estoque inseridas no sistema</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">1.2 Dados Coletados Automaticamente</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Endereço IP e localização aproximada</li>
              <li>Tipo de dispositivo e navegador</li>
              <li>Páginas visitadas e tempo de uso</li>
              <li>Dados de desempenho do aplicativo</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Como Usamos Seus Dados</h2>
            <p className="text-muted-foreground mb-2">Utilizamos suas informações para:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Fornecer e melhorar nossos serviços</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Enviar comunicações importantes sobre o serviço</li>
              <li>Fornecer suporte ao cliente</li>
              <li>Cumprir obrigações legais</li>
              <li>Prevenir fraudes e garantir a segurança</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Base Legal para Tratamento</h2>
            <p className="text-muted-foreground mb-2">Tratamos seus dados com base em:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Consentimento:</strong> quando você aceita nossos termos</li>
              <li><strong>Execução de contrato:</strong> para fornecer os serviços contratados</li>
              <li><strong>Obrigação legal:</strong> para cumprir exigências legais</li>
              <li><strong>Legítimo interesse:</strong> para melhorar nossos serviços</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground mb-2">
              Podemos compartilhar suas informações com:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Processadores de pagamento:</strong> para processar transações (ex: Stripe)</li>
              <li><strong>Provedores de infraestrutura:</strong> para hospedagem e armazenamento de dados</li>
              <li><strong>Autoridades legais:</strong> quando exigido por lei</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              <strong>Não vendemos</strong> suas informações pessoais a terceiros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground mb-2">
              Conforme a LGPD, você tem direito a:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> solicitar correção de dados incompletos ou incorretos</li>
              <li><strong>Anonimização ou eliminação:</strong> solicitar anonimização ou exclusão de dados desnecessários</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado</li>
              <li><strong>Revogação do consentimento:</strong> revogar seu consentimento a qualquer momento</li>
              <li><strong>Informação:</strong> saber com quem compartilhamos seus dados</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Para exercer seus direitos, entre em contato através do e-mail indicado no final desta política.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Segurança dos Dados</h2>
            <p className="text-muted-foreground">
              Implementamos medidas técnicas e organizacionais apropriadas para proteger suas informações, 
              incluindo criptografia de dados, controle de acesso, backups regulares e monitoramento de 
              segurança. No entanto, nenhum sistema é 100% seguro, e não podemos garantir segurança absoluta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Mantemos seus dados pelo tempo necessário para fornecer nossos serviços ou conforme exigido 
              por lei. Após o encerramento de sua conta, seus dados serão excluídos ou anonimizados, 
              exceto quando a retenção for necessária para cumprir obrigações legais.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies e Tecnologias Similares</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, lembrar suas 
              preferências e analisar o uso do aplicativo. Você pode gerenciar as configurações de 
              cookies através do seu navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Menores de Idade</h2>
            <p className="text-muted-foreground">
              Nosso serviço não é direcionado a menores de 18 anos. Não coletamos intencionalmente 
              informações de menores. Se tomarmos conhecimento de que coletamos dados de um menor, 
              tomaremos medidas para excluí-los.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Alterações nesta Política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta Política periodicamente. Notificaremos você sobre alterações 
              significativas por e-mail ou através do Aplicativo. Recomendamos revisar esta política 
              regularmente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contato e Encarregado (DPO)</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre esta Política de Privacidade ou para exercer seus direitos, 
              entre em contato com nosso Encarregado de Proteção de Dados:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>E-mail:</strong>{" "}
              <a href="mailto:privacidade@gastrogestor.com.br" className="text-primary hover:underline">
                privacidade@gastrogestor.com.br
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
