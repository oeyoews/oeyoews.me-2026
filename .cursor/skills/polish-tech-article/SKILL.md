---
name: polish-tech-article
description: Polish and deeply rewrite Chinese technical articles for vivid readability while preserving factual accuracy. Use when the user asks to 润色文章, 改写技术文档, 优化教程表达, or improve Chinese writing quality for technical content.
---

# Polish Tech Article

## When to Use

Apply this skill when the user requests:
- 润色中文技术文章
- 改写教程、说明文、发布文档
- 优化可读性、表达力、节奏感

## Default Behavior

- Content type: technical documentation and tutorials.
- Style target: vivid and engaging, while staying professional.
- Rewrite level: deep rewrite (can restructure paragraphs).
- Output mode: return only the final polished text.
- Extra outputs required:
  - optimized title
  - concise summary
  - SEO keyword suggestions

## Workflow

1. Read the source text fully and identify:
   - core intent
   - technical facts that must not change
   - target readers and likely reading context
2. Rewrite for clarity and rhythm:
   - simplify complex sentence structures
   - improve transitions between paragraphs
   - prioritize active voice and concrete wording
3. Preserve technical correctness:
   - do not invent APIs, parameters, versions, or benchmark numbers
   - keep code terms, product names, and protocol names accurate
4. Improve editorial quality:
   - remove repetitive statements and filler wording
   - keep terminology consistent throughout
   - ensure title/body tone alignment
5. Produce final deliverables in this order:
   - optimized title
   - summary (2-4 sentences)
   - polished full text
   - SEO keywords (5-10 items)

## Output Template

Use this structure:

```markdown
# <优化后的标题>

<2-4 句摘要>

<润色后的正文>

SEO关键词：<关键词1>、<关键词2>、<关键词3>...
```

## Quality Checklist

- Facts are unchanged and technically valid.
- Language is natural, vivid, and concise.
- Paragraph flow is smooth and easy to follow.
- Terminology is consistent.
- No unnecessary embellishment that hurts precision.
