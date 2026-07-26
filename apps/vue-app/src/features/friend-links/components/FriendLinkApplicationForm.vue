<script setup lang="ts">
import { ref } from 'vue';

interface FormErrors {
  name?: string[];
  email?: string[];
  siteName?: string[];
  siteUrl?: string[];
  description?: string[];
}

const name = ref('');
const email = ref('');
const siteName = ref('');
const siteUrl = ref('');
const description = ref('');
const submitting = ref(false);
const successMessage = ref('');
const errors = ref<FormErrors>({});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

const validate = (): boolean => {
  const newErrors: FormErrors = {};

  if (!name.value.trim()) {
    newErrors.name = ['请输入您的昵称'];
  }

  if (!email.value.trim()) {
    newErrors.email = ['请输入联系邮箱'];
  } else if (!emailRegex.test(email.value)) {
    newErrors.email = ['邮箱格式不正确'];
  }

  if (!siteName.value.trim()) {
    newErrors.siteName = ['请输入网站名称'];
  }

  if (!siteUrl.value.trim()) {
    newErrors.siteUrl = ['请输入网站地址'];
  } else if (!urlRegex.test(siteUrl.value)) {
    newErrors.siteUrl = ['URL 格式不正确，需包含域名'];
  }

  if (!description.value.trim()) {
    newErrors.description = ['请输入网站描述'];
  } else if (description.value.trim().length > 200) {
    newErrors.description = ['描述不能超过 200 字'];
  }

  errors.value = newErrors;
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = () => {
  successMessage.value = '';

  if (!validate()) {
    return;
  }

  submitting.value = true;

  const subject = encodeURIComponent(`友链申请：${siteName.value}`);
  const body = encodeURIComponent(
    `昵称：${name.value}\n` +
      `邮箱：${email.value}\n` +
      `网站名称：${siteName.value}\n` +
      `网站地址：${siteUrl.value}\n` +
      `网站描述：${description.value}`,
  );

  window.location.href = `mailto:kano3255@outlook.com?subject=${subject}&body=${body}`;

  successMessage.value = '已打开邮件客户端，请发送邮件完成申请。';
  submitting.value = false;
};
</script>

<template>
  <div
    class="bg-page/80 ring-border mx-auto mt-12 mb-4 rounded-3xl p-4 py-8 shadow-lg ring-1 hover:shadow-xl motion-safe:transition-shadow motion-safe:duration-300"
  >
    <div class="mx-4 my-2">
      <!-- 申请须知 -->
      <div class="border-accent/15 bg-accent/5 mb-6 rounded-2xl border p-5">
        <h3 class="text-ink mb-3 flex items-center gap-2 text-sm font-bold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="text-ink h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          友链申请须知
        </h3>
        <ul class="text-muted space-y-2 text-sm">
          <li class="flex items-start gap-2">
            <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
            <span>网站需符合中国大陆相关法律法规</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
            <span>网站内容原创、非商业推广</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
            <span
              >已在您的网站添加本站友链（<a
                href="https://kanocifer.chat"
                target="_blank"
                class="text-ink underline"
                >kanocifer.chat</a
              >）</span
            >
          </li>
          <li class="flex items-start gap-2">
            <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
            <span>网站可正常访问</span>
          </li>
        </ul>

        <h3
          class="text-ink mt-4 mb-3 flex items-center gap-2 text-sm font-bold"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="text-ink h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          申请时请提供
        </h3>
        <ul class="text-muted space-y-2 text-sm">
          <li class="flex items-start gap-2">
            <span class="text-ink mt-0.5 shrink-0 text-xs">●</span>
            <span>网站名称、描述、地址、Favicon 地址</span>
          </li>
        </ul>
      </div>

      <h2
        class="text-ink flex items-center gap-3 font-serif text-2xl font-bold"
      >
        申请友链
        <span class="text-muted items-baseline text-sm italic">
          交换链接，互相访问
        </span>
      </h2>
      <p class="my-4">
        <span
          class="border-accent/30 bg-accent/20 text-ink rounded-full border px-4 py-2 text-xs font-medium"
        >
          填写以下信息，通过邮件提交友链申请
        </span>
      </p>

      <form @submit.prevent="handleSubmit" class="mt-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="form-group">
            <label
              for="fl-name"
              class="text-ink mb-2 block text-sm font-semibold"
            >
              您的昵称 <span class="text-destructive">*</span>
            </label>
            <input
              id="fl-name"
              v-model="name"
              type="text"
              class="bg-surface focus:border-ring focus:ring-ring text-ink placeholder:text-muted w-full rounded-3xl border px-3 py-2 focus:ring-2 focus:outline-none motion-safe:transition-all motion-safe:duration-300"
              :disabled="submitting"
              placeholder="怎么称呼您"
            />
            <div
              v-if="errors.name"
              aria-live="assertive"
              class="text-destructive mt-1 flex items-center text-sm"
            >
              {{ errors.name[0] }}
            </div>
          </div>

          <div class="form-group">
            <label
              for="fl-email"
              class="text-ink mb-2 block text-sm font-semibold"
            >
              联系邮箱 <span class="text-destructive">*</span>
            </label>
            <input
              id="fl-email"
              v-model="email"
              type="email"
              class="bg-surface focus:border-ring focus:ring-ring text-ink placeholder:text-muted w-full rounded-3xl border px-3 py-2 focus:ring-2 focus:outline-none motion-safe:transition-all motion-safe:duration-300"
              :disabled="submitting"
              placeholder="your@email.com"
            />
            <div
              v-if="errors.email"
              aria-live="assertive"
              class="text-destructive mt-1 flex items-center text-sm"
            >
              {{ errors.email[0] }}
            </div>
          </div>

          <div class="form-group">
            <label
              for="fl-site-name"
              class="text-ink mb-2 block text-sm font-semibold"
            >
              网站名称 <span class="text-destructive">*</span>
            </label>
            <input
              id="fl-site-name"
              v-model="siteName"
              type="text"
              class="bg-surface focus:border-ring focus:ring-ring text-ink placeholder:text-muted w-full rounded-3xl border px-3 py-2 focus:ring-2 focus:outline-none motion-safe:transition-all motion-safe:duration-300"
              :disabled="submitting"
              placeholder="您的网站名称"
            />
            <div
              v-if="errors.siteName"
              aria-live="assertive"
              class="text-destructive mt-1 flex items-center text-sm"
            >
              {{ errors.siteName[0] }}
            </div>
          </div>

          <div class="form-group">
            <label
              for="fl-site-url"
              class="text-ink mb-2 block text-sm font-semibold"
            >
              网站地址 <span class="text-destructive">*</span>
            </label>
            <input
              id="fl-site-url"
              v-model="siteUrl"
              type="text"
              class="bg-surface focus:border-ring focus:ring-ring text-ink placeholder:text-muted w-full rounded-3xl border px-3 py-2 focus:ring-2 focus:outline-none motion-safe:transition-all motion-safe:duration-300"
              :disabled="submitting"
              placeholder="https://example.com"
            />
            <div
              v-if="errors.siteUrl"
              aria-live="assertive"
              class="text-destructive mt-1 flex items-center text-sm"
            >
              {{ errors.siteUrl[0] }}
            </div>
          </div>

          <div class="form-group md:col-span-2">
            <label
              for="fl-description"
              class="text-ink mb-2 block text-sm font-semibold"
            >
              网站描述 <span class="text-destructive">*</span>
            </label>
            <textarea
              id="fl-description"
              v-model="description"
              rows="3"
              maxlength="200"
              class="bg-surface focus:border-ring focus:ring-ring text-ink placeholder:text-muted w-full rounded-3xl border px-3 py-2 focus:ring-2 focus:outline-none motion-safe:transition-all motion-safe:duration-300"
              :disabled="submitting"
              placeholder="用简短的一段话介绍您的网站（不超过 200 字）"
            ></textarea>
            <div class="mt-1 flex items-center justify-between">
              <div
                v-if="errors.description"
                aria-live="assertive"
                class="text-destructive flex items-center text-sm"
              >
                {{ errors.description[0] }}
              </div>
              <div v-else class="text-muted text-xs">
                {{ description.length }}/200
              </div>
            </div>
          </div>

          <div class="md:col-span-2">
            <button
              type="submit"
              class="bg-accent text-ink shadow-accent/30 hover:bg-accent/90 focus:ring-ring dark:ring-offset-page flex cursor-pointer items-center gap-2 rounded-xl px-8 py-2.5 font-bold shadow-lg ring-offset-2 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="submitting"
            >
              {{ submitting ? '正在打开邮件客户端...' : '提交申请' }}
            </button>
          </div>
        </div>

        <div
          v-if="successMessage"
          aria-live="polite"
          class="bg-success/10 text-success mt-4 rounded-lg p-4"
        >
          {{ successMessage }}
        </div>
      </form>
    </div>
  </div>
</template>
