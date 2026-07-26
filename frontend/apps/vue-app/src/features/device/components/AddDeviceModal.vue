<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <ModalFadeTransition>
      <div
        v-if="modelValue"
        class="bg-page/50 fixed inset-0 z-50 backdrop-blur-sm"
        @click="handleClose"
      />
    </ModalFadeTransition>

    <!-- Form Container -->
    <ModalScaleTransition>
      <div
        v-if="modelValue"
        class="fixed inset-x-8 inset-y-24 z-50 flex items-center justify-center"
      >
        <div
          class="bg-page max-h-full w-full max-w-md overflow-y-auto rounded-2xl shadow-2xl"
        >
          <!-- Header -->
          <div class="bg-page sticky top-0 z-10 border-b px-6 pt-6 pb-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-ink font-serif text-2xl font-bold">添加设备</h2>
                <p class="text-muted mt-1 text-xs">记录你的电子设备资产</p>
              </div>
              <span
                class="bg-accent/15 text-ink shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              >
                新建设备
              </span>
            </div>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="bg-page space-y-5 p-6">
            <!-- Name -->
            <label class="block space-y-1.5">
              <span class="text-muted ml-1 text-xs font-semibold">
                设备名称 *
              </span>
              <input
                v-model="form.name"
                type="text"
                placeholder="例如：iPhone 15 Pro Max"
                maxlength="100"
                class="bg-page text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 w-full rounded-xl border px-4 py-3 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
              />
            </label>

            <!-- Purchase Date -->
            <label class="block space-y-1.5">
              <span class="text-muted ml-1 text-xs font-semibold">
                购买日期 *
              </span>
              <input
                v-model="form.purchase_date"
                type="date"
                class="bg-page text-ink focus:border-accent focus:ring-accent/30 w-full rounded-xl border px-4 py-3 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
              />
            </label>

            <!-- Currency & Price -->
            <div class="grid grid-cols-[0.4fr_0.6fr] gap-4">
              <label class="block space-y-1.5">
                <span class="text-muted ml-1 text-xs font-semibold">
                  货币
                </span>
                <select
                  v-model="form.currency"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/30 w-full cursor-pointer appearance-none rounded-xl border px-4 py-3 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
                >
                  <option v-for="c in currencyOptions" :key="c" :value="c">
                    {{ c }}
                  </option>
                </select>
              </label>

              <label class="block space-y-1.5">
                <span class="text-muted ml-1 text-xs font-semibold">
                  价格
                </span>
                <input
                  v-model.number="form.price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="bg-page text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 w-full rounded-xl border px-4 py-3 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
                />
              </label>
            </div>

            <!-- Notes -->
            <label class="block space-y-1.5">
              <span class="text-muted ml-1 text-xs font-semibold">
                备注（可选）
              </span>
              <input
                v-model="form.notes"
                type="text"
                placeholder="例如：256GB 银色、国行版本"
                class="bg-page text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 w-full rounded-xl border px-4 py-3 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
              />
            </label>

            <!-- Status Toggle -->
            <div class="space-y-2">
              <span class="text-muted ml-1 text-xs font-semibold">
                设备状态
              </span>
              <div class="bg-surface flex rounded-full p-1 backdrop-blur-sm">
                <button
                  v-for="option in statusOptions"
                  :key="option.value"
                  type="button"
                  @click="form.status = option.value"
                  :class="[
                    'flex-1 rounded-full px-3 py-2.5 text-xs font-semibold transition-all duration-200',
                    form.status === option.value
                      ? 'bg-accent text-ink shadow-accent/25 shadow-lg'
                      : 'text-muted hover:bg-surface',
                  ]"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- Error -->
            <p
              v-if="formError"
              class="text-destructive py-2 text-center text-xs font-medium"
            >
              {{ formError }}
            </p>
            <p v-else class="text-muted text-center text-[10px]">* 为必填项</p>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="isSubmitting"
              class="bg-accent text-ink shadow-accent/30 hover:shadow-accent/40 flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-extrabold shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              <span v-if="isSubmitting">添加中...</span>
              <span v-else>添加设备</span>
            </button>
          </form>
        </div>
      </div>
    </ModalScaleTransition>
  </Teleport>
</template>

<script setup lang="ts">
import { deviceGateway } from '@/features/device/api/deviceGateway';
import { useNotificationStore } from '@/stores';
import type { DeviceInput } from '@/features/device/types';
import { reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { ModalFadeTransition } from '@/components';
import { ModalScaleTransition } from '@/components';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success', device: DeviceInput): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const currencyOptions = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP'];
const statusOptions: Array<{ value: 'active' | 'retired'; label: string }> = [
  { value: 'active', label: '使用中' },
  { value: 'retired', label: '已退役' },
];

const form = reactive({
  name: '',
  purchase_date: '',
  price: 0,
  currency: 'CNY',
  notes: '',
  status: 'active' as 'active' | 'retired',
});

const formError = ref<string | null>(null);
const isSubmitting = ref(false);

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      resetForm();
    }
  },
);

function resetForm() {
  const today = dayjs();
  form.name = '';
  form.purchase_date = today.format('YYYY-MM-DD');
  form.price = 0;
  form.currency = 'CNY';
  form.notes = '';
  form.status = 'active';
  formError.value = null;
  isSubmitting.value = false;
}

function handleClose() {
  emit('update:modelValue', false);
}

async function handleSubmit() {
  formError.value = null;

  const name = form.name.trim();
  if (!name) {
    formError.value = '请填写设备名称';
    return;
  }

  if (name.length > 100) {
    formError.value = '设备名称不能超过 100 个字符';
    return;
  }

  if (!form.purchase_date) {
    formError.value = '请选择购买日期';
    return;
  }

  if (!Number.isFinite(form.price) || form.price < 0) {
    formError.value = '请输入有效的价格';
    return;
  }

  isSubmitting.value = true;

  const payload: DeviceInput = {
    name,
    purchase_date: form.purchase_date,
    price: form.price,
    currency: form.currency,
    notes: form.notes.trim() || undefined,
    status: form.status,
    reminder_config: {},
  };

  try {
    await deviceGateway.createDevice(payload);
    useNotificationStore().success('设备添加成功');
    emit('success', payload);
    handleClose();
  } catch (err) {
    const message = err instanceof Error ? err.message : '添加失败，请稍后重试';
    formError.value = message;
    useNotificationStore().error(message);
  } finally {
    isSubmitting.value = false;
  }
}
</script>
