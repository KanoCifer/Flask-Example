<script setup lang="ts">
import { useTwikoo } from '@/composables';
import { nextTick, watch } from 'vue';

const props = defineProps<{
  path?: string;
}>();

watch(
  () => props.path,
  async (path) => {
    if (path) {
      await nextTick();
      useTwikoo({
        el: '#tcomment',
        path,
      });
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="">
    <div class="flex gap-2 px-1 py-5">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-message-circle-check-icon lucide-message-circle-check"
      >
        <path
          d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"
        />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <h3 class="text-ink text-lg font-semibold">评论</h3>
    </div>
    <div class="p-8">
      <div id="tcomment" />
    </div>
  </div>
</template>

<style>
@import 'twikoo/dist/twikoo.css';

#tcomment {
  font-size: 0.9375rem;
}

#tcomment .el-input__inner,
#tcomment .el-textarea__inner {
  background: var(--card-bg);
  border-color: var(--secondary);
  border-radius: 0.75rem;
  color: var(--ink);
  font-size: 0.9375rem;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
#tcomment .el-input__inner:focus,
#tcomment .el-textarea__inner:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 15%, transparent);
}
#tcomment .el-textarea__inner {
  line-height: 1.7;
  padding: 0.75rem 1rem;
}

#tcomment .el-button {
  border-radius: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  padding: 0.5rem 1.25rem;
}

#tcomment .el-button--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent);
}
#tcomment .el-button--primary:hover {
  opacity: 0.88;
  background: var(--accent);
  border-color: var(--accent);
}
#tcomment .el-button--primary:active {
  opacity: 0.78;
}

#tcomment .el-button--default,
#tcomment
  .el-button:not(.el-button--primary):not(.el-button--danger):not(
    .el-button--text
  ) {
  background: var(--card-bg);
  border-color: var(--secondary);
  color: var(--ink);
}
#tcomment .el-button--default:hover,
#tcomment
  .el-button:not(.el-button--primary):not(.el-button--danger):not(
    .el-button--text
  ):hover {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in oklch, var(--accent) 8%, var(--card-bg));
}

#tcomment .el-button--text {
  color: var(--muted);
  padding: 0.25rem 0.5rem;
}
#tcomment .el-button--text:hover {
  color: var(--accent);
  background: transparent;
}

#tcomment .tk-comment {
  border-bottom: 1px solid var(--secondary);
  padding: 1.25rem 0;
}
#tcomment .tk-comment:last-child {
  border-bottom: none;
}

#tcomment .tk-avatar {
  border-radius: 9999px;
  overflow: hidden;
}

#tcomment .tk-nick {
  color: var(--ink);
  font-weight: 600;
}

#tcomment .tk-time {
  color: var(--muted);
  font-size: 0.8125rem;
}

#tcomment .tk-content {
  color: var(--ink);
  line-height: 1.75;
}

#tcomment .tk-replies {
  border-left: 2px solid var(--secondary);
  margin-left: 1.5rem;
  padding-left: 1rem;
}

#tcomment .el-pager li {
  border-radius: 0.5rem;
  font-weight: 500;
}
#tcomment .el-pager li.active {
  background: var(--accent);
  color: var(--accent);
}

#tcomment .OwO {
  color: var(--ink);
}
#tcomment .OwO .OwO-logo {
  border-radius: 0.5rem;
}

.dark #tcomment .el-input__inner,
.dark #tcomment .el-textarea__inner {
  background: color-mix(in oklch, var(--card-bg) 60%, var(--page));
}
</style>
