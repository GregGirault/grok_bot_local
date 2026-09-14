---
name: code-review
description: Structured code review checklist for local workspace changes
---

# Code review skill

When the user asks for a code review:

1. Use `list_dir` / `read_file` to inspect the relevant files.
2. Focus on correctness, security, readability, and edge cases.
3. Prefer concrete suggestions with file paths and short diffs when useful.
4. Call out risks clearly; do not invent issues that are not in the code.
5. Keep the summary short: findings first, then optional improvements.
