import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// knowledge/ lives at the server root, one level above src/ (and above dist/ at runtime).
const KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge');

let cached: string | null = null;

/**
 * Loads and concatenates every markdown file in /knowledge into a single string.
 * Cached in memory: the content is stable per process run, which is exactly what
 * makes it a good candidate for Anthropic prompt caching downstream.
 */
export function loadKnowledgeBase(): string {
  if (cached !== null) return cached;

  let files: string[] = [];
  try {
    files = readdirSync(KNOWLEDGE_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort(); // deterministic order → stable prompt prefix → cache hits
  } catch {
    cached = '';
    return cached;
  }

  const parts = files.map((file) => {
    const content = readFileSync(join(KNOWLEDGE_DIR, file), 'utf-8').trim();
    return `### Documento: ${file}\n\n${content}`;
  });

  cached = parts.join('\n\n---\n\n');
  return cached;
}
