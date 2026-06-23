## O que vai ser construído

Um chat com IA acessível por bolha flutuante (canto inferior direito) em todas as telas autenticadas. Cada usuário pode ter várias conversas salvas (threads), com histórico persistido no banco.

## Como o usuário vai usar

1. Vê a bolha 💬 no canto da tela em qualquer página
2. Clica → abre painel lateral (Sheet) com:
   - Lista de conversas anteriores à esquerda
   - Chat ativo à direita
   - Botão "+ Nova conversa"
3. Pergunta coisas tipo:
   - "Por que meu lucro caiu essa semana?"
   - "Qual produto tem a pior margem?"
   - "Devo reajustar o preço do brigadeiro?"
   - "Quanto vendi de bolo no pote esse mês?"
4. IA responde com base nos dados reais da empresa (vendas, custos, fichas, estoque, alertas)

## Arquitetura técnica

**Banco (1 migration):**
- `ai_chat_threads`: id, empresa_id, user_id, title, created_at, updated_at
- `ai_chat_messages`: id, thread_id, role (user/assistant), content, created_at
- RLS escopo por empresa_id, GRANTs pra authenticated/service_role
- Título da thread gerado automaticamente a partir da 1ª pergunta

**Edge function `ai-chat`:**
- Recebe `{ threadId, messages }` (formato UIMessage do AI SDK)
- Valida JWT, busca empresa_id
- Checa quota (`check_and_increment_ai_quota` com feature `chat`)
- Monta **snapshot de negócio** no system prompt: receita 30 dias, top produtos, top canais, custos fixos, alertas ativos, estoque baixo, margens médias
- Streaming via `streamText` + `toUIMessageStreamResponse` (AI SDK)
- Persiste mensagens em `onFinish`
- Modelo: `google/gemini-3-flash-preview`

**Frontend:**
- Instalar AI Elements: `conversation`, `message`, `prompt-input`, `shimmer`
- `FloatingChatButton.tsx` — bolha fixa bottom-right, badge de notificação opcional
- `ChatPanel.tsx` — Sheet lateral (largura ampla em desktop, fullscreen em mobile)
- `ThreadList.tsx` — lista de conversas com busca, deletar, renomear
- `ChatWindow.tsx` — usa `useChat` do AI SDK, AI Elements pra UI, markdown nas respostas
- Active thread ID via URL search param `?aiThread=ID` (satisfaz contract de URL-derived state)
- Montado uma única vez no `AppLayout` (depois do menu)

**Quotas (já existem):**
- Adicionar feature `chat` em `ai_quotas`: 30 msgs/dia standard, 150/dia pro

## Limites de escopo desta etapa

- Sem tool calling ainda (IA não executa ações, só lê e responde). Próxima iteração: tools tipo `reajustar_preco`, `criar_compra`.
- Sem busca semântica em histórico de vendas (snapshot bounded de 30 dias já cobre 95% das perguntas).
- Sem áudio/anexos.
- Logo do assistente: gerar um ícone próprio (não usar `Sparkles` genérico).

## Ordem de implementação

1. Migration (tabelas + quotas)
2. Edge function `ai-chat` com snapshot + streaming
3. Instalar AI Elements
4. Gerar ícone do assistente
5. Componentes UI (bolha + painel + chat)
6. Wire no AppLayout

Posso seguir?