<script setup lang="ts">
import { AuthLayout } from './components';
import { Button, FieldError, IconKey, IconLock } from '@/components';
import type { LoginForm } from '@readinglist/types';
import { Check, Loader2, LogIn, ShieldUser } from '@lucide/vue';
import { AnimatePresence, motion } from 'motion-v';
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthenticate } from '@/features/auth';

const {
  errors,
  isSubmitting,
  isPasskeySubmitting,
  handleSubmit,
  handlePasskeyLogin,
  handleGitHubLogin,
} = useAuthenticate();

const form = ref<LoginForm>({
  username: '',
  password: '',
});

const showPassword = ref<boolean>(false);
const isLoginHovered = ref<boolean>(false);
</script>

<template>
  <AuthLayout brand-width="w-3/5" form-width="lg:w-2/5">
    <template #branding>
      <div class="flex items-center gap-2 text-xl font-bold tracking-tight">
        <img
          src="/images/animal-badge/fox.png"
          alt="Fox"
          class="size-8 rounded-md object-cover"
        />
        <span>Kanocifer<span class="text-accent">.chat</span></span>
      </div>
      <div class="z-10 my-auto">
        <div class="flex flex-col">
          <h1 class="text-5xl font-extrabold tracking-tight xl:text-6xl">
            Welcome back to <br />
            the reading space.
          </h1>
          <p class="mt-6 max-w-md text-lg text-zinc-400">
            Discover, organize, and immerse yourself in all the great books you
            plan to read.
          </p>
        </div>
      </div>
      <div class="z-10 font-serif text-sm text-zinc-500">Kuroome's Blog</div>
    </template>

    <template #header>
      <div class="mb-8 flex flex-col items-center lg:items-start">
        <div
          class="bg-accent text-ink mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-[0_8px_16px_rgba(37,99,235,0.25)] lg:hidden"
        >
          <img
            src="/images/animal-badge/fox.png"
            alt="Fox"
            class="size-full object-cover"
          />
        </div>
        <h2
          class="font-headline text-ink text-center text-3xl text-[28px] font-extrabold tracking-tight lg:text-left"
        >
          Log in to your account
        </h2>
        <p
          class="text-muted mt-2 text-center text-[15px] font-medium lg:text-left"
        >
          Welcome back! Please enter your details.
        </p>
      </div>
    </template>

    <!-- 登录表单 -->
    <form @submit.prevent="handleSubmit(form)" class="w-full">
      <!-- 用户名 -->
      <div>
        <div class="relative my-4">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <ShieldUser class="size-6" />
          </div>
          <input
            v-model="form.username"
            type="text"
            autocomplete="off"
            placeholder="username"
            class="form-control bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.username,
            }"
          />
        </div>
        <FieldError :message="errors.username" />
      </div>

      <!-- 密码 -->
      <div>
        <div class="relative my-4">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <IconLock class="size-6" />
          </div>
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="off"
            placeholder="password"
            class="form-control bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-12 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.password,
            }"
          />

          <!-- 显示/隐藏密码按钮 -->
          <button
            type="button"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            class="text-muted hover:text-ink absolute top-1/2 right-4 z-10 flex -translate-y-1/2 items-center justify-center rounded-md"
          >
            <!-- eye (显示) -->
            <svg
              v-if="showPassword"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>

            <!-- eye-off (隐藏) -->
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
              />
            </svg>
          </button>
        </div>
        <FieldError :message="errors.password" />
      </div>

      <!-- 提交按钮 -->
      <div class="mt-6">
        <button
          type="submit"
          @mouseenter="isLoginHovered = true"
          @mouseleave="isLoginHovered = false"
          class="bg-accent text-contrast shadow-accent/30 hover:bg-accent/90 focus:ring-accent/30 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-8 py-2.5 font-bold shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          :disabled="isSubmitting"
        >
          <!-- SVG 加载动画 -->
          <Loader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
          <!-- hover morph: LogIn ↔ Check -->
          <div v-else class="relative flex h-5 w-5 items-center justify-center">
            <AnimatePresence mode="popLayout" :initial="false">
              <motion.div
                v-if="!isLoginHovered"
                key="login"
                :initial="{ scale: 0.5, opacity: 0 }"
                :animate="{ scale: 1, opacity: 1 }"
                :exit="{ scale: 0.5, opacity: 0 }"
                :transition="{ type: 'spring', stiffness: 600, damping: 25 }"
                class="absolute inset-0 flex items-center justify-center"
              >
                <LogIn class="h-5 w-5" />
              </motion.div>
              <motion.div
                v-else
                key="check"
                :initial="{ scale: 0.5, opacity: 0 }"
                :animate="{ scale: 1, opacity: 1 }"
                :exit="{ scale: 0.5, opacity: 0 }"
                :transition="{ type: 'spring', stiffness: 600, damping: 25 }"
                class="absolute inset-0 flex items-center justify-center"
              >
                <Check class="h-5 w-5" />
              </motion.div>
            </AnimatePresence>
          </div>
          {{ isSubmitting ? null : 'Login' }}
        </button>
      </div>

      <!-- Passkey 登录按钮 -->
      <div class="mt-8">
        <Button
          @click="handlePasskeyLogin"
          :disabled="isPasskeySubmitting"
          class="bg-success group text-contrast shadow-success/30 hover:bg-success/90 focus:ring-success/30 inline-flex w-full cursor-pointer items-center justify-center gap-2 px-8 py-2.5 font-bold! transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconKey
            class="transition-transform duration-200 ease-in-out group-hover:rotate-12"
          />
          <!-- SVG 加载动画 -->
          <Loader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
          <span v-if="isPasskeySubmitting">Logging in with Passkey...</span>
          <span v-else>Login with Passkey</span>
        </Button>
        <FieldError :message="errors.passkey" />
      </div>

      <div class="relative mt-8">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t"></span>
        </div>
        <div class="relative flex justify-center">
          <span class="text-muted bg-page px-2"> Or continue with </span>
        </div>
      </div>

      <!-- GitHub 登录按钮 -->
      <div class="mt-4 flex flex-col items-center">
        <button
          type="button"
          @click="handleGitHubLogin"
          class="text-contrast focus:ring-accent inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-black px-8 py-2.5 font-bold shadow-lg transition-colors hover:bg-black/90 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:text-white"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path
              d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
            />
          </svg>
          Login with GitHub
        </button>
      </div>
    </form>

    <template #footer>
      <!-- 注册链接 -->
      <div class="text-muted mt-8 text-center text-sm">
        Don't have an account?
        <RouterLink
          to="/register"
          class="hover:text-ink font-semibold underline transition duration-100"
        >
          Register here
        </RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>
