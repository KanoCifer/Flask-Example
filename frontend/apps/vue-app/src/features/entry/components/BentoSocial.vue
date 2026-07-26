<template>
  <BentoCard class="flex items-center justify-center gap-6 p-6">
    <a
      v-for="social in socialLinks"
      :key="social.name"
      :href="social.href"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="social.name"
      class="group bg-page/60 text-muted hover:border-muted hover:bg-surface hover:text-ink dark:bg-page relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/50 shadow-sm transition-[background-color,color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <span
        class="bg-accent text-ink absolute -top-10 scale-0 rounded-lg px-3 py-1 text-sm font-medium opacity-0 transition-[transform,opacity] duration-300 group-hover:scale-100 group-hover:opacity-100"
      >
        {{ social.name }}
      </span>

      <!-- GitHub Icon -->
      <svg
        v-if="social.icon === 'github'"
        xmlns="http://www.w3.org/2000/svg"
        class="h-7 w-7"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
        />
      </svg>

      <!-- Email Icon -->
      <svg
        v-else-if="social.icon === 'email'"
        xmlns="http://www.w3.org/2000/svg"
        class="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    </a>
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';

const socialLinks = [
  {
    name: 'GitHub',
    href: 'https://github.com/KanoCifer/Flask-Example',
    icon: 'github',
  },
  {
    name: 'Email',
    href: 'mailto:kano3255@outlook.com',
    icon: 'email',
  },
];
</script>
