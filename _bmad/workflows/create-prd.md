# Create PRD Workflow

For multi-component features that need formal specification before implementation.

## Steps

1. **Problem statement** — What user pain point or opportunity are we addressing?

2. **Research** — Review existing behavior:
   - Read relevant sections of the system prompt
   - Test current conversation flows
   - Check for related issues or prior attempts

3. **Draft PRD** — Use `templates/prd-template.md`:
   - Define the problem, users, and requirements
   - List constraints (token limits, stateless architecture, Vercel timeout)
   - Define success metrics

4. **Review** — Walk through the PRD with each agent lens:
   - PM: Are requirements complete and prioritized?
   - Architect: Is this technically feasible within constraints?
   - UX: Does this improve the user experience?
   - Developer: Is scope clear enough to implement?
   - QA: Are acceptance criteria testable?

5. **Approve and break down** — Convert requirements into stories using `workflows/dev-story.md`.
