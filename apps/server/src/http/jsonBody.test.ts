import { parseJsonBody } from './jsonBody';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run(): void {
  assert(JSON.stringify(parseJsonBody('')) === '{}', 'empty string → {}');
  assert(JSON.stringify(parseJsonBody(Buffer.alloc(0))) === '{}', 'empty buffer → {}');
  const chat = parseJsonBody(Buffer.from('{"agentId":"abc","message":"Bonjour"}', 'utf8')) as {
    agentId: string;
    message: string;
  };
  assert(chat.agentId === 'abc', 'buffer JSON keeps agentId');
  assert(chat.message === 'Bonjour', 'buffer JSON keeps message');
  const fromStr = parseJsonBody('{"agentId":"z","message":"x"}') as { message: string };
  assert(fromStr.message === 'x', 'string JSON not swallowed');
  let threw = false;
  try {
    parseJsonBody('{not json');
  } catch {
    threw = true;
  }
  assert(threw, 'invalid JSON must throw, not become {}');
  console.log('jsonBody.test.ts ok');
}

run();
