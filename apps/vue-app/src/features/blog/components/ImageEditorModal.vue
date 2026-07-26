<script setup lang="ts">
import { ref } from 'vue';
import { ModalFadeTransition } from '@/components';

defineProps<{
  isOpen: boolean;
  imageUrl: string;
  alt: string;
  title: string;
  width: string;
  height: string;
  align: 'left' | 'center' | 'right';
}>();

const emit = defineEmits<{
  close: [];
  'update:alt': [value: string];
  'update:title': [value: string];
  'update:width': [value: string];
  'update:height': [value: string];
  'update:align': [value: 'left' | 'center' | 'right'];
  'replace-image': [event: Event];
  'open-new-tab': [url: string];
}>();

const replaceInputRef = ref<HTMLInputElement | null>(null);
</script>

<template>
  <teleport to="body">
    <ModalFadeTransition>
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div class="bg-page w-full max-w-md rounded-3xl shadow-2xl">
          <div class="flex items-center justify-between border-b px-6 py-4">
            <h3 class="text-ink text-base font-semibold">编辑图片</h3>
            <button
              type="button"
              class="text-muted hover:bg-surface bg-surface rounded-full px-3 py-1 text-xs font-semibold transition"
              @click="emit('close')"
            >
              关闭
            </button>
          </div>

          <div class="p-6">
            <div
              class="bg-surface mb-4 flex items-center justify-center rounded-2xl p-4"
            >
              <img
                :src="imageUrl"
                :alt="alt"
                class="max-h-50 w-full rounded-xl object-contain"
                @click.stop="emit('open-new-tab', imageUrl)"
              />
            </div>

            <div class="space-y-3">
              <input
                :value="alt"
                type="text"
                placeholder="图片说明 (Alt)"
                class="text-ink placeholder:text-muted focus:border-ring bg-page w-full rounded-xl border px-3 py-2 text-sm outline-none"
                @input="
                  emit('update:alt', ($event.target as HTMLInputElement).value)
                "
              />

              <div class="grid grid-cols-2 gap-3">
                <input
                  :value="width"
                  type="number"
                  min="0"
                  placeholder="宽度"
                  class="text-ink placeholder:text-muted focus:border-ring bg-page w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  @input="
                    emit(
                      'update:width',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <input
                  :value="height"
                  type="number"
                  min="0"
                  placeholder="高度"
                  class="text-ink placeholder:text-muted focus:border-ring bg-page w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  @input="
                    emit(
                      'update:height',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between border-t px-6 py-4">
            <div>
              <input
                ref="replaceInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="(e) => emit('replace-image', e)"
              />
              <button
                type="button"
                class="text-muted hover:bg-surface rounded-xl border px-3 py-2 text-xs font-semibold transition"
                @click="replaceInputRef?.click()"
              >
                替换图片
              </button>
            </div>
            <button
              type="button"
              class="bg-accent text-ink hover:bg-accent/90 rounded-xl px-4 py-2 text-xs font-semibold transition"
              @click="emit('close')"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </ModalFadeTransition>
  </teleport>
</template>
