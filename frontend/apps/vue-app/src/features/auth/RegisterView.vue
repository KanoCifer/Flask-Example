<script setup lang="ts">
import { authGateway } from '@/features/auth';
import { AuthLayout } from './components';
import { Button, FieldError, IconLock } from '@/components';
import { useNotificationStore } from '@/stores';
import type { RegisterForm } from '@readinglist/types';
import axios from 'axios';
import { Mail, Loader2, ShieldUser } from '@lucide/vue';
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

const router = useRouter();

const notifier = useNotificationStore();
const form = ref<RegisterForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  emailCode: '',
});

const errors = ref<{
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  emailCode?: string;
  submit?: string;
}>({});

const isSubmitting = ref<boolean>(false);
const isSendingCode = ref<boolean>(false);
const sendCodeText = ref<string>('SendCode');
const isSent = ref<boolean>(false);

const sendEmailCode = async () => {
  if (!form.value.email) {
    errors.value.email = 'Please enter your email first';
    return;
  }

  isSendingCode.value = true;
  sendCodeText.value = 'Sending...';

  try {
    await authGateway.sendRegisterEmailCode({
      email: form.value.email,
    });
    sendCodeText.value = 'Sent!';
    notifier.success('验证码已发送到您的邮箱，请注意查收');
    // 倒计时 60 秒
    isSent.value = true;
    let countdown = 60;
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        sendCodeText.value = 'SendCode';
        isSent.value = false;
      } else {
        sendCodeText.value = `${countdown}s`;
      }
    }, 1000);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.message) {
      errors.value.email = err.response.data.message;
    }
  } finally {
    isSendingCode.value = false;
  }
};

const handleSubmit = async () => {
  errors.value = {};

  if (form.value.password !== form.value.confirmPassword) {
    errors.value.confirmPassword = 'Passwords do not match';
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await authGateway.register({
      username: form.value.username,
      email: form.value.email,
      password: form.value.password,
      confirm_password: form.value.confirmPassword,
      email_code: form.value.emailCode || '',
    });

    if (response.data) {
      router.push('/login');
      notifier.success('注册成功！请使用您的账号登录');
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data;
      if (data.username) {
        errors.value.username = data.username[0];
      }
      if (data.email) {
        errors.value.email = data.email[0];
      }
      if (data.password) {
        errors.value.password = data.password[0];
      }
      if (data.confirm_password) {
        errors.value.confirmPassword = data.confirm_password[0];
      }
      if (data.email_code) {
        errors.value.emailCode = data.email_code[0];
      }
      if (data.error) {
        errors.value.submit = data.error;
      }
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <AuthLayout brand-width="w-1/2" form-width="lg:w-1/2">
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
            Start your <br />
            reading journey.
          </h1>
          <p class="mt-6 max-w-md text-lg text-zinc-400">
            Create an account to track, organize, and discover the books you
            love.
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
          Create your account
        </h2>
        <p
          class="text-muted mt-2 text-center text-[15px] font-medium lg:text-left"
        >
          Fill in the details below to get started.
        </p>
      </div>
    </template>

    <!-- 注册表单 -->
    <form @submit.prevent="handleSubmit" class="w-full">
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
            required
          />
        </div>
        <FieldError :message="errors.username" />
      </div>

      <!-- 邮箱 -->
      <div>
        <div class="relative my-4">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <Mail class="size-6" />
          </div>
          <input
            v-model="form.email"
            type="email"
            autocomplete="off"
            placeholder="email"
            class="form-control bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.email,
            }"
            required
          />
        </div>
        <FieldError :message="errors.email" />
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
            type="password"
            autocomplete="off"
            placeholder="password"
            class="form-control bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.password,
            }"
            required
          />
        </div>
        <FieldError :message="errors.password" />
      </div>

      <!-- 确认密码 -->
      <div>
        <div class="relative my-4">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <IconLock class="size-6" />
          </div>
          <input
            v-model="form.confirmPassword"
            type="password"
            autocomplete="off"
            placeholder="confirm password"
            class="form-control bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.confirmPassword,
            }"
            required
          />
        </div>
        <FieldError :message="errors.confirmPassword" />
      </div>

      <!-- 邮箱验证码 -->
      <div>
        <div class="relative my-4">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <Mail class="size-6" />
          </div>
          <input
            v-model="form.emailCode"
            type="text"
            autocomplete="off"
            placeholder="email code"
            class="form-control bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-24 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.emailCode,
            }"
            required
          />
          <Button
            class="absolute top-1/2 right-2 z-10 -translate-y-1/2"
            size="md"
            :disabled="isSendingCode || isSent"
            @click="sendEmailCode"
          >
            {{ sendCodeText }}
          </Button>
        </div>
        <FieldError :message="errors.emailCode" />
      </div>

      <!-- 提交按钮 -->
      <div class="mt-6">
        <Button
          size="lg"
          class="w-full font-serif"
          type="submit"
          :disabled="isSubmitting"
        >
          <Loader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
          {{ isSubmitting ? 'Registering...' : 'Register' }}
        </Button>
      </div>

      <span
        v-if="errors.submit"
        class="text-destructive mt-3 flex items-center justify-center gap-1.5 text-center text-sm"
      >
        <svg
          class="size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {{ errors.submit }}
      </span>
    </form>

    <template #footer>
      <!-- 登录链接 -->
      <div class="text-muted mt-8 text-center text-sm">
        已有账号？
        <RouterLink to="/login" class="text-ink font-medium hover:underline">
          立即登录
        </RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>
