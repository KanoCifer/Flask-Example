<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences reach the AI 学习 (`/learning`) module:

1. **Owner** — kanocifer (the site author). Power user. Captures learning prompts,
   generates courses on demand, works through lessons, marks progress, archives
   finished tracks. Visits the surface many times a week; expects author-grade
   ergonomics and zero ceremony.
2. **Visitor** — anyone landing on `/learning` from elsewhere on the site or
   the open web. Curious. Reads the experience as a public artifact of the
   author's learning practice; may not interact past the first viewport.

Both audiences share the same anonymous owner key (`getAnonId()`) — there is no
auth wall.

## Product Purpose

The AI 学习 module is an asynchronous course generator: a visitor types a topic
(or topic + learning goal), the backend generates a course package
(`讲义 · 资源 · 练习`), and the visitor progresses through one lesson at a time,
generating the next lesson on demand. It exists to let the owner turn any topic
prompt into a personal, narrated learning trail — and to let visitors see that
trail as evidence of how the owner learns.

Success = a topic prompt lands, a course package is produced in 10–30s, the
owner can move through lessons, mark progress, and return later to find their
state intact. Visitors can browse generated courses without account friction.

## Positioning

The differentiating mechanism is **prompt-to-package**: a single natural-language
topic (optionally paired with a learning goal) yields a complete
lesson-exercises-resource triple, with lessons materialized progressively on
demand. This is not a flashcard app, not a notebook, not an LMS — it is a
*prompt → curated learning artifact* pipeline that the owner drives and visitors
read.

## Operating Context

- Anonymous-friendly, no login. Identity is the local owner key from `getAnonId()`.
- Backend (FastAPI `/v2` + Go `/v3`) generates courses asynchronously (LLM-driven);
  the UI polls for ready state and shows a generation card.
- Lessons are produced one at a time after course generation completes; the
  learner triggers the next lesson generation explicitly.
- Markdown (`lesson.md`, `course.resource_md`, `course.mission_md`) is rendered
  in-place via `renderMarkdown`.
- Routes: `/learning` (list + generator), `/learning/course/:courseId`
  (overview), `/learning/course/:courseId/lesson/:lessonId` (lesson + exercises).
- Dual-frontend project (Vue + React); this PRODUCT.md is scoped to the Vue
  app at `frontend/apps/vue-app/`. The React app maintains parallel state.

## Capabilities and Constraints

- Course lifecycle states: `pending → ready | failed`. UI polls
  `getCourse(courseId)` at 1.5s, 120s overall timeout.
- Progressive lesson generation: `pending → already_generated | failed`, 90s
  timeout, polling for `lessons.length` to grow.
- Client-side grading only for exercises (`single_choice`, `multi_choice`,
  `true_false`); progress writes are PATCH'd to backend on
  `markSessionDone` / `markExerciseDone`.
- Composables live in `features/learning/composables/useLearningCourse.ts`;
  API gateway lives in `features/learning/api/index.ts` (forwards to
  `@readinglist/api`'s `learningGateway`); types from `@readinglist/types`.
- Stack: Vue 3, Pinia-style local state via composable refs, Tailwind v4,
  lucide-vue icons, Vue Router.
- Constraints from `CLAUDE.md`: semantic Tailwind classes only (no hardcoded
  colors); no `pnpm build` unless asked; Python deps via `uv` (backend only).

## Brand Commitments

- Personal site for kanocifer ("kuro neko" / 黑猫).
- Bilingual copy with Chinese as primary UI language.
- Visual identity lives in `frontend/` tokens; the Vue app inherits them.
- "kuro neko" name and the dark-cat metaphor are the established identity
  anchors — present elsewhere on the site; do not contradict, do not over-use.

## Evidence on Hand

- Incumbent UI: `features/learning/components/LearningList.vue`,
  `CourseView.vue`, `LessonView.vue`, `ExerciseCard.vue`. Visually generic
  Vue Tailwind: rounded-2xl cards, soft accent-tinted icon chips, serif
  headline ("学习工作台"), muted body text, lucide icons, status badges with
  `/15` opacity token tricks.
- Composables: `features/learning/composables/useLearningCourse.ts` —
  substantively rich (poll lifecycle, progressive lessons, client grading).
- API: `learningGateway` (createCourse, getCourse, generateNextLesson,
  markProgress, listProgress) — backend contracts stable; do not invent new
  endpoints.
- Types: `@readinglist/types` exports `LearningCourse`, `LearningLesson`,
  `Exercise`, `LearningProgressItem`, etc. — the data shape is fixed.

What future work must not fabricate: synthetic course titles or topics to
furnish the UI; real visitor testimonials; completion-rate or any learning
outcome metrics; backend capability claims beyond what `learningGateway`
already exposes.

## Product Principles

1. **The topic prompt is the front door.** Every visit that does not already
   have a course to resume should land within one screen of a working topic
   input. Capture is the default verb, not browse.
2. **Progress is visible state, not a buried metric.** Done/current/todo is
   legible at every layer (course overview, lesson list, exercise result)
   without expanding a panel.
3. **Generation latency is part of the experience, not a delay to hide.**
   The 10–30s gap between prompt and ready course is a moment of anticipation;
   design owns it rather than apologizes for it.
4. **Owner and visitor share the same surface, but the owner moves faster.**
   Power-user affordances (keyboard enter to submit, optimistic progress,
   one-click resume) live alongside visitor-legible copy and structure.
5. **Lesson is the unit of progress; the course is the unit of identity.**
   Visitors should be able to read the course *as an artifact*; the owner
   moves through it lesson by lesson.

## Accessibility & Inclusion

- Honors `prefers-reduced-motion` for all spin and transition animations
  (already present in incumbent).
- Keyboard-only flow: topic input + Enter to submit, button focus rings,
  disabled states on submitting/advancing actions.
- Anonymous access — no auth barrier to first-run or browse.
- Chinese-language UI; no localization work is in scope for this surface yet.