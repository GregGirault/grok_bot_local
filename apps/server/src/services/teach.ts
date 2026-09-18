import type { TeachSession } from '@grok-bot/shared';
import { v4 as uuid } from 'uuid';
import { saveSkill } from './skills';
import { pushComputer } from './computer';

const sessions = new Map<string, TeachSession>();

export function startTeach(agentId: string, goal: string): TeachSession {
  const s: TeachSession = {
    id: uuid(),
    agentId,
    goal: goal.trim(),
    steps: [],
    status: 'recording',
    createdAt: new Date().toISOString(),
  };
  sessions.set(s.id, s);
  pushComputer(agentId, 'status', `Enseignement : ${s.goal}`);
  setTimeout(() => {
    const cur = sessions.get(s.id);
    if (cur && cur.status === 'recording') cur.status = 'review';
  }, 10 * 60 * 1000);
  return s;
}

export function addTeachStep(id: string, kind: string, detail: string): TeachSession | undefined {
  const s = sessions.get(id);
  if (!s || s.status !== 'recording') return s;
  s.steps.push({ kind, detail, at: new Date().toISOString() });
  const ck: 'navigate' | 'type' | 'click' | 'shell' | 'file' | 'status' =
    kind === 'navigate' || kind === 'type' || kind === 'click' || kind === 'shell' || kind === 'file' ? kind : 'status';
  pushComputer(s.agentId, ck, detail);
  return s;
}

export function stopTeach(id: string, skillsDir: string): TeachSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  s.status = 'review';
  const slug = s.goal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'tache';
  const steps = s.steps.map((st, i) => `${i + 1}. [${st.kind}] ${st.detail}`).join('\n') || '(aucune étape enregistrée — complète à la main)';
  const content = `---
name: ${slug}
description: ${s.goal.replace(/"/g, "'")}
---

# ${s.goal}

Compétence apprise par démonstration. Vérifie les règles d’approbation avant de l’automatiser.

## Étapes

${steps}

## Bornes

- Ne jamais envoyer, payer, publier ou supprimer sans approbation.
- Si une étape demande un mot de passe ou un 2FA, rendre la main.
`;
  saveSkill(skillsDir, slug, content);
  s.status = 'saved';
  return s;
}

export function getTeach(id: string): TeachSession | undefined {
  return sessions.get(id);
}
