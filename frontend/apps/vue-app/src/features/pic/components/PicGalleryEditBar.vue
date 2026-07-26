<template>
  <div class="fixed bottom-16 left-1/2 z-30 w-fit -translate-x-1/2">
    <div class="flex items-center gap-3">
      <Button
        v-if="canEdit"
        variant="outline"
        size="sm"
        @click="$emit('toggle-edit')"
        class="h-9 gap-2 rounded-full px-4"
        :class="isEditMode ? 'bg-accent text-ink' : ''"
      >
        <component :is="isEditMode ? Check : Edit2" class="h-4 w-4" />
        {{ isEditMode ? '完成编辑' : '编辑模式' }}
      </Button>
      <Button
        @click="$emit('shuffle')"
        size="sm"
        class="h-9 gap-2 rounded-full px-4"
      >
        <Shuffle class="h-4 w-4" />
        重排
      </Button>
      <Transition
        enter-active-class="transition-all  duration-300 ease-in-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition-all  duration-300 ease-in-out"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="-translate-x-full opacity-0"
      >
        <Button
          v-if="isEditMode && canEdit"
          key="upload-btn"
          variant="default"
          size="sm"
          @click="$emit('upload')"
          class="bg-accent text-ink hover:bg-accent/90 h-9 gap-2 rounded-full px-4 shadow-md"
        >
          <Upload class="h-4 w-4" />
          上传图片
        </Button>
      </Transition>

      <!-- 删除选中：仅在编辑模式且有选中时出现 -->
      <Transition
        enter-active-class="transition-all duration-300 ease-in-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition-all duration-300 ease-in-out"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <Button
          v-if="isEditMode && canEdit && (selectedCount ?? 0) > 0"
          key="delete-btn"
          variant="destructive"
          size="sm"
          @click="$emit('delete-selected')"
          class="h-9 gap-2 rounded-full px-4 shadow-md"
        >
          <Trash2 class="h-4 w-4" />
          删除选中 {{ selectedCount }}
        </Button>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components';
import { Check, Edit2, Shuffle, Trash2, Upload } from '@lucide/vue';

defineProps<{
  canEdit: boolean;
  isEditMode: boolean;
  selectedCount?: number;
}>();

defineEmits<{
  'toggle-edit': [];
  shuffle: [];
  upload: [];
  'delete-selected': [];
}>();
</script>
