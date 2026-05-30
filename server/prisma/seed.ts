import { PrismaClient } from '@prisma/client';

/**
 * Seeds 5 realistic fake support emails so the dashboard is fully demoable
 * WITHOUT Gmail or even an Anthropic key configured. Each row comes pre-filled
 * with a plausible classification + draft + confidence (as if the AI had already
 * run), including one low-confidence case that the UI flags as "revisar".
 *
 * These have no gmailId/threadId, so "Aprovar & Enviar" is intentionally blocked
 * for them (you can't really reply to a fake address) — but you can edit drafts,
 * discard, and re-run the AI pipeline on them with a real key.
 */
const prisma = new PrismaClient();

const now = Date.now();
const hoursAgo = (h: number): Date => new Date(now - h * 60 * 60 * 1000);

const seedEmails = [
  {
    sender: 'Mariana Lopes <mariana.lopes@example.com>',
    subject: 'Meu pedido ainda não chegou',
    body: 'Olá, fiz o pedido #48213 há 9 dias e ainda não recebi. O rastreio não atualiza desde a semana passada. Podem verificar, por favor? Estou começando a ficar preocupada.',
    receivedAt: hoursAgo(2),
    category: 'reclamacao',
    urgency: 'alta',
    language: 'pt',
    summary: 'Cliente relata atraso na entrega do pedido #48213 sem atualização de rastreio.',
    confidence: 0.86,
    draft:
      'Olá, Mariana!\n\nObrigado por entrar em contato e lamento pelo transtorno. Verifiquei que o rastreio do pedido #48213 está sem atualização há alguns dias. Como já passou do prazo previsto, vou abrir um chamado de investigação com a transportadora — o retorno costuma sair em até 5 dias úteis.\n\nSe preferir não aguardar, posso providenciar o reenvio do pedido ou o reembolso integral. É só me dizer qual opção prefere.\n\nAtenciosamente,\nEquipe Acme Suporte',
    status: 'pending',
  },
  {
    sender: 'James Carter <james.carter@example.com>',
    subject: 'Refund request for damaged item',
    body: 'Hi, the blender I received arrived with a cracked jar. I would like a refund or a replacement. Order number is 51902. Thanks.',
    receivedAt: hoursAgo(6),
    category: 'financeiro',
    urgency: 'media',
    language: 'en',
    summary: 'Customer received a damaged blender and requests a refund or replacement (order 51902).',
    confidence: 0.91,
    draft:
      'Hi James,\n\nThanks for reaching out, and I’m sorry the blender arrived damaged. Since this is a manufacturing/transit defect, you’re fully covered — we’ll cover all shipping costs.\n\nI can either send a brand-new replacement right away or process a full refund for order #51902, whichever you prefer. Just reply with your choice and we’ll get it sorted.\n\nBest regards,\nAcme Support Team',
    status: 'pending',
  },
  {
    sender: 'Pedro Henrique <pedro.h@example.com>',
    subject: 'Cobrança duplicada no cartão',
    body: 'Boa tarde. Fui cobrado duas vezes pelo pedido #50011 no meu cartão de crédito. Aparecem dois lançamentos de R$ 259,90. Podem estornar a cobrança extra?',
    receivedAt: hoursAgo(20),
    category: 'financeiro',
    urgency: 'alta',
    language: 'pt',
    summary: 'Cliente foi cobrado em duplicidade (R$ 259,90) no pedido #50011 e pede estorno.',
    confidence: 0.78,
    draft:
      'Olá, Pedro!\n\nObrigado por avisar e desculpe pelo ocorrido. Para regularizar a cobrança duplicada do pedido #50011, poderia me enviar o comprovante dos dois lançamentos de R$ 259,90? Assim que confirmarmos, faremos o estorno da cobrança extra em até 7 dias úteis, conforme a operadora do cartão.\n\nFico no aguardo.\n\nAtenciosamente,\nEquipe Acme Suporte',
    status: 'pending',
  },
  {
    sender: 'Sofía Ramírez <sofia.ramirez@example.com>',
    subject: 'No puedo iniciar sesión en mi cuenta',
    body: 'Hola, no logro entrar a mi cuenta. Dice que la contraseña es incorrecta pero estoy segura de que es la correcta. ¿Me pueden ayudar?',
    receivedAt: hoursAgo(28),
    category: 'suporte_tecnico',
    urgency: 'media',
    language: 'es',
    summary: 'Cliente no puede iniciar sesión por contraseña incorrecta y pide ayuda.',
    confidence: 0.82,
    draft:
      'Hola Sofía,\n\nGracias por escribirnos. Por seguridad no gestionamos datos de la cuenta por correo, pero puedes restablecer tu contraseña fácilmente: entra en https://exemplo.com/login y haz clic en «Olvidé mi contraseña». Recibirás un enlace para crear una nueva.\n\nSi después de eso sigues sin poder acceder, dímelo y lo escalo a nuestro equipo técnico.\n\nUn saludo,\nEquipo de Soporte Acme',
    status: 'pending',
  },
  {
    sender: 'Lucas Martins <lucas.martins@example.com>',
    subject: 'Vocês entregam fora do Brasil?',
    body: 'Oi! Adorei os produtos de vocês. Tenho um amigo na Argentina e queria mandar um presente pra ele. Vocês fazem entrega internacional? E quanto tempo demora?',
    receivedAt: hoursAgo(40),
    category: 'duvida',
    urgency: 'baixa',
    language: 'pt',
    summary: 'Cliente pergunta sobre entrega internacional (Argentina) e prazos.',
    confidence: 0.64, // abaixo do limite → aparece como "revisar" no painel
    draft:
      'Olá, Lucas!\n\nQue bom que gostou dos nossos produtos! No momento não realizamos entregas internacionais, apenas dentro do Brasil. Assim que passarmos a oferecer envios para fora do país, será um prazer atender você.\n\nSe quiser, posso sugerir alternativas para presentear seu amigo. É só falar!\n\nAtenciosamente,\nEquipe Acme Suporte',
    status: 'pending',
  },
];

async function main(): Promise<void> {
  // Reset only seed rows (those without a Gmail id) to keep re-seeding idempotent.
  await prisma.email.deleteMany({ where: { gmailId: null } });

  for (const e of seedEmails) {
    await prisma.email.create({ data: e });
  }

  console.log(`Seed concluído: ${seedEmails.length} e-mails de exemplo criados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
