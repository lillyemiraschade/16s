# Dev Story Workflow

Break a PRD or feature request into implementable stories.

## Steps

1. **Read the PRD or feature description** — Understand the full scope.

2. **Identify changes per file** — For each requirement, map to specific files:
   - System prompt changes → `route.ts`
   - UI changes → `page.tsx`
   - New API behavior → `route.ts`
   - New components → `src/components/`

3. **Create stories** — Use `templates/story-template.md` for each:
   - One story per logical unit of work
   - Each story should be independently testable
   - Include file paths and acceptance criteria

4. **Order stories** — Identify dependencies:
   - API changes before UI changes that depend on them
   - Prompt changes before behavioral tests

5. **Implement sequentially** — Work through stories in order, verifying each before moving to the next.
