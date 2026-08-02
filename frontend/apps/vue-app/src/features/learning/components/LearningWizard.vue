<!--
  LearningWizard — /learning 新增表单的三段向导子组件 (task-393 拆分).

  视觉契约:
   - 顶部 TOC(i / ii / iii)+ 进度条;点击任意 label 切段,不强制顺序。
   - 三段共享同一个基座 input 样式(原 inputCls),不再各自写一遍。
   - 02 / 03 都标"可选";02 提供"跳过 → 直接生成"的快速通道,
     让匿名 / 急用用户不必走完整流程。

  行为契约:
   - 受控组件:三个 v-model 由父组件持有,本组件只负责 step 切换与提交触发。
   - submit 事件不带 payload —— 父组件读自己的 refs 调 submitTopic。
     原因:step 3 同时调起父组件的「生成课程」按钮(测试断言 findAll('button')
     能找到「生成课程」字样),用 click 转发会双触发。
   - keydown.enter 在 step 1 等价于「下一步」;step 2 / 3 直接 submit。
   - 三个 step panel 共享 motion-v 入场 + 离场动画:由 AnimatePresence(mode="wait")
     包起来,mode="wait" 让一段走完再进下一个,避免双段重叠。
     AnimatePresence `:initial="false"` 让 wizard 首屏不重复入场(TOC 已经
     入场),仅 step 间切换才走 enter/leave。reduced-motion 时全部关闭。

  受父组件约束:
   - 必须保留至少 3 个 `<input type="text">`(topic / goal / extra_prompt),
     DOM 顺序就是 topic → goal → extra_prompt — 让上层组件(e2e 测试、
     自动化脚本)按 `inputs[0/1/2]` 查找时不依赖 wizard 的当前 step。
   - 至少有 1 个按钮文案含"生成课程",在 step 3 主按钮上;topic 为空时
     该按钮 + step 2 「跳过 → 直接生成」按钮 + step 1 「下一步」按钮
     均 disabled(`!canProceed`),enter 键在 topic input 上等价于
     「下一步」(同样尊重守卫)。
   - 必有 1 个按钮文案含"下一步",分别在 step 1 / step 2。
   - 必有 1 个按钮文案含"上一步",在 step 2 / step 3。
   - 模型下拉已迁入 step 3 内(本组件自带 HoverDropdown),父组件通过 props
     传 models / modelDraft / isOptionDisabled,监听 `update:modelDraft`。
-->
<script setup lang="ts">
import { ArrowLeft, ArrowRight, ChevronDown, Sparkles } from '@lucide/vue';
import { useMediaQuery } from '@vueuse/core';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref } from 'vue';
import { Button, HoverDropdown } from '@/components';
import { EASE } from '@/constants/motionPresets';
import type { LearningModel } from '@/features/learning/types';

defineOptions({ name: 'LearningWizard' });

interface Props {
  /** 主题 draft(topic),父组件持有。 */
  topic: string;
  /** 学习目标 draft(goal),父组件持有。 */
  goal: string;
  /** 补充要求 draft(extra_prompt),父组件持有。 */
  extraPrompt: string;
  /** 是否处于提交中(后端生成期间禁用所有交互)。 */
  submitting: boolean;
  /** 可用模型列表(来自 listModels)。 */
  models: readonly LearningModel[];
  /** 当前选中的模型 id(父组件持有,提交时透传给 createCourse)。 */
  modelDraft: string;
  /** 判定某个模型选项是否应被禁用(premium 模型未登录态禁用等)。 */
  isOptionDisabled: (modelIsPremium: boolean) => boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:topic', value: string): void;
  (e: 'update:goal', value: string): void;
  (e: 'update:extraPrompt', value: string): void;
  (e: 'update:modelDraft', value: string): void;
  (e: 'submit'): void;
}>();

/** 当前 step:1 主题 / 2 目标 / 3 进阶(模型 + 补充要求)。 */
const currentStep = ref<1 | 2 | 3>(1);

/** prefers-reduced-motion:开启时禁用入场动画。 */
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

/** step 1 的「下一步」按钮要求 draft 非空;空 draft 禁用。 */
const canProceed = computed(() => props.topic.trim().length > 0);

/** 主题 / 目标 / 补充要求 三个输入框共享的基座样式 — 从原 LearningList 平移过来。 */
const inputCls =
  'text-ink placeholder-muted bg-surface/60 focus-visible:ring-ring rounded-full px-5 py-2.5 text-sm shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60';

/** 当前选中的模型条目(找不到则回退到列表第一项)。 */
const selectedModel = computed(
  () =>
    props.models.find((m) => m.id === props.modelDraft) ??
    props.models[0] ??
    null,
);

/** 模型下拉是否可交互(列表为空时禁用)。 */
const modelOptionsDisabled = computed(() => props.models.length === 0);

function setTopic(v: string) {
  emit('update:topic', v);
}
function setGoal(v: string) {
  emit('update:goal', v);
}
function setExtra(v: string) {
  emit('update:extraPrompt', v);
}

/** 模型选择:来自父组件的判定;disabled 时直接吞掉点击。 */
function selectModel(id: string, isPremium: boolean) {
  if (props.isOptionDisabled(isPremium)) return;
  emit('update:modelDraft', id);
}

/** 切段:点 TOC label 任意位置直接跳。 */
function gotoStep(n: 1 | 2 | 3) {
  currentStep.value = n;
}

/** step 1 → step 2:要求 draft 非空,否则按钮 disabled。 */
function nextFromTopic() {
  if (!canProceed.value) return;
  currentStep.value = 2;
}

/** step 2 → step 3。 */
function nextFromGoal() {
  currentStep.value = 3;
}

/** 父组件持有 submitTopic;emit 触发即可。
 *  校验:topic 必须非空(composable 内部也会再次 trim 校验,但 UI 层早
 *  一步拦下,避免空 topic 时走一趟 emit → 父组件 submitTopic → 抛错
 *  → error 文案展示这条慢路径;直接 disable 按钮 + 吞掉 enter 更快)。 */
function submit() {
  if (!canProceed.value) return;
  emit('submit');
}
</script>

<template>
  <!-- 顶部 TOC:三段 i / ii / iii -->
  <nav aria-label="创建课程步骤" class="mb-7" data-testid="learning-wizard-toc">
    <ol
      class="text-muted grid grid-cols-3 gap-3 font-mono text-[11px] tracking-[0.18em] uppercase"
    >
      <li>
        <button
          type="button"
          :data-step="1"
          :aria-current="currentStep === 1 ? 'step' : undefined"
          class="step-node w-full text-left transition-colors"
          :class="currentStep === 1 ? 'text-ink' : 'text-muted hover:text-ink'"
          @click="gotoStep(1)"
        >
          <span class="flex items-center gap-2">
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium tabular-nums transition-colors"
              :class="
                currentStep >= 1
                  ? 'border-ink text-ink'
                  : 'border-muted text-muted'
              "
            >
              1
            </span>
            <span>主题</span>
          </span>
        </button>
      </li>
      <li>
        <button
          type="button"
          :data-step="2"
          :aria-current="currentStep === 2 ? 'step' : undefined"
          class="step-node w-full text-left transition-colors"
          :class="currentStep === 2 ? 'text-ink' : 'text-muted hover:text-ink'"
          @click="gotoStep(2)"
        >
          <span class="flex items-center gap-2">
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium tabular-nums transition-colors"
              :class="
                currentStep >= 2
                  ? 'border-ink text-ink'
                  : 'border-muted text-muted'
              "
            >
              2
            </span>
            <span>目标 · 可选</span>
          </span>
        </button>
      </li>
      <li>
        <button
          type="button"
          :data-step="3"
          :aria-current="currentStep === 3 ? 'step' : undefined"
          class="step-node w-full text-left transition-colors"
          :class="currentStep === 3 ? 'text-ink' : 'text-muted hover:text-ink'"
          @click="gotoStep(3)"
        >
          <span class="flex items-center gap-2">
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium tabular-nums transition-colors"
              :class="
                currentStep >= 3
                  ? 'border-ink text-ink'
                  : 'border-muted text-muted'
              "
            >
              3
            </span>
            <span>进阶 · 可选</span>
          </span>
        </button>
      </li>
    </ol>
    <div class="bg-border relative mt-3 h-px">
      <div
        class="bg-accent absolute top-0 left-0 h-px transition-all duration-500 ease-out"
        :style="{ width: `${(currentStep / 3) * 100}%` }"
        aria-hidden="true"
      />
    </div>
  </nav>

  <!-- step 1-3 由 AnimatePresence 包起来,mode="wait" 让一段走完再进下一个。
       每个 section 自带 key,触发 leave/enter 动画;reduced-motion 时关闭。 -->
  <AnimatePresence mode="wait" :initial="false">
    <motion.section
      v-if="currentStep === 1"
      key="step-1"
      data-testid="learning-wizard-step-1"
      :initial="reducedMotion ? false : { opacity: 0, y: 4 }"
      :animate="reducedMotion ? undefined : { opacity: 1, y: 0 }"
      :exit="reducedMotion ? undefined : { opacity: 0, y: -4 }"
      :transition="{ ...EASE, duration: 0.28 }"
    >
      <label
        for="learning-topic"
        class="text-muted mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
      >
        主题
      </label>
      <input
        id="learning-topic"
        :value="topic"
        type="text"
        :disabled="submitting"
        placeholder="康德《纯粹理性批判》的先验演绎"
        maxlength="120"
        :class="[inputCls, 'w-full text-base']"
        @input="setTopic(($event.target as HTMLInputElement).value)"
        @keydown.enter="nextFromTopic"
      />
      <p class="text-muted mt-2 text-xs leading-relaxed">
        一句话描述你想学的主题。
      </p>
      <div class="mt-6 flex items-center justify-between">
        <span
          class="text-muted font-mono text-[10px] tracking-[0.18em] uppercase"
        >
          step 1 / 3
        </span>
        <Button
          size="md"
          :disabled="!canProceed || submitting"
          class="shrink-0"
          @click="nextFromTopic"
        >
          <span class="font-mono">下一步</span>
          <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </motion.section>

    <!-- Step 2 · 目标 -->
    <motion.section
      v-else-if="currentStep === 2"
      key="step-2"
      data-testid="learning-wizard-step-2"
      :initial="reducedMotion ? false : { opacity: 0, y: 4 }"
      :animate="reducedMotion ? undefined : { opacity: 1, y: 0 }"
      :exit="reducedMotion ? undefined : { opacity: 0, y: -4 }"
      :transition="{ ...EASE, duration: 0.28 }"
    >
      <label
        for="learning-goal"
        class="text-muted mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
      >
        学习目标 (可选)
      </label>
      <input
        id="learning-goal"
        :value="goal"
        type="text"
        :disabled="submitting"
        placeholder="能独立复述先验演绎的论证结构,并完成 5 道自测题"
        maxlength="200"
        :class="[inputCls, 'w-full text-base']"
        @input="setGoal(($event.target as HTMLInputElement).value)"
        @keydown.enter="nextFromGoal"
      />
      <p class="text-muted mt-2 text-xs leading-relaxed">
        写一句「学完之后我能…」,会被写进课程的 MISSION.md。
      </p>
      <div class="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="md"
          :disabled="submitting"
          class="text-muted hover:text-ink"
          @click="gotoStep(1)"
        >
          <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
          <span class="font-mono">上一步</span>
        </Button>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            :disabled="!canProceed || submitting"
            class="text-muted hover:text-ink"
            @click="submit"
          >
            <span class="font-mono">跳过 → 直接生成</span>
          </Button>
          <Button
            size="md"
            :disabled="submitting"
            class="shrink-0"
            @click="nextFromGoal"
          >
            <span class="font-mono">下一步</span>
            <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.section>

    <!-- Step 3 · 进阶:模型 + 补充要求 -->
    <motion.section
      v-else
      key="step-3"
      data-testid="learning-wizard-step-3"
      :initial="reducedMotion ? false : { opacity: 0, y: 4 }"
      :animate="reducedMotion ? undefined : { opacity: 1, y: 0 }"
      :exit="reducedMotion ? undefined : { opacity: 0, y: -4 }"
      :transition="{ ...EASE, duration: 0.28 }"
    >
      <label
        class="text-muted mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
      >
        模型
      </label>
      <HoverDropdown
        :panel-class="'bg-card border-border absolute top-full left-0 z-30 mt-2 w-full min-w-[14rem] rounded-2xl border p-1.5 shadow-lg backdrop-blur-xs'"
        class="relative block w-full"
      >
        <template #trigger="{ isOpen }">
          <button
            type="button"
            :aria-expanded="isOpen || undefined"
            aria-haspopup="listbox"
            aria-label="选择学习模型"
            :disabled="modelOptionsDisabled || submitting"
            class="text-ink bg-surface/60 focus-visible:ring-ring focus-visible:ring-offset-card flex w-full items-center justify-between rounded-full px-5 py-2.5 text-sm shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span class="inline-flex items-center gap-2 truncate">
              <Sparkles
                v-if="selectedModel"
                class="text-accent h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span class="truncate">
                {{ selectedModel?.label ?? '加载中…' }}
              </span>
              <span
                v-if="selectedModel?.is_premium"
                class="bg-accent/15 text-accent rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase"
              >
                PRO
              </span>
            </span>
            <ChevronDown
              class="text-muted h-3.5 w-3.5 shrink-0 transition-transform duration-150"
              :class="{ 'rotate-180': isOpen }"
              aria-hidden="true"
            />
          </button>
        </template>
        <template #default="{ close }">
          <ul
            role="listbox"
            aria-label="选择学习模型"
            class="flex flex-col gap-0.5"
          >
            <li
              v-for="m in models"
              :key="m.id"
              role="option"
              :aria-selected="m.id === modelDraft"
              :aria-disabled="isOptionDisabled(m.is_premium) || undefined"
            >
              <button
                type="button"
                :disabled="isOptionDisabled(m.is_premium)"
                :title="
                  isOptionDisabled(m.is_premium) ? '登录后解锁' : undefined
                "
                class="text-ink hover:bg-surface/70 focus-visible:ring-offset-card focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                :class="{
                  'decoration-accent font-medium underline decoration-2 underline-offset-4':
                    m.id === modelDraft,
                }"
                @click="
                  selectModel(m.id, m.is_premium);
                  close();
                "
              >
                <span class="inline-flex items-center gap-2 truncate">
                  <Sparkles
                    class="text-accent h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="truncate">{{ m.label }}</span>
                </span>
                <span
                  v-if="m.is_premium"
                  class="bg-accent/15 text-accent rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase"
                >
                  PRO
                </span>
              </button>
            </li>
          </ul>
        </template>
      </HoverDropdown>

      <label
        for="learning-extra-prompt"
        class="text-muted mt-5 mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
      >
        补充要求 (可选)
      </label>
      <textarea
        id="learning-extra-prompt"
        :value="extraPrompt"
        :disabled="submitting"
        placeholder="例如:面向初学者,优先讲解入门概念,避免抽象数学符号"
        maxlength="200"
        :class="[inputCls, 'w-full', 'resize-none', 'h-20', 'rounded-2xl!']"
        @input="setExtra(($event.target as HTMLTextAreaElement).value)"
        @keydown.enter="submit"
      />
      <p class="text-muted mt-2 text-xs leading-relaxed">
        课程生成约需 1-3 分钟,生成完成后会自动跳转到课程详情页。
      </p>
      <div class="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="md"
          :disabled="submitting"
          class="text-muted hover:text-ink"
          @click="gotoStep(2)"
        >
          <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
          <span class="font-mono">上一步</span>
        </Button>
        <Button
          size="md"
          :disabled="!canProceed || submitting"
          class="shrink-0"
          @click="submit"
        >
          <span class="font-mono">生成课程</span>
          <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </motion.section>
  </AnimatePresence>
</template>
