<!--
  ExerciseCard — 单个练习题卡.

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
</script>

<template>
  <div
    class="bg-card ring-border/40 rounded-2xl p-5 ring-1"
    :class="
      submitted
        ? result
          ? 'ring-success/40'
          : 'ring-destructive/40'
        : ''
    "
  >
    <!-- Header: 题号 + 题型 + 分值 -->
    <header class="mb-3 flex items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <span
          class="bg-accent/10 text-accent rounded-md px-2 py-0.5 font-mono text-xs font-medium"
        >
          Q{{ index }}
        </span>
        <span class="text-muted text-xs">
          {{
            exercise.type === 'single_choice'
              ? '单选'
              : exercise.type === 'multi_choice'
                ? '多选'
                : '判断'
          }}
        </span>
      </div>
      <span class="text-muted font-mono text-[11px]">
        {{ exercise.points }} 分 · 难度 {{ exercise.difficulty }}
      </span>
    </header>

    <!-- Prompt -->
    <p class="text-ink mb-4 text-sm leading-relaxed font-medium">
      {{ exercise.prompt }}
    </p>

    <!-- Choice options (single + multi) -->
    <div v-if="!isTrueFalse" class="space-y-2">
      <button
        v-for="opt in exercise.options ?? []"
        :key="opt.key"
        type="button"
        :disabled="submitted"
        class="border-border/60 bg-surface/30 text-ink hover:bg-surface/60 focus-visible:ring-ring/40 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
        :class="[
          !submitted && isMulti
            ? isMultiChecked(opt.key)
              ? 'bg-accent/10 border-accent/40'
              : ''
            : !submitted && selection === opt.key
              ? 'bg-accent/10 border-accent/40'
              : '',
          submitted && isCorrectOption(opt.key)
            ? 'ring-success/40 bg-success/10 border-success/40'
            : '',
          submitted && isWrongChoice(opt.key)
            ? 'ring-destructive/40 bg-destructive/10 border-destructive/40'
            : '',
        ]"
        @click="isMulti ? toggleMulti(opt.key) : pickSingle(opt.key)"
      >
        <span
          class="border-border/60 text-muted flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[11px]"
          :class="isMulti ? 'rounded-sm border' : 'rounded-full border'"
        >
          {{ opt.key }}
        </span>
        <span class="flex-1">{{ opt.text }}</span>
        <Check
          v-if="submitted && isCorrectOption(opt.key)"
          class="text-success h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- True / False -->
    <div v-else class="grid grid-cols-2 gap-2">
      <button
        type="button"
        :disabled="submitted"
        class="border-border/60 bg-surface/30 text-ink hover:bg-surface/60 focus-visible:ring-ring/40 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
        :class="[
          !submitted && selection === true ? 'bg-accent/10 border-accent/40' : '',
          submitted && exercise.answer === true
            ? 'ring-success/40 bg-success/10 border-success/40'
            : '',
          submitted && selection === true && exercise.answer !== true
            ? 'ring-destructive/40 bg-destructive/10 border-destructive/40'
            : '',
        ]"
        @click="pickTrueFalse(true)"
      >
        对
      </button>
      <button
        type="button"
        :disabled="submitted"
        class="border-border/60 bg-surface/30 text-ink hover:bg-surface/60 focus-visible:ring-ring/40 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
        :class="[
          !submitted && selection === false ? 'bg-accent/10 border-accent/40' : '',
          submitted && exercise.answer === false
            ? 'ring-success/40 bg-success/10 border-success/40'
            : '',
          submitted && selection === false && exercise.answer !== false
            ? 'ring-destructive/40 bg-destructive/10 border-destructive/40'
            : '',
        ]"
        @click="pickTrueFalse(false)"
      >
        错
      </button>
    </div>

    <!-- Submit / Result row -->
    <footer class="mt-4 flex flex-col gap-2">
      <div v-if="!submitted" class="flex justify-end">
        <button
          type="button"
          class="focus-visible:ring-ring/40 rounded-lg bg-accent text-contrast hover:bg-accent/90 px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canSubmit"
          @click="submit"
        >
          提交
        </button>
      </div>

      <div
        v-else
        class="rounded-lg px-3 py-2 text-sm leading-relaxed"
        :class="
          result
            ? 'bg-success/10 text-success'
            : 'bg-destructive/10 text-destructive'
        "
      >
        <div class="mb-1 flex items-center gap-2 font-medium">
          <Check v-if="result" class="h-4 w-4" aria-hidden="true" />
          <X v-else class="h-4 w-4" aria-hidden="true" />
          <span>
            {{ result ? '答对了' : `答错了 — 正确答案: ${correctAnswerLabel}` }}
          </span>
        </div>
        <p class="text-ink/80 text-xs">{{ exercise.explanation }}</p>
      </div>

      <div v-if="submitted" class="flex justify-end">
        <button
          type="button"
          class="text-muted hover:text-ink focus-visible:ring-ring/40 cursor-pointer text-xs transition-colors focus:outline-none focus-visible:ring-2"
          @click="reset"
        >
          重做
        </button>
      </div>
    </footer>
  </div>
</template>