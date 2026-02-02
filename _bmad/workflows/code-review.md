# Code Review Workflow

Checklist for reviewing changes to the 16s platform.

## General

- [ ] `npx tsc --noEmit` passes
- [ ] `npx next build` succeeds
- [ ] No new TypeScript `any` types introduced
- [ ] No unused imports or variables

## System Prompt Changes

- [ ] JSON response format not broken (test with a real conversation)
- [ ] No technical language leaked into user-facing copy
- [ ] Prompt additions don't push token usage over limits
- [ ] Conversation flow still works end-to-end

## UI Changes

- [ ] Works on mobile (375px viewport)
- [ ] Works on desktop (1440px viewport)
- [ ] Keyboard accessible (tab navigation, enter to submit)
- [ ] No layout shifts or overflow issues

## Generated Site Quality

- [ ] All nav links work
- [ ] No fabricated contact info
- [ ] Mobile hamburger menu functional
- [ ] WCAG AA contrast met
- [ ] No dead buttons

## Security

- [ ] No user input rendered as raw HTML outside iframe
- [ ] Base64 images validated before processing
- [ ] No new external API calls without error handling
