# 📱 Checklist de Publicação - GastroGestor

Guia completo para publicar o app na Google Play Store e Apple App Store.

---

## 📋 Pré-requisitos Gerais

### Contas de Desenvolvedor
- [ ] **Google Play Console**: Criar conta ($25 taxa única) - [play.google.com/console](https://play.google.com/console)
- [ ] **Apple Developer Program**: Criar conta ($99/ano) - [developer.apple.com](https://developer.apple.com)

### Ferramentas Necessárias
- [ ] **Node.js** (v18+) instalado
- [ ] **Android Studio** (para Android)
- [ ] **Xcode** (para iOS - requer macOS)
- [ ] **Git** configurado

### Informações do Negócio
- [ ] Nome da empresa/desenvolvedor
- [ ] Endereço comercial
- [ ] Email de suporte (ex: suporte@gastrogestor.com.br)
- [ ] URL da política de privacidade (publicada)
- [ ] URL dos termos de uso (publicados)

---

## 🎨 Assets Visuais Necessários

### Ícone do App
- [ ] **Android**: 512x512px PNG (sem transparência)
- [ ] **iOS**: 1024x1024px PNG (sem transparência, sem cantos arredondados)
- [ ] Ícone adaptativo Android (foreground + background layers)

### Screenshots (mínimo 2, recomendado 4-8)

#### Google Play
- [ ] Telefone: 1080x1920px ou 1440x2560px
- [ ] Tablet 7": 1200x1920px
- [ ] Tablet 10": 1800x2560px

#### App Store
- [ ] iPhone 6.7" (1290x2796px) - iPhone 15 Pro Max
- [ ] iPhone 6.5" (1242x2688px) - iPhone 11 Pro Max
- [ ] iPhone 5.5" (1242x2208px) - iPhone 8 Plus
- [ ] iPad Pro 12.9" (2048x2732px)

### Gráficos Promocionais
- [ ] **Google Play Feature Graphic**: 1024x500px
- [ ] **App Store Preview Video** (opcional): 15-30 segundos

---

## 📝 Textos de Listagem

### Informações Básicas
- [ ] **Nome do App**: GastroGestor (máx 30 caracteres)
- [ ] **Subtítulo/Tagline**: "Gestão inteligente para food service" (máx 80 caracteres)

### Descrição Curta (máx 80 caracteres)
```
Controle custos, precifique produtos e aumente seus lucros no food service.
```

### Descrição Longa (máx 4000 caracteres)
```
GastroGestor é o sistema completo de gestão para restaurantes, confeitarias, 
food trucks e negócios de alimentação.

🍽️ FUNCIONALIDADES PRINCIPAIS:

✅ Precificação Inteligente
- Calcule o preço ideal dos seus produtos
- Analise margem de lucro por canal de venda
- Compare preços entre delivery, balcão e encomendas

✅ Ficha Técnica Profissional
- Cadastre ingredientes e custos
- Monte receitas com cálculo automático
- Atualize preços e veja impacto em tempo real

✅ Controle de Estoque
- Monitore insumos e produtos acabados
- Receba alertas de estoque baixo
- Importe notas fiscais XML automaticamente

✅ Gestão de Vendas
- Registre vendas por canal
- Acompanhe faturamento diário/mensal
- Relatórios de desempenho por produto

✅ Dashboard Inteligente
- Visão geral do negócio
- Indicadores de CMV e margem
- Insights e recomendações automáticas

✅ Assistente com IA
- Tire dúvidas sobre precificação
- Receba sugestões personalizadas
- Análise automática de dados

🔒 SEGURANÇA E PRIVACIDADE
- Seus dados são criptografados
- Backup automático na nuvem
- Funciona offline

💼 IDEAL PARA:
- Restaurantes e lanchonetes
- Confeitarias e padarias
- Food trucks e delivery
- Catering e eventos
- Produção de marmitas

Experimente grátis e transforme a gestão do seu negócio!
```

### Palavras-chave (App Store - 100 caracteres)
```
gestão,restaurante,precificação,ficha técnica,food service,custo,lucro,cmv,estoque,vendas
```

### Categoria
- [ ] **Primária**: Negócios / Business
- [ ] **Secundária**: Produtividade / Productivity

---

## 🔧 Build do Projeto

### 1. Preparar o Código

```bash
# Clonar do GitHub
git clone https://github.com/SEU_USUARIO/gastrogestor.git
cd gastrogestor

# Instalar dependências
npm install

# Build de produção
npm run build
```

### 2. Configurar Capacitor

```bash
# Sincronizar com plataformas nativas
npx cap sync
```

### 3. Adicionar Plataformas (se ainda não adicionou)

```bash
# Android
npx cap add android

# iOS
npx cap add ios
```

---

## 🤖 Google Play Store

### Configuração do Android

#### 1. Gerar Keystore de Assinatura
```bash
keytool -genkey -v -keystore gastrogestor-release.keystore \
  -alias gastrogestor \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

⚠️ **IMPORTANTE**: Guarde a keystore e senhas em local seguro. Você precisará delas para TODAS as atualizações futuras.

#### 2. Configurar Assinatura no Gradle

Editar `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('gastrogestor-release.keystore')
            storePassword 'SUA_SENHA'
            keyAlias 'gastrogestor'
            keyPassword 'SUA_SENHA_KEY'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### 3. Gerar AAB (Android App Bundle)
```bash
cd android
./gradlew bundleRelease
```

O arquivo será gerado em: `android/app/build/outputs/bundle/release/app-release.aab`

### Submissão na Play Console

- [ ] Criar novo app na Play Console
- [ ] Preencher **Ficha da loja** (nome, descrição, screenshots)
- [ ] Configurar **Classificação de conteúdo** (questionário IARC)
- [ ] Definir **Público-alvo**: Adultos (18+)
- [ ] Preencher **Política de privacidade** URL
- [ ] Configurar **Países/regiões** de disponibilidade
- [ ] Configurar **Preço**: Grátis (com compras no app, se aplicável)
- [ ] Upload do **AAB** na faixa de produção
- [ ] Preencher informações de **Contato do desenvolvedor**
- [ ] Responder **Declarações de privacidade de dados**
- [ ] **Enviar para revisão**

### Tempo de Revisão
- Primeira submissão: 3-7 dias
- Atualizações: 1-3 dias

---

## 🍎 Apple App Store

### Configuração do iOS

#### 1. Configurar no Apple Developer Portal

- [ ] Criar **App ID** (com.gastrogestor.app)
- [ ] Criar **Provisioning Profile** (Distribution)
- [ ] Configurar **Capabilities** necessários (Push Notifications, se usar)

#### 2. Configurar no Xcode

```bash
# Abrir projeto no Xcode
npx cap open ios
```

No Xcode:
- [ ] Selecionar Team (sua conta Apple Developer)
- [ ] Configurar Bundle Identifier: `com.gastrogestor.app`
- [ ] Configurar versão e build number
- [ ] Selecionar Provisioning Profile correto

#### 3. Gerar Archive

1. Selecionar destino: **Any iOS Device (arm64)**
2. Menu: **Product → Archive**
3. Após build, **Distribute App → App Store Connect**
4. Upload automático para App Store Connect

### Submissão no App Store Connect

- [ ] Criar novo app no App Store Connect
- [ ] Preencher **Informações do App** (nome, subtítulo, descrição)
- [ ] Upload de **Screenshots** para cada tamanho de tela
- [ ] Configurar **Categoria**: Negócios
- [ ] Preencher **URL de Suporte**
- [ ] Preencher **URL da Política de Privacidade**
- [ ] Preencher **Notas para revisão** (credenciais de teste, se necessário)
- [ ] Configurar **Preço**: Grátis
- [ ] Preencher **Informações de contato** para revisão
- [ ] Responder **Questionário de privacidade**
- [ ] Configurar **Disponibilidade** por país
- [ ] **Enviar para revisão**

### Tempo de Revisão
- Primeira submissão: 1-7 dias
- Atualizações: 24-48 horas

---

## 🔐 Política de Privacidade

A política de privacidade deve estar publicada e acessível. Certifique-se que ela inclui:

- [ ] Quais dados são coletados
- [ ] Como os dados são usados
- [ ] Com quem os dados são compartilhados
- [ ] Como os dados são protegidos
- [ ] Direitos do usuário (LGPD)
- [ ] Informações de contato

**URL atual**: https://ifood-profit-buddy.lovable.app/politica-privacidade

---

## ⚠️ Erros Comuns e Soluções

### Google Play

| Erro | Solução |
|------|---------|
| "Keystore not found" | Verificar caminho da keystore no build.gradle |
| "Classificação de conteúdo pendente" | Preencher questionário IARC |
| "Política de privacidade inválida" | Usar HTTPS e garantir que página está acessível |

### App Store

| Erro | Solução |
|------|---------|
| "Invalid binary" | Verificar se build foi feito para arm64 |
| "Missing compliance" | Preencher declaração de exportação de criptografia |
| "Metadata rejected" | Revisar screenshots e descrição |

---

## 📊 Após Publicação

### Monitoramento
- [ ] Configurar alertas de crash (Firebase Crashlytics)
- [ ] Monitorar avaliações e responder reviews
- [ ] Acompanhar métricas de instalação

### Atualizações
- [ ] Incrementar version code/build number a cada release
- [ ] Manter changelog atualizado
- [ ] Testar em dispositivos reais antes de submeter

---

## 📞 Suporte

**Dúvidas sobre o processo?**
- Google Play: [support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)
- App Store: [developer.apple.com/support](https://developer.apple.com/support)

---

*Última atualização: Fevereiro 2026*
