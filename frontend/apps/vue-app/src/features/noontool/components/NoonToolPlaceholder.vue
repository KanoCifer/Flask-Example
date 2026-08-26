<script setup lang="ts">
/**
 * Story-style usage:
 *   <NoonToolPlaceholder aspect="16/10" />
 *   <NoonToolPlaceholder aspect="3/2" label="Feature card screenshot" />
 *   <NoonToolPlaceholder aspect="2/1" caption="Replace with /noontool-screens/01.png" />
 */
type Aspect = '16/10' | '3/2' | '2/1'

const props = withDefaults(
  defineProps<{
    aspect?: Aspect
    label?: string
    caption?: string
  }>(),
  {
    aspect: '16/10',
    label: '📷 Place screenshot here',
    caption: '',
  },
)

const aspectClass = {
  '16/10': 'aspect-[16/10]',
  '3/2': 'aspect-[3/2]',
  '2/1': 'aspect-[2/1]',
}[props.aspect]
</script>

<template>
  <figure
    class="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card/40 text-muted shadow-md transition-shadow motion-safe:hover:shadow-lg"
    :class="aspectClass"
    role="img"
    :aria-label="label"
  >
    <div class="flex flex-col items-center gap-1 px-4 text-center">
      <span class="text-sm font-medium text-ink/80">{{ label }}</span>
      <span v-if="caption" class="text-xs text-muted">{{ caption }}</span>
    </div>
    <span
      class="pointer-events-none absolute right-3 top-3 rounded-full bg-card/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted"
    >
      {{ aspect }}
    </span>
  </figure>
</template>