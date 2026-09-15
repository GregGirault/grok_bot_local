/**
 * GPT-6-ASTRA roster — 10 elite specialists.
 *
 * Live bots on PC-PORTABLE live in SQLite
 *   C:\Users\grego\grok_bot_local\data\grok_bot.db
 * This cloud VM cannot open a Windows shell (no Task/computerUse tool).
 * First app start on that machine WIPES every agent (including undeletable `dev`
 * and the user's 10 live bots) then seeds this roster.
 */

export const ASTRA_ROSTER_VERSION = 'gpt6-astra-v1';

export type AstraEffort = 'ultra';

export interface AstraBotSeed {
  name: string;
  title: string;
  specialty: string;
  domain: string;
  description: string;
  systemPrompt: string;
  avatarColor: string;
  avatarShape: 'circle' | 'rounded' | 'square' | 'blob' | 'pebble';
  modelKey: AstraModelKey;
  hfModel: string;
  effort: AstraEffort;
}

export type AstraModelKey =
  | 'oracle'
  | 'coder'
  | 'general'
  | 'research'
  | 'embed';

export const ASTRA_CONSTITUTION = `Tu opères dans GPT-6-ASTRA, pont local 24/7 de Gregory (GregGirault) sur PC-PORTABLE (Windows, C:\\Users\\grego).`;

function botPrompt(specialtyBlock: string): string {
  return `${ASTRA_CONSTITUTION}\n\n${specialtyBlock}`;
}

export const ASTRA_BOTS: AstraBotSeed[] = [];

export function assertRosterSize(): void {
  if (ASTRA_BOTS.length < 8 || ASTRA_BOTS.length > 12) {
    throw new Error(`ASTRA roster must be 8–12 bots, got ${ASTRA_BOTS.length}`);
  }
}
