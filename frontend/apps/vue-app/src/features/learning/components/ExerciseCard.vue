<!--
  ExerciseCard — 单个练习题卡.

  视觉契约:
   - card 外壳:bg-card + rounded-2xl + shadow-sm,答题后整体阴影换色(success/destructive)。
   - 选项:pill 化的圆角 xl 行,选中态 bg-accent/10 + shadow-accent/20 + 上抬,
     正确/错误由 bg + shadow + text color 三者协同表达。
   - 结果栏:独立的圆角 2xl callout,带 left border + 软阴影。

  行为契约:
   - 根据 exercise.type 渲染三种 UI:
       single_choice → radio(单选)
       multi_choice  → checkbox(多选)
       true_false    → 对/错 两按钮
   - 提交后做客户端判分:比较 selection 与 exercise.answer。
       single_choice  →  string 全等
       multi_choice   →  array 排序后逐项相等(顺序无关)
       true_false     →  boolean 全等
   - 判分结果用 3 态呈现:未作答 / 答错(展示 explanation + 正确答案) /
     答对(展示 explanation)。提交前禁用下一题 / 进度按钮。
   - 父组件通过 @answered(correct: boolean) 收到判分结果,做汇总。
-->
<script setup lang="ts">
import { Check, X } from '@lucide/vue';
import { computed, ref } from 'vue';
import type { Exercise } from '@/features/learning/types';

defineOptions({ name: 'ExerciseCard' });

const props = defineProps<{
  exercise: Exercise;
  /** 题号(从 1 开始),仅用于展示,不参与判分。 */
  index: number;
}>();

const emit = defineEmits<{
  answered: [correct: boolean];
}>();

// ── 状态 ──────────────────────────────────────────────────────────────────
/** 单选 / 判断 当前选择;多选用 array(集合)。 */
const selection = ref<string | boolean | string[] | null>(null);
/** 是否已提交判分。 */
const submitted = ref(false);
/** 判分结果;null = 未判分。 */
const result = ref<boolean | null>(null);

const isMulti = computed(() => props.exercise.type === 'multi_choice');
const isTrueFalse = computed(
  () => props.exercise.type === 'true_false',
);
const correctAnswerLabel = computed(() => {
  const a = props.exercise.answer;
  if (Array.isArray(a)) return a.join(' / ');
  if (typeof a === 'boolean') return a ? '对' : '错';
  return a;
});

/** 模板辅助:某选项 key 是否命中参考答案(用于提交后高亮正确选项)。 */
function isCorrectOption(key: string): boolean {
  const a = props.exercise.answer;
  if (typeof a === 'string') return a === key;
  if (Array.isArray(a)) return a.includes(key);
  return false;
}

// ── 选择处理 ─────────────────────────────────────────────────────────────
function pickSingle(key: string) {
  if (submitted.value) return;
  selection.value = key;
}

function pickTrueFalse(v: boolean) {
  if (submitted.value) return;
  selection.value = v;
}

function toggleMulti(key: string) {
  if (submitted.value) return;
  const cur = (selection.value as string[] | null) ?? [];
  const next = cur.includes(key)
    ? cur.filter((k) => k !== key)
    : [...cur, key];
  selection.value = next;
}

function isMultiChecked(key: string): boolean {
  const cur = (selection.value as string[] | null) ?? [];
  return cur.includes(key);
}

const canSubmit = computed(() => {
  if (submitted.value) return false;
  const s = selection.value;
  if (s === null) return false;
  if (Array.isArray(s)) return s.length > 0;
  return true;
});

// ── 判分 ─────────────────────────────────────────────────────────────────
function submit() {
  if (!canSubmit.value) return;
  result.value = grade(props.exercise, selection.value);
  submitted.value = true;
  emit('answered', result.value);
}

/**
 * 客户端判分:
 *  - single_choice:严格 string 相等
 *  - multi_choice :排序后逐项相等(顺序无关)
 *  - true_false   :严格 boolean 相等
 */
function grade(e: Exercise, sel: string | boolean | string[] | null): boolean {
  if (sel === null) return false;
  if (e.type === 'single_choice') {
    return typeof sel === 'string' && sel === e.answer;
  }
  if (e.type === 'multi_choice') {
    if (!Array.isArray(sel) || !Array.isArray(e.answer)) return false;
    const a = [...sel].sort();
    const b = [...e.answer].sort();
    if (a.length !== b.length) return false;
    return a.every((k, i) => k === b[i]);
  }
  // true_false
  return typeof sel === 'boolean' && sel === e.answer;
}

function reset() {
  selection.value = null;
  submitted.value = false;
  result.value = null;
}

/** 用户选错了某选项(用于标红错误选择)。 */
function isWrongChoice(key: string): boolean {
  if (isMulti.value) {
    return isMultiChecked(key) && !isCorrectOption(key);
  }
  return selection.value === key && !isCorrectOption(key);
}

/** 选项行的容器类 — 选中 / 正确 / 错误三态。 */
function optionContainerCls(key: string): string {
  if (submitted.value) {
    if (isCorrectOption(key)) {
      return 'text-ink bg-success/10 shadow-success/20 shadow-sm';
    }
    if (isWrongChoice(key)) {
      return 'text-ink bg-destructive/10 shadow-destructive/20 shadow-sm';
    }
    return 'bg-card text-muted';
  }
  // 未提交:当前选中 = bg-accent/10 + shadow-accent/20 + 微上抬
  if (isMulti.value) {
    return isMultiChecked(key)
      ? 'bg-accent/10 text-ink shadow-accent/20 -translate-y-0.5 shadow-md'
      : 'bg-card text-ink';
  }
  return selection.value === key
    ? 'bg-accent/10 text-ink shadow-accent/20 -translate-y-0.5 shadow-md'
    : 'bg-card text-ink';
}

function optionKeyCls(key: string): string {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium shadow-inner';
  if (submitted.value) {
    if (isCorrectOption(key)) return `${base} bg-success/20 text-ink`;
    if (isWrongChoice(key)) return `${base} bg-destructive/20 text-ink`;
    return `${base} bg-surface/60 text-muted`;
  }
  if (isMulti.value) {
    return isMultiChecked(key)
      ? `${base} bg-accent text-contrast`
      : `${base} bg-surface/60 text-muted`;
  }
  return selection.value === key
    ? `${base} bg-accent text-contrast`
    : `${base} bg-surface/60 text-muted`;
}
</script>

<template>
  <article
    class="bg-card rounded-2xl p-5 shadow-sm transition-all duration-300 sm:p-6"
    :class="
      submitted
        ? result
          ? 'shadow-success/20 shadow-md'
          : 'shadow-destructive/20 shadow-md'
        : ''
    "
  >
    <!-- Header: 题号 + 题型 + 分值 -->
    <header class="mb-4 flex items-baseline justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <span
          class="bg-accent/15 text-accent rounded-full px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums"
        >
          Q{{ String(index).padStart(2, '0') }}
        </span>
        <span
          class="text-muted font-mono text-[11px] font-medium tracking-[0.18em] uppercase"
        >
          {{
            exercise.type === 'single_choice'
              ? '单选'
              : exercise.type === 'multi_choice'
                ? '多选'
                : '判断'
          }}
        </span>
      </div>
      <span
        class="bg-surface/60 text-muted rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-[0.12em] uppercase tabular-nums shadow-inner"
      >
        {{ exercise.points }} 分 · 难度 {{ exercise.difficulty }}
      </span>
    </header>

    <!-- Prompt -->
    <p class="text-ink mb-5 text-base leading-relaxed font-medium">
      {{ exercise.prompt }}
    </p>

    <!-- Choice options (single + multi) -->
    <div v-if="!isTrueFalse" class="space-y-2">
      <button
        v-for="opt in exercise.options ?? []"
        :key="opt.key"
        type="button"
        :disabled="submitted"
        class="hover:bg-surface/60 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-70"
        :class="optionContainerCls(opt.key)"
        @click="isMulti ? toggleMulti(opt.key) : pickSingle(opt.key)"
      >
        <span :class="optionKeyCls(opt.key)">
          {{ opt.key }}
        </span>
        <span class="flex-1">{{ opt.text }}</span>
        <Check
          v-if="submitted && isCorrectOption(opt.key)"
          class="h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- True / False -->
    <div v-else class="grid grid-cols-2 gap-3">
      <button
        type="button"
        :disabled="submitted"
        class="rounded-2xl py-4 text-center font-mono text-sm transition-all duration-300 focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-70"
        :class="
          submitted
            ? exercise.answer === true
              ? 'text-ink bg-success/15 shadow-success/20 shadow-md'
              : selection === true
                ? 'text-ink bg-destructive/10 shadow-destructive/20 shadow-md'
                : 'bg-card text-muted shadow-sm'
            : selection === true
              ? 'bg-accent/10 text-accent shadow-accent/20 -translate-y-0.5 shadow-md'
              : 'bg-card text-ink shadow-sm'
        "
        @click="pickTrueFalse(true)"
      >
        对
      </button>
      <button
        type="button"
        :disabled="submitted"
        class="rounded-2xl py-4 text-center font-mono text-sm transition-all duration-300 focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-70"
        :class="
          submitted
            ? exercise.answer === false
              ? 'text-ink bg-success/15 shadow-success/20 shadow-md'
              : selection === false
                ? 'text-ink bg-destructive/10 shadow-destructive/20 shadow-md'
                : 'bg-card text-muted shadow-sm'
            : selection === false
              ? 'bg-accent/10 text-accent shadow-accent/20 -translate-y-0.5 shadow-md'
              : 'bg-card text-ink shadow-sm'
        "
        @click="pickTrueFalse(false)"
      >
        错
      </button>
    </div>

    <!-- Submit / Result row -->
    <footer class="mt-5 flex flex-col gap-3">
      <div v-if="!submitted" class="flex justify-end">
        <button
          type="button"
          class="bg-accent text-contrast shadow-accent/30 rounded-full px-5 py-1.5 font-mono text-[11px] font-medium tracking-[0.18em] uppercase shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canSubmit"
          @click="submit"
        >
          提交
        </button>
      </div>

      <div
        v-else
        class="text-ink rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
        :class="
          result
            ? 'bg-success/10 shadow-success/15'
            : 'bg-destructive/10 shadow-destructive/15'
        "
      >
        <div
          class="mb-1 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] uppercase"
        >
          <Check
            v-if="result"
            class="text-success h-3.5 w-3.5"
            aria-hidden="true"
          />
          <X v-else class="text-destructive h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {{ result ? '答对了' : `答错了 — 正确答案: ${correctAnswerLabel}` }}
          </span>
        </div>
        <p class="text-ink/80 text-xs">{{ exercise.explanation }}</p>
      </div>

      <div v-if="submitted" class="flex justify-end">
        <button
          type="button"
          class="text-muted hover:text-ink focus-visible:ring-ring rounded-full px-3 py-1 font-mono text-[11px] font-medium tracking-[0.18em] uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          @click="reset"
        >
          重做
        </button>
      </div>
    </footer>
  </article>
</template>
