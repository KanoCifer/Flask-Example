# Shape Brief — AI 学习 (learning/) Visual Refactor

Target: `frontend/apps/vue-app/src/features/learning/` — four files:
`LearningList.vue`, `CourseView.vue`, `LessonView.vue`, `ExerciseCard.vue`.

## 1) Job and Audience

- **Primary job:** prompt → course package → lesson-by-lesson progression, with
  progress persisted and resumable.
- **Audience:** kanocifer (owner/power user) + public visitors browsing the
  AI learning trail as an artifact.
- **Visitor mode:** **Operate** with a Read seam. The owner *operates* a
  capture-and-progress UI; visitors *read* the resulting trail without
  auth. Brand lives in precise details, not loud expression.
- **Inherited identity:** site-wide tokens via Tailwind v4 + Vue; the
  "kuro neko" / 黑猫 anchor is present elsewhere on the site and must not
  be contradicted or overdrawn on this surface.

## 2) Outcome and Proof

- **Capture-first action:** every `/learning` visit lands within one viewport
  of a working topic prompt — the input, the goal field, the submit affordance.
- **Course overview proves the artifact:** topic + lesson list (numbered) +
  progress bar + collapsible 学习使命 / 学习资源 panels, the same shape
  already there but visually grounded in the new world.
- **Lesson view proves the unit of progress:** lesson markdown + exercises tab
  with Q-cards, three exercise types, client-side grading, optimistic
  本节完成 / 下一课.
- **Owner ergonomics:** Enter-to-submit on topic prompt, Enter-to-mark-done
  on exercises, persistent resume from `progressList`.
- **Truth:** the content shape, polls, lifecycle states, types, and
  `learningGateway` calls are already correct — do not change product behavior,
  only the visual presentation and the structural rhythm of the surfaces.

## 3) Selected Direction

- **Visual authority:** site tokens (Tailwind v4) plus one committed accent
  the surface earns. The incumbent already uses `accent` for the active tab
  and progress bar — keep `accent` as the load-bearing signal, but stop
  relying on the `accent/10` chip-on-rounded-card pattern that produces the
  generic admin look.
- **Structural thesis:** the **learning trail as a numbered spine**. Each
  course carries a visible lesson index (0001, 0002, …) that recurs from
  course overview → lesson header → exercise card footer. Progress is a
  *position on a line*, not a percentage on a chip. The topic prompt
  becomes the *title page* of a new spine.
- **Form:** quiet card chrome, real dividers (`divide-border/40` used as
  bone, not as decoration), monospace for indices and counts, serif headline
  on the spine title only. Replace the tinted-icon-chips (`bg-accent/10`
  square behind a `BookOpen`) with bare icons that carry state through
  color and weight, not through container backgrounds.
- **Sequence — `/learning`:** Topic prompt (full-width focus, optional goal
  inline below) → 我的学习 list (numbered, status by type weight, no chips)
  → footer hint.
- **Sequence — `/learning/course/:id`:** Title + spine position
  (`0001 — 0007 / 7 完成`) → lesson list as the spine itself, each row
  numbered, status by type weight and (for current) a left accent rule →
  collapsible 学习使命 / 学习资源 → 「继续下一课」 as a single action
  anchored at the spine's end.
- **Sequence — `/learning/lesson/:lessonId`:** breadcrumb (course + index)
  → title → tab nav (正文 / 练习) → markdown or exercise stack →
  本节完成 / 下一课 action row.
- **Sequence — ExerciseCard:** number + type label + points/difficulty in
  one header row, prompt as the focal line, options as bare rows that earn
  their state through border weight and color (not background fills),
  result line that owns the explanation.
- **Focal moment:** the spine. The numbered lesson list is the signature
  composition — it should read as the spine of a printed booklet, not as
  a settings menu.

## 4) Scope and Boundaries

- **Fidelity:** four component rewrites + the `index.ts` barrels stay
  untouched. No new files, no deletions, no backend contract changes.
- **Named target:** all four files under `features/learning/components/`.
- **Untouched:** `composables/useLearningCourse.ts`, `api/`,
  `types/`, the lesson/course shape, the polling cadence, the lifecycle
  states, the `useLearningCourse()` public API surface. Tokens are inherited
  from the global Tailwind config — do not hardcode colors.
- **Anti-goals:** no new "AI glow" gradients, no glassmorphism, no neon,
  no gamified XP bars, no animated background canvases. No introducing a
  new visual world that contradicts the site-wide identity — the redesign
  is a *re-grounding*, not a rebrand.
- **Tests:** existing component tests under `components/__tests__/` must
  continue to pass; the visual contract is the change, the behavioral
  contract is not.

## 5) States and Ranges

- Topic prompt: empty, drafting, submitting (pending), failed, success.
- Course overview: loading, pending generation, failed, ready-empty (no
  lessons yet), ready-with-lessons, fully done.
- Lesson view: loading, failed, not-found, ready (lesson tab / exercises tab).
- Exercise card: unanswered, single_choice selected, multi_choice toggled,
  true_false selected, submitted-correct, submitted-incorrect (correct
  answer revealed), retry-reset.
- Progress list: empty, loading skeleton, populated, refreshing.
- Realistic content ranges: 1–12 lessons per course (numbered 0001…),
  1–10 exercises per lesson, topic prompts 6–60 Chinese characters, goal
  fields 0–120 characters.

## 6) Interaction and Layout

- **Hierarchy:** numbered spine is primary; topic prompt and exercise result
  are focal; chrome (cards, headers, dividers) is support.
- **Topology:** single-column max-w-3xl (list) / max-w-4xl (course &
  lesson) inherited; no multi-column experiments on this surface.
- **Responsiveness:** mobile-first, the incumbent's `sm:` and `md:` rules
  carry over; spine becomes a tighter list at `sm`, action rows collapse
  to stacked at `sm`.
- **Affordances:** Enter submits topic prompt; Enter submits an exercise
  with a selection; "本节完成" lights only when all exercises answered
  correctly (incumbent rule, keep); "继续下一课" / "下一课" disabled while
  generating.
- **Feedback:** submitting uses the existing `Loader2` spin with
  `motion-reduce:animate-none`; progress bar uses `transition-all` with
  reduced-motion override; collapsible panels keep the `grid-template-rows`
  0fr↔1fr transition.
- **Transitions:** no new motion vocabulary; reuse the incumbent collapsible
  pattern and the existing spin/transition utilities.

## 7) Constraints and Open Decisions

- **Platform:** web, Tailwind v4, Vue 3, semantic class names only
  (`text-ink`, `bg-card`, `bg-page`, `border-border/40`, `text-accent`,
  `text-muted`, `text-success`, `text-destructive`, `bg-accent`,
  `text-contrast`, `font-mono`, `font-serif`).
- **A11y:** keyboard-only flow preserved; `aria-expanded`/`aria-hidden`
  on collapsible panels preserved; `role="progressbar"` with
  `aria-valuenow` preserved on the spine progress.
- **i18n / copy:** Chinese copy stays in place; do not invent new strings
  without checking the incumbent phrasing.
- **Reusable components:** keep importing from `@/components` (`Button`)
  and `@/composables` (`renderMarkdown`); keep importing `ExerciseCard`
  from `LessonView`.
- **No new dependencies** — lucide-vue icons already in use; do not add
  an icon pack or animation library.
- **Open decision (defer to builder judgment, not blocking):** whether the
  spine lesson numbers render as a left-rule column or as inline monospace
  text. Both are valid; the builder chooses the one that reads strongest
  against the chosen accent weight.
- **Open decision (defer to builder judgment, not blocking):** whether the
  course title uses the incumbent serif headline at `text-2xl` or steps
  up to `text-3xl` on `sm` — the spine benefits from a touch more weight.

---

## Confirmation gate

Shape stops here. The next step is a directional roll under `new-work.md`
only if the builder wants the visual world itself re-decided (a real
redesign with a fresh concept deck). If the brief above is acceptable as
written, the builder proceeds directly to the four component rewrites
inside the constraints above, runs `vitest` after, then runs the
mechanical detector (`node .claude/skills/impeccable/scripts/detect.mjs
--json frontend/apps/vue-app/src/features/learning/components/`).