import fs from 'fs';
import path from 'path';

export interface SkillInfo {
  name: string;
  description?: string;
  preview: string;
  content?: string;
  frontmatter?: Record<string, string>;
}

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { fm: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { fm: {}, body: raw };
  const block = raw.slice(4, end);
  const body = raw.slice(end + 4).trim();
  const fm: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { fm, body };
}

export function loadSkills(skillsDir: string): SkillInfo[] {
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(skillsDir, f), 'utf-8');
      const { fm, body } = parseFrontmatter(raw);
      const name = fm.name || f.replace(/\.md$/, '');
      return {
        name,
        description: fm.description,
        preview: body.slice(0, 280),
        content: raw,
        frontmatter: fm,
      };
    });
}

export function formatSkillsForPrompt(skills: SkillInfo[]): string {
  if (!skills.length) return '';
  const lines = skills.map((s) => `- ${s.name}: ${s.description || s.preview.slice(0, 80)}`);
  return `\n\nCompétences disponibles (référence avec /nom) :\n${lines.join('\n')}`;
}

export function saveSkill(skillsDir: string, name: string, content: string): void {
  fs.mkdirSync(skillsDir, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '-');
  fs.writeFileSync(path.join(skillsDir, `${safe}.md`), content, 'utf-8');
}

export function deleteSkill(skillsDir: string, name: string): boolean {
  const p = path.join(skillsDir, `${name.replace(/[^a-zA-Z0-9._-]/g, '-')}.md`);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}
