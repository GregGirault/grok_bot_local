import type { AutoReviewRule } from '@grok-bot/shared';

export type ReviewDecision = 'allow' | 'require' | 'deny';

function matches(rule: AutoReviewRule, toolName: string, payload: string): boolean {
  if (rule.toolName && rule.toolName !== toolName) return false;
  const hay = `${toolName} ${payload}`.toLowerCase();
  const pat = rule.pattern.trim().toLowerCase();
  if (!pat) return false;
  return hay.includes(pat);
}

export function reviewAction(
  rules: AutoReviewRule[],
  toolName: string,
  payload: string,
  localPolicy: 'ask' | 'always' | 'never',
  enforced = true
): ReviewDecision {
  if (!enforced) {
    if (toolName === 'shell') {
      if (localPolicy === 'never') return 'deny';
      if (localPolicy === 'always') return 'allow';
      return 'require';
    }
    return 'allow';
  }
  const requireHit = rules.filter((r) => r.kind === 'require' && matches(r, toolName, payload));
  if (requireHit.length) return 'require';
  const allowHit = rules.filter((r) => r.kind === 'allow' && matches(r, toolName, payload));
  if (allowHit.length) return 'allow';
  if (toolName === 'shell') {
    if (localPolicy === 'never') return 'deny';
    if (localPolicy === 'always') return 'allow';
  }
  if (toolName === 'send_mail' || toolName === 'slack_post' || toolName === 'x_post') return 'require';
  return 'allow';
}
