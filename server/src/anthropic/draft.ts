import type { Anthropic } from '@anthropic-ai/sdk';
import { anthropic } from './client.js';
import { config } from '../config.js';
import { claudeLimiter } from '../rateLimit.js';
import { loadKnowledgeBase } from '../knowledge.js';
import type { Classification, DraftResult, EmailInput } from '../types.js';

/**
 * Reply drafting with claude-sonnet-4-6.
 *
 * Prompt caching: the `system` array holds (1) the stable instructions block and
 * (2) the knowledge base block, with `cache_control: { type: 'ephemeral' }` on
 * the LAST block. Caching is a prefix match, so marking the last system block
 * caches everything before it (tools + instructions + knowledge) together. Those
 * bytes are identical on every request in a process run, so from the 2nd call on
 * we pay ~0.1x for that large prefix instead of full price. The per-email content
 * (which varies every request) goes in the user turn, after the cached prefix.
 *
 * Structured output: same forced-tool-use trick as classification — a single
 * `redigir_resposta` tool with { resposta, confianca } guarantees parseable JSON.
 */

const DRAFT_TOOL: Anthropic.Tool = {
  name: 'redigir_resposta',
  description: 'Registra a resposta redigida ao cliente e o nível de confiança nela.',
  input_schema: {
    type: 'object',
    properties: {
      resposta: {
        type: 'string',
        description:
          'Resposta completa ao cliente, pronta para envio, no MESMO idioma do e-mail do cliente. ' +
          'Inclua saudação e assinatura. Não invente políticas que não estejam na base de conhecimento.',
      },
      confianca: {
        type: 'number',
        description:
          'Confiança de 0 a 1 de que a resposta é correta, completa e segura para enviar sem revisão. ' +
          'Use valores baixos (< 0.7) quando faltar informação, o caso for ambíguo, ou exigir ação humana.',
      },
    },
    required: ['resposta', 'confianca'],
  },
};

/** Stable instructions block. Depends only on configured tone/company → cache-safe. */
function buildInstructions(): string {
  return [
    `Você é um agente de suporte ao cliente da empresa "${config.behaviour.companyName}".`,
    `Redija respostas com tom ${config.behaviour.replyTone}.`,
    '',
    'Regras:',
    '- Responda SEMPRE no mesmo idioma do e-mail do cliente.',
    '- Baseie-se exclusivamente na base de conhecimento abaixo. Não invente políticas, prazos ou valores.',
    '- Se a base não cobrir o caso, escreva uma resposta prudente e indique que um especialista dará sequência, ' +
      'e reduza a confiança.',
    '- Seja claro e resolva o problema do cliente de forma direta.',
    '- Chame a ferramenta redigir_resposta com a resposta final e a confiança.',
  ].join('\n');
}

function buildSystemBlocks(): Anthropic.TextBlockParam[] {
  const knowledge = loadKnowledgeBase();
  return [
    { type: 'text', text: buildInstructions() },
    {
      type: 'text',
      text: `BASE DE CONHECIMENTO\n\n${knowledge}`,
      // Cache breakpoint on the last (largest, most stable) block.
      cache_control: { type: 'ephemeral' },
    },
  ];
}

function buildUserContent(email: EmailInput, classification: Classification): string {
  return [
    'Contexto da classificação:',
    `- Categoria: ${classification.categoria}`,
    `- Urgência: ${classification.urgencia}`,
    `- Idioma do cliente: ${classification.idioma}`,
    `- Resumo: ${classification.resumo}`,
    '',
    `Remetente: ${email.sender}`,
    `Assunto: ${email.subject}`,
    '',
    'E-mail do cliente:',
    email.body,
    '',
    `Redija a resposta no idioma "${classification.idioma}".`,
  ].join('\n');
}

/**
 * Normalises/validates a raw tool input into a typed DraftResult.
 * Exported and pure so it can be unit-tested without hitting the API.
 */
export function parseDraftResult(input: unknown): DraftResult {
  const obj = (input ?? {}) as Record<string, unknown>;

  const resposta = String(obj.resposta ?? '').trim();
  if (!resposta) {
    throw new Error('Resposta vazia retornada pelo modelo.');
  }

  // Coerce + clamp confidence into [0, 1]; default to a low value if unparseable.
  let confianca = Number(obj.confianca);
  if (!Number.isFinite(confianca)) confianca = 0.5;
  confianca = Math.min(1, Math.max(0, confianca));

  return { resposta, confianca };
}

/** Calls Claude to draft a reply for a single (already classified) email. */
export async function generateDraft(
  email: EmailInput,
  classification: Classification
): Promise<DraftResult> {
  const response = await claudeLimiter(() =>
    anthropic.messages.create({
      model: config.anthropic.draftModel,
      max_tokens: 1500,
      system: buildSystemBlocks(),
      tools: [DRAFT_TOOL],
      tool_choice: { type: 'tool', name: DRAFT_TOOL.name },
      messages: [{ role: 'user', content: buildUserContent(email, classification) }],
    })
  );

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new Error('Redação falhou: a resposta não contém um bloco tool_use.');
  }

  return parseDraftResult(toolUse.input);
}
