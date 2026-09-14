import fs from 'fs';
import path from 'path';

export interface Skill {
  name: string;
  content: string;
}

export function loadSkills(skillsDir: string): Skill[] {
  if (!fs.existsSync(skillsDir)) return [];
  const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
  return files.map((f) => ({
    name: path.basename(f, '.md'),
    content: fs.readFileSync(path.join(skillsDir, f), 'utf-8'),
  }));
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (!skills.length) return '';
  const blocks = skills.map(
    (s) => `### Skill: ${s.name}\n${s.content.trim()}`
  );
  return `\n\n## Available skills\nFollow these skill guides when relevant:\n\n${blocks.join('\n\n')}`;
}
