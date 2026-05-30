import type { Anthropic } from '@anthropic-ai/sdk';
import { anthropic } from './client.js';
import { config } from '../config.js';
import { claudeLimiter } from '../rateLimit.js';
import { CATEGORIES, URGENCIES, type Category, type Classification, type EmailInput } from '../types.js';

/**
 * Email classification with claude-haiku-4-5.
 *
 * We force structured output via *tool use*: a single tool `classificar_email`
 * whose input_schema is exactly the JSON we want back. `tool_choice` forces the
 * model to call it, so the response is guaranteed to be a well-formed tool_use
 * block — no free-text JSON to fish out of prose.
 */

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classificar_email',
  description:
    'Registra a classificação estruturada de um e-mail de suporte ao cliente.',
  input_schema: {
    type: 'object',
    properties: {
      categoria: {
        type: 'string',
        enum: [...CATEGORIES],
        description:
          'Categoria principal do e-mail. Use "suporte_tecnico" para problemas técnicos do produto, ' +
          '"financeiro" para pagamento/cobrança/reembolso, "duvida" para perguntas gerais, ' +
          '"reclamacao" para insatisfação, "elogio" para feedback positivo, "outro" se nada se encaixar.',
      },
      urgencia: {
        type: 'string',
        enum: [...URGENCIES],
        description:
          'Urgência percebida: "alta" (cliente bloqueado/irritado/prazo crítico), "media" (precisa de resposta mas não urgente), "baixa".',
      },
      idioma: {
        type: 'string',
        description: 'Código do idioma do e-mail do cliente (ex.: "pt", "en", "es").',
      },
      resumo: {
        type: 'string',
        description: 'Resumo de uma frase do pedido do cliente, no idioma do e-mail.',
      },
    },
    required: ['categoria', 'urgencia', 'idioma', 'resumo'],
  },
};

const SYSTEM_PROMPT =
  'Você é um classificador de e-mails de suporte ao cliente. ' +
  'Leia o e-mail e chame a ferramenta classificar_email com a análise estruturada. ' +
  'Seja conciso e objetivo.';

/**
 * Normalises/validates a raw tool input into a typed Classification.
 * Exported and pure so it can be unit-tested without hitting the API.
 */
export function parseClassification(input: unknown): Classification {
  const obj = (input ?? {}) as Record<string, unknown>;

  const rawCategory = String(obj.categoria ?? '').toLowerCase().trim();
  const categoria: Category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : 'outro';

  const rawUrgency = String(obj.urgencia ?? '').toLowerCase().trim();
  const urgencia = (URGENCIES as readonly string[]).includes(rawUrgency)
    ? (rawUrgency as Classification['urgencia'])
    : 'media';

  const idioma = String(obj.idioma ?? 'pt').toLowerCase().trim().slice(0, 5) || 'pt';
  const resumo = String(obj.resumo ?? '').trim() || 'Sem resumo.';

  return { categoria, urgencia, idioma, resumo };
}

function buildUserContent(email: EmailInput): string {
  return [
    `Remetente: ${email.sender}`,
    `Assunto: ${email.subject}`,
    '',
    'Corpo do e-mail:',
    email.body,
  ].join('\n');
}

/** Calls Claude to classify a single email. Throws on API/parse failure. */
export async function classifyEmail(email: EmailInput): Promise<Classification> {
  const response = await claudeLimiter(() =>
    anthropic.messages.create({
      model: config.anthropic.classifyModel,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [CLASSIFY_TOOL],
      // Force the model to answer through the tool → guaranteed structured output.
      tool_choice: { type: 'tool', name: CLASSIFY_TOOL.name },
      messages: [{ role: 'user', content: buildUserContent(email) }],
    })
  );

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new Error('Classificação falhou: a resposta não contém um bloco tool_use.');
  }

  return parseClassification(toolUse.input);
}
