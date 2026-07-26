<script setup lang="ts">
import type { Subscription } from '@/features/rss';

interface Props {
  subscriptions: Subscription[];
  selectedSubId: number | null;
  isLoading: boolean;
  errorMessage: string;
  pendingStatusId: number | null;
  deletePendingId: number | null;
  toDateInputValue: (value: string) => string;
  getDaysUntil: (value: string) => number;
  getCycleLabel: (cycle: string) => string;
  formatPrice: (price: number, currency: string) => string;
  getStatusMeta: (status: string) => {
    label: string;
    dotClass: string;
    badgeClass: string;
  };
  getReminderChannelsText: (config: Record<string, unknown> | null) => string;
  getReminderPointsText: (config: Record<string, unknown> | null) => string;
}

defineProps<Props>();

const emit = defineEmits<{
  select: [subId: number];
  retry: [];
  edit: [subscription: Subscription];
  reminder: [subscription: Subscription];
  toggleStatus: [subscription: Subscription];
  delete: [subscription: Subscription];
}>();
</script>

<template>
  <section class="/80 bg-card rounded-3xl border p-5 shadow-sm">
    <header class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-ink text-sm font-semibold tracking-wide uppercase">
        订阅列表
      </h3>
      <p class="text-muted text-xs">{{ subscriptions.length }} 项</p>
    </header>

    <div
      v-if="errorMessage"
      class="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-xl border px-4 py-3 text-sm"
    >
      <div class="flex items-center justify-between gap-4">
        <span>{{ errorMessage }}</span>
        <button
          type="button"
          class="bg-destructive text-destructive-muted hover:bg-destructive/90 rounded-lg px-3 py-1.5 text-xs font-medium transition"
          @click="emit('retry')"
        >
          重试
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <div
        v-for="idx in 3"
        :key="idx"
        class="/70 bg-surface/80 animate-pulse rounded-2xl border p-6"
      >
        <div class="bg-surface mb-4 h-5 w-36 rounded-full" />
        <div class="bg-surface h-10 rounded-2xl" />
      </div>
    </div>

    <div
      v-else-if="subscriptions.length === 0"
      class="bg-surface/50 text-muted rounded-2xl border border-dashed px-5 py-10 text-center text-sm"
    >
      还没有订阅记录，点击「新增订阅」开始管理。
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="subscription in subscriptions"
        :key="subscription.id"
        class="bg-card /10 cursor-pointer rounded-2xl border p-5 shadow-[0_12px_40px_rgb(0,0,0,0.04)] transition hover:shadow-[0_20px_50px_rgb(0,0,0,0.06)]"
        :class="
          selectedSubId === subscription.id
            ? 'border-accent/30 ring-accent/20 ring-2'
            : ''
        "
        @click="emit('select', subscription.id)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-4">
            <div
              class="bg-page text-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold"
            >
              {{ subscription.name.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <h4 class="text-ink truncate text-lg font-bold">
                {{ subscription.name }}
              </h4>
              <p class="text-muted mt-0.5 text-xs">
                {{ subscription.provider }} ·
                {{ getCycleLabel(subscription.billing_cycle) }}
              </p>
            </div>
          </div>

          <div class="text-right">
            <p class="text-brand-devices text-xl font-bold">
              {{ formatPrice(subscription.price, subscription.currency) }}
            </p>
            <p class="text-muted text-[10px] tracking-wider uppercase">
              {{ subscription.currency }}
            </p>
          </div>
        </div>

        <div
          class="bg-surface/50 mt-4 flex items-center gap-2 rounded-2xl px-4 py-3"
        >
          <span class="text-muted text-sm">下次扣费:</span>
          <span class="text-ink text-sm font-bold">
            {{ toDateInputValue(subscription.next_billing_date) }}
          </span>
          <span class="text-muted text-xs">
            ({{ getDaysUntil(subscription.next_billing_date) }} 天后)
          </span>
          <span
            class="ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
            :class="getStatusMeta(subscription.status).badgeClass"
          >
            <span
              class="mr-1 h-1.5 w-1.5 rounded-full"
              :class="getStatusMeta(subscription.status).dotClass"
            />
            {{ getStatusMeta(subscription.status).label }}
          </span>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div class="bg-surface/70 rounded-xl border px-3 py-2">
            <p class="text-muted">提醒渠道</p>
            <p class="text-ink mt-1 font-medium">
              {{ getReminderChannelsText(subscription.reminder_config) }}
            </p>
          </div>
          <div class="bg-surface/70 rounded-xl border px-3 py-2">
            <p class="text-muted">提醒节点</p>
            <p class="text-ink mt-1 font-medium">
              {{ getReminderPointsText(subscription.reminder_config) }}
            </p>
          </div>
        </div>

        <p
          class="bg-surface/70 text-ink mt-3 line-clamp-2 rounded-xl border px-3 py-2 text-sm"
        >
          {{ subscription.notes?.trim() || '暂无备注' }}
        </p>

        <div class="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            class="bg-secondary text-ink hover:bg-secondary/80 rounded-xl border px-3 py-2 text-xs font-medium transition"
            @click.stop="emit('edit', subscription)"
          >
            编辑
          </button>
          <button
            type="button"
            class="border-accent/30 bg-accent/15 text-ink hover:bg-surface rounded-xl border px-3 py-2 text-xs font-medium transition"
            @click.stop="emit('reminder', subscription)"
          >
            通知
          </button>
          <button
            type="button"
            class="bg-secondary text-ink hover:bg-secondary/80 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-60"
            :disabled="pendingStatusId === subscription.id"
            @click.stop="emit('toggleStatus', subscription)"
          >
            {{ subscription.status === 'active' ? '暂停' : '恢复' }}
          </button>
          <button
            type="button"
            class="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-60"
            :disabled="deletePendingId === subscription.id"
            @click.stop="emit('delete', subscription)"
          >
            删除
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
