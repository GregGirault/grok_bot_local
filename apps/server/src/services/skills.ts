import fs from 'fs';
import path from 'path';

export interface Skill {
  name: string;
  content: string;
  description?: string;
  frontmatter: Record<string, string>;
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) {
    return { frontmatter: {}, body: raw };
  }
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const block = raw.slice(4, end).trim();
  const body = raw.slice(end + 4).replace(/^\s*\n/, '');
  const frontmatter: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) frontmatter[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return { frontmatter, body };
}

export function loadSkills(skillsDir: string): Skill[] {
  if (!fs.existsSync(skillsDir)) return [];
  const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(skillsDir, f), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const name = frontmatter.name || path.basename(f, '.md');
    return {
      name,
      content: body,
      description: frontmatter.description,
      frontmatter,
    };
  });
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (!skills.length) return '';
  const blocks = skills.map((s) => {
    const desc = s.description ? `\n(${s.description})` : '';
    return `### Skill: ${s.name}${desc}\n${s.content.trim()}`;
  });
  return `\n\n## Available skills\nFollow these skill guides when relevant:\n\n${blocks.join('\n\n')}`;
}

export function writeSkill(skillsDir: string, name: string, content: string): Skill {
  fs.mkdirSync(skillsDir, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = path.join(skillsDir, `${safe}.md`);
  fs.writeFileSync(file, content, 'utf-8');
  return loadSkills(skillsDir).find((s) => s.name === safe || s.name === name)!;
}

export const saveSkill = writeSkill;

export function deleteSkill(skillsDir: string, name: string): boolean {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = path.join(skillsDir, `${safe}.md`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}
