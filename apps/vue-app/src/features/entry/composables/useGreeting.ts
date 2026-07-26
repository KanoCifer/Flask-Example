import { computed } from 'vue';

export function useGreeting() {
  const currentHour = computed(() => new Date().getHours());

  const isDay = computed(
    () => currentHour.value >= 6 && currentHour.value < 18,
  );

  const greeting = computed(() => {
    if (currentHour.value < 12) return 'Good Morning';
    if (currentHour.value < 18) return 'Good Afternoon';
    return 'Good Evening';
  });

  const changelogHint = computed(() => {
    if (currentHour.value < 12) return "Check out what's new today!";
    if (currentHour.value < 18) return "See what's changed this afternoon";
    return 'New updates waiting for you tonight';
  });

  return { isDay, greeting, changelogHint };
}
