import { LocalLlm } from './llm';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function run(): Promise<void> {
  const local = new LocalLlm();
  let text = '';
  for await (const chunk of local.chatStream({
    messages: [{ role: 'user', content: 'Bonjour, dis juste oui.' }],
  })) {
    text += chunk.choices[0]?.delta?.content ?? '';
  }
  assert(text.trim().length > 20, `LocalLlm must stream French tokens, got: ${JSON.stringify(text)}`);
  assert(/français|Compris|Objectif|Ollama|écoute/i.test(text), `expected French local reply, got: ${text.slice(0, 120)}`);

  const ac = new AbortController();
  ac.abort();
  let abortedText = '';
  for await (const chunk of local.chatStream({
    messages: [{ role: 'user', content: 'Bonjour' }],
    signal: ac.signal,
  })) {
    abortedText += chunk.choices[0]?.delta?.content ?? '';
  }
  assert(abortedText.length === 0, 'already-aborted signal should not stream');
  console.log('llm.test.ts ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
