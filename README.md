# ✉️ AI Email Support

[![CI](https://github.com/f-neves/ai-email-support/actions/workflows/ci.yml/badge.svg)](https://github.com/f-neves/ai-email-support/actions/workflows/ci.yml)

Autoresponder de e-mails de suporte **assistido por IA**. Lê e-mails de uma conta
Gmail (label **Suporte**), classifica cada um, gera um rascunho de resposta com a
API da Anthropic (Claude) baseada numa base de conhecimento, e oferece um **painel
web** onde uma pessoa revisa, edita e aprova/envia — ou descarta.

> Projeto de portfólio. Foco em código limpo, tipado, simples e fácil de rodar.

---

## ✨ Funcionalidades

- **OAuth2 com o Google** para ler e enviar e-mails via Gmail API.
- **Sincronização** dos e-mails não lidos da label `Suporte`.
- **Classificação** com `claude-haiku-4-5` (tool use → JSON estruturado garantido):
  categoria, urgência, idioma e resumo.
- **Geração de rascunho** com `claude-sonnet-4-6`, usando os arquivos markdown de
  `server/knowledge/` como base de conhecimento, com **prompt caching** no system
  prompt + base de conhecimento. Cada rascunho vem com um campo `confiança` (0–1).
- **Painel React**: tabela de e-mails com categoria/urgência/status, visão de
  detalhe com rascunho editável, botões **Aprovar & Enviar** / **Descartar**, e
  destaque **"revisar"** para confiança < 0,7.
- **Extras (atrás de flags):** auto-envio acima de um limiar de confiança,
  dashboard de métricas e tom de voz configurável.

---

## 🧱 Stack

| Camada     | Tecnologia                                            |
| ---------- | ----------------------------------------------------- |
| Backend    | Node.js · TypeScript · Fastify                        |
| IA         | `@anthropic-ai/sdk` (Claude Haiku 4.5 + Sonnet 4.6)   |
| E-mail     | Gmail API (`googleapis`) com OAuth2                   |
| Banco      | SQLite via Prisma                                     |
| Frontend   | React · Vite · TailwindCSS                            |
| Monorepo   | npm workspaces (`/server` + `/web`)                   |

---

## 📁 Estrutura

```
ai-email-support/
├── package.json            # workspaces + scripts (dev, build, db:*, test)
├── server/
│   ├── prisma/
│   │   ├── schema.prisma    # modelos Email + OAuthToken (SQLite)
│   │   └── seed.ts          # 5 e-mails fake para demo sem Gmail
│   ├── knowledge/           # base de conhecimento (FAQs em markdown)
│   ├── src/
│   │   ├── index.ts         # Fastify + rotas
│   │   ├── config.ts        # configuração tipada (env)
│   │   ├── anthropic/       # integração Claude (classify + draft)
│   │   ├── gmail/           # OAuth, sync e envio
│   │   ├── routes/          # auth, emails, metrics
│   │   └── pipeline.ts      # classify → draft → (auto-send)
│   └── tests/               # vitest: classificação + parser de resposta
└── web/                     # SPA React (Vite + Tailwind)
```

---

## ✅ Pré-requisitos

- **Node.js ≥ 20** e **npm ≥ 10**
- Uma **chave da API Anthropic** → https://console.anthropic.com/settings/keys
- (Opcional, só para o Gmail real) um projeto no **Google Cloud** com a Gmail API.

---

## 🚀 Como rodar (demo SEM Gmail, em 4 passos)

Dá para ver o painel inteiro funcionando **sem Gmail e sem nem mesmo a chave da
Anthropic** — o seed já vem com classificação e rascunhos prontos.

```bash
# 1. Instalar dependências (raiz do monorepo)
npm install

# 2. Configurar variáveis de ambiente do servidor
cp server/.env.example server/.env
#   (opcional) edite server/.env e coloque sua ANTHROPIC_API_KEY

# 3. Criar o banco SQLite + popular com 5 e-mails de exemplo
npm run db:migrate
npm run db:seed

# 4. Subir backend + frontend juntos
npm run dev
```

Acesse **http://localhost:5173**. Você verá os 5 e-mails de exemplo já
classificados, com rascunhos e métricas. Pode editar rascunhos, descartar e — se
tiver configurado a `ANTHROPIC_API_KEY` — clicar em **"Reprocessar com IA"** para
ver a classificação e a redação acontecerem de verdade.

> Os e-mails de seed não têm thread real do Gmail, então **Aprovar & Enviar** fica
> desabilitado para eles (não dá para responder um endereço fictício). Tudo o mais
> funciona.

---

## 📨 Como rodar COM o Gmail real

### 1. Credenciais no Google Cloud (passo a passo)

1. Acesse https://console.cloud.google.com/ e crie (ou selecione) um projeto.
2. Menu **APIs e serviços → Biblioteca** → procure **Gmail API** → **Ativar**.
3. **APIs e serviços → Tela de permissão OAuth**:
   - Tipo de usuário: **Externo** → **Criar**.
   - Preencha nome do app e e-mail de suporte.
   - Em **Usuários de teste**, adicione o seu e-mail do Gmail (importante!).
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados**, adicione exatamente:
     ```
     http://localhost:3001/api/auth/google/callback
     ```
   - Crie e copie o **Client ID** e o **Client Secret**.
5. No Gmail, crie a label **`Suporte`** e aplique-a aos e-mails que quer importar
   (pode criar um filtro para isso).

### 2. Preencher o `.env`

Edite `server/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

### 3. Conectar e sincronizar

1. `npm run dev` e abra http://localhost:5173.
2. Clique em **Conectar Gmail** → faça login e autorize.
3. Clique em **↻ Sincronizar Gmail**: os não lidos da label `Suporte` são
   importados, classificados e ganham rascunho automaticamente.
4. Revise, edite e **Aprovar & Enviar** — a resposta vai no mesmo thread.

---

## 🔧 Scripts npm (na raiz)

| Script               | O que faz                                              |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Sobe servidor (`:3001`) **e** web (`:5173`) juntos     |
| `npm run build`      | Build de produção do servidor e do frontend            |
| `npm run db:migrate` | Cria/atualiza o banco SQLite (Prisma migrate)          |
| `npm run db:seed`    | Popula 5 e-mails de exemplo                            |
| `npm test`           | Roda os testes (vitest) do servidor                    |
| `npm run lint`       | ESLint no servidor                                     |

---

## ⚙️ Flags de configuração (`server/.env`)

| Variável                      | Padrão                          | Descrição                                            |
| ----------------------------- | ------------------------------- | ---------------------------------------------------- |
| `CONFIDENCE_REVIEW_THRESHOLD` | `0.7`                           | Abaixo disso o e-mail é marcado **"revisar"**.       |
| `AUTO_SEND_ENABLED`           | `false`                         | Liga o auto-envio.                                   |
| `AUTO_SEND_THRESHOLD`         | `0.9`                           | Confiança mínima para auto-enviar.                   |
| `REPLY_TONE`                  | `profissional, cordial...`      | Tom de voz injetado no prompt.                       |
| `COMPANY_NAME`                | `Acme Suporte`                  | Nome usado nas assinaturas.                          |
| `GMAIL_LABEL`                 | `Suporte`                       | Label do Gmail a sincronizar.                        |
| `ANTHROPIC_MAX_RETRIES`       | `3`                             | Tentativas do SDK em 429/5xx.                        |

---

## 🧠 Detalhes da integração com a IA

- **Classificação (`server/src/anthropic/classify.ts`)** — usa *tool use* com
  `tool_choice` forçado, então a resposta é sempre um JSON válido
  (`categoria`, `urgencia`, `idioma`, `resumo`). Sem parsing frágil de texto.
- **Redação (`server/src/anthropic/draft.ts`)** — `system` é um array de blocos;
  o último (a base de conhecimento) leva `cache_control: { type: 'ephemeral' }`.
  Como caching é por prefixo, isso cacheia instruções + base de conhecimento
  juntas: a partir da 2ª chamada paga-se ~0,1× por esse prefixo grande.
- **Tratamento de erros e rate limiting** — o SDK já faz retry com backoff em
  429/5xx; complementamos com um limitador de concorrência (`rateLimit.ts`) para
  o processamento em lote não estourar o limite de uma vez.

---

## 🔍 Fluxo da demo (resumo)

```
Sincronizar/Seed → Lista (categoria · urgência · status · confiança)
                 → Detalhe (e-mail + rascunho editável)
                 → Aprovar & Enviar  |  Descartar  |  Reprocessar com IA
```

1. **Lista** à esquerda com badges e medidor de confiança; itens com confiança
   < 0,7 ganham a tag **"revisar"**.
2. **Detalhe** à direita: e-mail original, resumo, rascunho editável e ações.
3. **Aprovar & Enviar** responde no thread do Gmail; **Descartar** tira da fila.
4. **Métricas** no topo: volume por categoria, taxa de auto-resolução, confiança
   média e tempo médio de resolução.

---

## 📝 Notas

- Banco SQLite fica em `server/prisma/dev.db` (ignorado pelo git).
- Tokens do Google ficam no banco (tabela `OAuthToken`), nunca em arquivo de log.
- Sem chave Anthropic, a IA fica desabilitada e o app avisa na interface — o seed
  continua demonstrável.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](./LICENSE).
