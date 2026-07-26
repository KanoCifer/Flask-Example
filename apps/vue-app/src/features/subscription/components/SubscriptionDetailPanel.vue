<script setup lang="ts">
import type { Subscription } from '@/features/rss';

interface Props {
  selectedSubscription: Subscription | null;
  pendingStatusId: number | null;
  deletePendingId: number | null;
  toDateInputValue: (value: string) => string;
  getCycleLabel: (cycle: string) => string;
  formatPrice: (price: number, currency: string) => string;
  formatDate: (value: string) => string;
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
  edit: [subscription: Subscription];
  reminder: [subscription: Subscription];
  toggleStatus: [subscription: Subscription];
  delete: [subscription: Subscription];
}>();
</script>

<template>
  <aside class="xl:sticky xl:top-24 xl:h-fit">
    <section class="/80 bg-card rounded-3xl border p-5 shadow-sm">
      <h3 class="text-ink text-sm font-semibold tracking-wide uppercase">
        详情面板
      </h3>

      <div v-if="selectedSubscription" class="mt-4 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-ink text-xl font-semibold">
              {{ selectedSubscription.name }}
            </h4>
            <p class="text-muted mt-1 text-sm">
              {{ selectedSubscription.provider }}
            </p>
          </div>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
            :class="getStatusMeta(selectedSubscription.status).badgeClass"
          >
            <span
              class="mr-1 h-1.5 w-1.5 rounded-full"
              :class="getStatusMeta(selectedSubscription.status).dotClass"
            />
            {{ getStatusMeta(selectedSubscription.status).label }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-surface/80 rounded-xl px-3 py-2">
            <p class="text-muted text-xs">价格</p>
            <p class="text-ink mt-1 font-medium">
              {{
                formatPrice(
                  selectedSubscription.price,
                  selectedSubscription.currency,
                )
              }}
            </p>
          </div>
          <div class="bg-surface/80 rounded-xl px-3 py-2">
            <p class="text-muted text-xs">周期</p>
            <p class="text-ink mt-1 font-medium">
              {{ getCycleLabel(selectedSubscription.billing_cycle) }}
            </p>
          </div>
          <div class="bg-surface/80 rounded-xl px-3 py-2">
            <p class="text-muted text-xs">下次扣费</p>
            <p class="text-ink mt-1 font-medium">
              {{ toDateInputValue(selectedSubscription.next_billing_date) }}
            </p>
          </div>
          <div class="bg-surface/80 rounded-xl px-3 py-2">
            <p class="text-muted text-xs">更新时间</p>
            <p class="text-ink mt-1 font-medium">
              {{ formatDate(selectedSubscription.updated_at) }}
            </p>
          </div>
        </div>

        <div class="rounded-xl border px-3 py-2">
          <p class="text-muted text-xs">提醒配置</p>
          <p class="text-ink mt-1 text-sm">
            渠道：{{
              getReminderChannelsText(selectedSubscription.reminder_config)
            }}
          </p>
          <p class="text-ink mt-1 text-sm">
            节点：{{
              getReminderPointsText(selectedSubscription.reminder_config)
            }}
          </p>
        </div>

        <div class="bg-surface/70 text-ink rounded-xl border px-3 py-2 text-sm">
          {{ selectedSubscription.notes?.trim() || '暂无备注' }}
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="bg-secondary text-ink hover:bg-secondary/80 rounded-xl border px-3 py-2 text-sm font-medium transition"
            @click="emit('edit', selectedSubscription)"
          >
            编辑订阅
          </button>
          <button
            type="button"
            class="border-accent/30 bg-accent/15 text-ink hover:bg-surface rounded-xl border px-3 py-2 text-sm font-medium transition"
            @click="emit('reminder', selectedSubscription)"
          >
            通知配置
          </button>
          <button
            type="button"
            class="bg-secondary text-ink hover:bg-secondary/80 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-60"
            :disabled="pendingStatusId === selectedSubscription.id"
            @click="emit('toggleStatus', selectedSubscription)"
          >
            {{
              selectedSubscription.status === 'active' ? '暂停订阅' : '恢复订阅'
            }}
          </button>
          <button
            type="button"
            class="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-60"
            :disabled="deletePendingId === selectedSubscription.id"
            @click="emit('delete', selectedSubscription)"
          >
            删除订阅
          </button>
        </div>
      </div>

      <div
        v-else
        class="text-muted mt-4 rounded-xl border border-dashed px-4 py-10 text-center text-sm"
      >
        从左侧列表中选择一条订阅以查看详情。
      </div>
    </section>
  </aside>
</template>
