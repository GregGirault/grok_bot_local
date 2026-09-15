/**
 * Compare les tags Ollama locaux aux modèles de la flotte GPT-6-ASTRA 10.
 * À lancer SUR LE PC, Ollama ouvert :
 *
 *   npm run sync-models
 *
 * Ne pas lancer depuis le cloud (pas de GPU, ne tire pas de gros GGUF ici).
 */
const required = ['qwen3:30b', 'qwen2.5-coder:14b', 'qwen2.5:14b', 'qwen3:8b', 'qwen2.5-coder:7b'];

function matches(installed, tag) {
  if (installed.has(tag)) return true;
  for (const name of installed) {
    if (name === tag || name.startsWith(`${tag}-`) || name.startsWith(`${tag}@`)) return true;
  }
  return false;
}

let installedNames = [];
try {
  const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  installedNames = (data.models || []).map((m) => m.name);
} catch {
  console.error('Ollama n’est pas joignable sur http://127.0.0.1:11434');
  console.error('Démarre Ollama sur CE PC, puis : npm run sync-models');
  process.exit(1);
}

const installed = new Set(installedNames);
const missing = required.filter((tag) => !matches(installed, tag));

console.log(`Ollama : ${installedNames.length} modèles`);
if (!missing.length) {
  console.log('Rien à télécharger — la flotte GPT-6-ASTRA 10 a déjà ses tags locaux.');
  process.exit(0);
}

console.log('À tirer :', missing.join(', '));
const { execSync } = await import('node:child_process');
for (const tag of missing) {
  console.log(`\n→ ollama pull ${tag}`);
  execSync(`ollama pull ${tag}`, { stdio: 'inherit' });
}
console.log('\nOK.');
