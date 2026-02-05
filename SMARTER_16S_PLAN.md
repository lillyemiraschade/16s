# Smarter 16s - Implementation Plan

## Inspiration Sources
- [Lovable.dev "A Smarter Lovable"](https://lovable.dev/a-smarter-lovable)
- [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD)

---

## Current 16s Flow
```
User Request → AI Generates HTML → Preview
```

## Smarter 16s Flow
```
User Request → Planning Phase → User Approval → Agentic Execution → QA/Validation → Preview
```

---

## Phase 1: Smarter Planning

### 1.1 Project Brief Generation
Before generating any code, create an editable project brief:

```typescript
interface ProjectBrief {
  projectType: "website" | "app" | "tool";
  name: string;
  description: string;
  targetAudience: string;
  keyFeatures: string[];
  pages: PageSpec[];
  styleGuide: StyleGuide;
  technicalRequirements: string[];
}

interface PageSpec {
  name: string;
  purpose: string;
  sections: SectionSpec[];
  interactions: string[];
}

interface StyleGuide {
  colorPalette: string[];
  typography: { heading: string; body: string };
  vibe: string; // "minimal", "bold", "elegant", etc.
  inspirationNotes: string;
}
```

### 1.2 Plan Review UI
- Show plan in a modal/sidebar before generation
- User can edit/approve sections
- "Looks good, build it" button to proceed
- "Let's refine this" to iterate on plan

### 1.3 Implementation
Add to system prompt:
```
PLANNING MODE:
When user describes a project, FIRST respond with a structured plan:
{"message": "Here's my plan...", "plan": {...}, "pills": ["Looks good!", "Let's adjust"]}

Only generate HTML after user approves the plan.
```

---

## Phase 2: Agentic Execution with Task Lists

### 2.1 Task Decomposition
Complex builds get broken into visible steps:

```typescript
interface BuildTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "error";
  description: string;
  estimatedComplexity: "simple" | "moderate" | "complex";
}

interface BuildPlan {
  tasks: BuildTask[];
  currentTaskIndex: number;
  overallProgress: number; // 0-100
}
```

### 2.2 Example Task List
For "Build a restaurant website with menu and reservations":
1. ☐ Set up page structure and navigation
2. ☐ Build hero section with restaurant branding
3. ☐ Create interactive menu with categories
4. ☐ Add reservation form with validation
5. ☐ Build about section with story
6. ☐ Add location map and hours
7. ☐ Create footer with contact info
8. ☐ Add animations and polish
9. ☐ Run quality checks

### 2.3 Progress UI
- Show task list in sidebar during generation
- Check off tasks as completed
- Show current task with spinner
- Allow user to see what's happening

---

## Phase 3: Project Context & Memory

### 3.1 Project Context Storage
```typescript
interface ProjectContext {
  id: string;
  brandGuidelines: {
    colors: string[];
    fonts: string[];
    tone: string;
    logoUrl?: string;
  };
  preferences: {
    codeStyle: "html" | "react";
    animations: boolean;
    darkMode: boolean;
  };
  knowledgeBase: {
    businessInfo: string;
    targetAudience: string;
    competitors: string[];
    uniqueSellingPoints: string[];
  };
  history: {
    decisions: string[]; // "User prefers minimal design"
    feedback: string[];  // "Make buttons more prominent"
  };
}
```

### 3.2 Context Injection
- Load project context at start of conversation
- Inject into system prompt
- Update context based on user feedback
- Persist to Supabase with project

### 3.3 Smart Suggestions
Based on context, suggest:
- "Based on your brand colors, I'd suggest..."
- "Since your target audience is young professionals..."
- "You mentioned last time you wanted more whitespace..."

---

## Phase 4: Quality Assurance

### 4.1 Automated Checks
After generation, run validation:

```typescript
interface QAReport {
  passed: boolean;
  checks: QACheck[];
  suggestions: string[];
}

interface QACheck {
  name: string;
  status: "pass" | "warn" | "fail";
  details: string;
}
```

### 4.2 Check Categories
1. **Functionality**
   - All buttons have actions
   - Forms submit properly
   - Navigation works
   - No dead links

2. **Accessibility**
   - WCAG AA contrast
   - Alt text on images
   - Semantic HTML
   - Focus states

3. **Responsiveness**
   - Mobile layout works
   - Touch targets ≥44px
   - No horizontal scroll

4. **Performance**
   - No massive inline images
   - CSS is optimized
   - No blocking scripts

5. **Best Practices**
   - No console errors
   - Valid HTML
   - SEO basics (title, meta)

### 4.3 Auto-Fix
For common issues, offer to auto-fix:
- "I found 3 buttons without hover states. Fix them?"
- "The contact form doesn't validate email. Add validation?"

---

## Phase 5: Queued Workflows

### 5.1 Prompt Queue
Allow users to queue multiple requests:
```
User: "Add a testimonials section"
User: "Then add a pricing table"
User: "Then add a FAQ accordion"

16s: Processing 3 requests...
[1/3] Adding testimonials section... ✓
[2/3] Adding pricing table... ✓
[3/3] Adding FAQ accordion... ✓
All done! Here's your updated site.
```

### 5.2 Implementation
- Queue messages while generating
- Process sequentially
- Show queue progress
- Allow cancellation

---

## Phase 6: Agent Mode (Advanced)

### 6.1 BMAD-Inspired Agents
Specialized agents for different tasks:

| Agent | Role | When Used |
|-------|------|-----------|
| **Analyst** | Understands requirements, asks clarifying questions | Initial project discussion |
| **Architect** | Plans structure, page layout, component hierarchy | Before complex builds |
| **Designer** | Makes style decisions, picks colors/fonts | Style phase |
| **Developer** | Writes the actual HTML/CSS/JS | Build phase |
| **QA** | Tests and validates output | After generation |
| **PM** | Coordinates flow, manages context | Throughout |

### 6.2 Agent Handoffs
```
User: "Build me a SaaS landing page"

[Analyst]: What's your product? Who's the target customer?
User: "AI writing tool for marketers"

[Architect]: I'll structure this with: Hero, Features, Pricing, Testimonials, CTA
[Designer]: Based on "AI tool for marketers", I suggest modern/clean with blue accents
[Developer]: Building now... [task list appears]
[QA]: All checks passed! Forms work, responsive, accessible.

[PM]: Here's your landing page! Want to refine anything?
```

---

## Implementation Priority

### MVP (Week 1)
1. [ ] Planning phase with editable brief
2. [ ] Task list UI during generation
3. [ ] Basic QA checks

### V2 (Week 2)
4. [ ] Project context storage
5. [ ] Queued workflows
6. [ ] Auto-fix suggestions

### V3 (Week 3+)
7. [ ] Full agent mode
8. [ ] Knowledge base integration
9. [ ] Advanced QA with screenshots

---

## Technical Changes Required

### API Changes
```typescript
// New fields in chat request
interface ChatRequest {
  // ... existing fields
  mode: "chat" | "plan" | "build" | "qa";
  projectContext?: ProjectContext;
  buildPlan?: BuildPlan;
}

// New response fields
interface ChatResponse {
  // ... existing fields
  plan?: ProjectBrief;
  tasks?: BuildTask[];
  qaReport?: QAReport;
}
```

### Database Changes
```sql
-- Add to projects table
ALTER TABLE projects ADD COLUMN context JSONB;
ALTER TABLE projects ADD COLUMN build_plans JSONB;
ALTER TABLE projects ADD COLUMN qa_reports JSONB;
```

### UI Components Needed
1. `PlanReviewModal` - Show/edit project brief
2. `TaskListPanel` - Show build progress
3. `QAReportPanel` - Show validation results
4. `ContextEditor` - Edit project context
5. `PromptQueue` - Show queued requests

---

## Success Metrics (Matching Lovable)
- 70%+ better at complex tasks
- 70% fewer stalled builds
- 40% fewer errors
- User satisfaction increase

---

## Next Steps
1. Start with Planning Phase (highest impact)
2. Add Task List UI (visibility)
3. Implement basic QA checks
4. Iterate based on feedback
