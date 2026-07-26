<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { SubscriptionFormState } from '../types';
import { ModalFadeTransition } from '@/components';
import { cycleOptions, statusOptions } from '../subscriptionUtils';

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  submitText: string;
  loadingText: string;
  isSubmitting: boolean;
  form: SubscriptionFormState;
  errorMessage: string;
  currencySuggestions: string[];
  includeStatus?: boolean;
  mode: 'create' | 'edit';
}

const emit = defineEmits<{
  close: [];
  submit: [form: SubscriptionFormState];
}>();

const props = withDefaults(defineProps<Props>(), {
  includeStatus: false,
});

const localForm = reactive<SubscriptionFormState>({
  name: '',
  provider: '',
  price: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  next_billing_date: '',
  status: 'active',
  notes: '',
});

function syncLocalForm(source: SubscriptionFormState): void {
  localForm.name = source.name;
  localForm.provider = source.provider;
  localForm.price = source.price;
  localForm.currency = source.currency;
  localForm.billing_cycle = source.billing_cycle;
  localForm.next_billing_date = source.next_billing_date;
  localForm.status = source.status;
  localForm.notes = source.notes;
}

function emitSubmit(): void {
  emit('submit', {
    name: localForm.name,
    provider: localForm.provider,
    price: localForm.price,
    currency: localForm.currency,
    billing_cycle: localForm.billing_cycle,
    next_billing_date: localForm.next_billing_date,
    status: localForm.status,
    notes: localForm.notes,
  });
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      syncLocalForm(props.form);
    }
  },
  { immediate: true },
);
</script>

<template>
  <teleport to="body">
    <ModalFadeTransition>
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <button
          type="button"
          aria-label="关闭弹窗"
          class="bg-page/60 absolute inset-0 backdrop-blur-sm"
          @click="emit('close')"
        />
        <section
          class="bg-page relative z-10 w-full max-w-2xl rounded-2xl border p-5 shadow-2xl"
        >
          <header class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 class="text-ink text-lg font-semibold">
                {{ title }}
              </h3>
              <p class="text-muted mt-1 text-sm">
                {{ description }}
              </p>
            </div>
            <button
              type="button"
              class="text-muted hover:bg-surface rounded-lg border px-3 py-1 text-xs transition"
              @click="emit('close')"
            >
              关闭
            </button>
          </header>

          <form class="space-y-4" @submit.prevent="emitSubmit">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="space-y-1">
                <span class="text-muted text-xs font-medium">订阅名称</span>
                <input
                  v-model="localForm.name"
                  type="text"
                  placeholder="例如：Spotify Premium"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
              <label class="space-y-1">
                <span class="text-muted text-xs font-medium">服务商</span>
                <input
                  v-model="localForm.provider"
                  type="text"
                  placeholder="例如：Spotify"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
            </div>

            <div class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
              <label class="space-y-1">
                <span class="text-muted text-xs font-medium">价格</span>
                <input
                  v-model="localForm.price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
              <label class="space-y-1">
                <span class="text-muted text-xs font-medium">币种</span>
                <input
                  v-model="localForm.currency"
                  type="text"
                  :list="`subscription-currency-options-${mode}`"
                  maxlength="10"
                  placeholder="例如：USD / CNY / 元"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
                <datalist :id="`subscription-currency-options-${mode}`">
                  <option
                    v-for="currency in currencySuggestions"
                    :key="currency"
                    :value="currency"
                  />
                </datalist>
              </label>
              <label class="space-y-1">
                <span class="text-muted text-xs font-medium">计费周期</span>
                <select
                  v-model="localForm.billing_cycle"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                >
                  <option
                    v-for="cycle in cycleOptions"
                    :key="cycle.value"
                    :value="cycle.value"
                  >
                    {{ cycle.label }}
                  </option>
                </select>
              </label>
            </div>

            <div
              class="grid gap-3"
              :class="includeStatus ? 'sm:grid-cols-2' : ''"
            >
              <label class="space-y-1">
                <span class="text-muted text-xs font-medium">下次扣费日期</span>
                <input
                  v-model="localForm.next_billing_date"
                  type="date"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
              <label v-if="includeStatus" class="space-y-1">
                <span class="text-muted text-xs font-medium">状态</span>
                <select
                  v-model="localForm.status"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                >
                  <option
                    v-for="status in statusOptions"
                    :key="status.value"
                    :value="status.value"
                  >
                    {{ status.label }}
                  </option>
                </select>
              </label>
            </div>

            <label class="space-y-1">
              <span class="text-muted text-xs font-medium">备注</span>
              <textarea
                v-model="localForm.notes"
                rows="3"
                placeholder="可选备注，例如套餐人数、自动续费规则等。"
                class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
              />
            </label>

            <p
              v-if="errorMessage"
              class="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {{ errorMessage }}
            </p>

            <footer class="flex justify-end gap-2">
              <button
                type="button"
                class="text-muted hover:bg-surface rounded-xl border px-3 py-2 text-sm transition"
                @click="emit('close')"
              >
                取消
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="bg-accent text-ink hover:bg-accent/90 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ isSubmitting ? loadingText : submitText }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </ModalFadeTransition>
  </teleport>
</template>
