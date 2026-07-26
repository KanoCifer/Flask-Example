<script setup lang="ts">
import { useHead } from '@vueuse/head';
import BasicLayout from './layouts/BasicLayout.vue';

useHead({
  title: "Kuroome's Blog",
  meta: [
    { charset: 'UTF-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
    {
      name: 'description',
      content: "Kuroome's Blog",
    },
    {
      name: 'keywords',
      content: '阅读追踪,个人图书馆,阅读管理',
    },
    { name: 'robots', content: 'index, follow' },
    { name: 'author', content: 'Kuroome' },
  ],
});
</script>

<template>
  <BasicLayout />
</template>
