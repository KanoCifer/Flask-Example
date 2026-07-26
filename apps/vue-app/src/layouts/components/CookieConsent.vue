<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components';
import { useStorage } from '@vueuse/core';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const consentGiven = useStorage<boolean>('cookie_consent_given', false);

const showBanner = ref(false);
const showSettings = ref(false);
const showPrivacyPreview = ref(false);

const router = useRouter();

onMounted(() => {
  if (!consentGiven.value) {
    setTimeout(() => {
      showBanner.value = true;
    }, 800);
  }
});

interface CookieCategory {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

const cookieCategories = ref<CookieCategory[]>([
  {
    id: 'essential',
    label: '必要',
    description: '网站运行必需，包括登录状态、安全验证等基础功能',
    required: true,
  },
  {
    id: 'preferences',
    label: '偏好设置',
    description: '记住您的界面偏好，如背景图选择、主题模式等',
    required: false,
  },
]);

const settings = ref<Record<string, boolean>>({});

const initSettings = () => {
  settings.value = {};
  cookieCategories.value.forEach((c) => {
    settings.value[c.id] = c.required;
  });
};

const acceptAll = () => {
  cookieCategories.value.forEach((c) => {
    settings.value[c.id] = true;
  });
  consentGiven.value = true;
  showBanner.value = false;
  showPrivacyPreview.value = false;
};

const rejectAll = () => {
  initSettings();
  consentGiven.value = true;
  showBanner.value = false;
  showPrivacyPreview.value = false;
};

const openSettings = () => {
  initSettings();
  showSettings.value = true;
};

const saveSettings = () => {
  consentGiven.value = true;
  showSettings.value = false;
  showBanner.value = false;
};

const openPrivacy = () => {
  showPrivacyPreview.value = true;
};

const navigateToFullPolicy = () => {
  showPrivacyPreview.value = false;
  showBanner.value = false;
  router.push('/privacy');
};

const hasReadPrivacy = ref(false);
const handlePrivacyScroll = (e: Event) => {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
    hasReadPrivacy.value = true;
  }
};
</script>

<template>
  <Teleport to="body">
    <!-- 右下角卡片 -->
    <Transition
      enter-active-class="transition-[transform,opacity] transform-gpu duration-500 ease-out"
      enter-from-class="translate-y-6 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition-all transform-gpu duration-300 ease-out"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-y-6 scale-95 opacity-0"
    >
      <div
        v-if="showBanner && !consentGiven"
        class="group bg-page/95 fixed right-4 bottom-6 z-50 w-[340px] overflow-hidden rounded-2xl border shadow-lg backdrop-blur-sm transition-[box-shadow] duration-300 hover:shadow-xl sm:right-8 sm:bottom-8 sm:w-[380px]"
      >
        <div class="relative px-5 py-5">
          <!-- 标题行 -->
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span
                class="bg-warning/15 flex h-7 w-7 items-center justify-center rounded-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-warning"
                >
                  <path d="M12 2a10 10 0 1 0 10 10h-10Z" />
                  <path d="M12 12 2.93 17.33" />
                  <path d="M17.33 2.93A10 10 0 0 1 22 12H12Z" />
                </svg>
              </span>
              <span class="text-ink text-[14px] font-semibold tracking-wide"
                >Cookie 与隐私设置</span
              >
            </div>
            <button
              @click="openPrivacy"
              class="text-warning/80 hover:text-warning flex items-center gap-1 text-[12px] transition-colors"
            >
              隐私协议预览
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <!-- 说明文字 -->
          <p class="text-muted mb-4 text-[13px] leading-relaxed">
            本站使用 Cookie 提升浏览体验。继续使用即表示您同意我们的 Cookie
            政策与隐私协议。
          </p>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2">
            <button
              class="text-muted hover:bg-surface hover:text-ink flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.97]"
              @click="openSettings"
            >
              自定义
            </button>
            <button
              class="text-muted hover:bg-surface hover:text-ink flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium transition-[background-color,color,transform] duration-200 active:scale-[0.97]"
              @click="rejectAll"
            >
              拒绝
            </button>
            <button
              class="bg-accent text-ink hover:bg-accent/90 flex-1 rounded-xl px-3 py-2 text-[12px] font-medium shadow-sm transition-[background-color,color,transform] duration-200 active:scale-[0.97]"
              @click="acceptAll"
            >
              全部接受
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 隐私协议预览弹窗 -->
    <AlertDialog
      :open="showPrivacyPreview"
      @update:open="showPrivacyPreview = $event"
    >
      <AlertDialogContent class="animate-message-pop sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle class="text-[16px] font-medium"
            >隐私协议核心摘要</AlertDialogTitle
          >
          <AlertDialogDescription class="sr-only"
            >隐私协议预览</AlertDialogDescription
          >
        </AlertDialogHeader>

        <div
          class="custom-scrollbar relative flex max-h-[40vh] flex-col gap-3 overflow-y-auto py-2 pr-2"
          @scroll="handlePrivacyScroll"
        >
          <div class="space-y-4 text-[13px] leading-relaxed">
            <div>
              <h4 class="text-ink mb-1 flex items-center gap-1.5 font-medium">
                <span class="bg-warning h-1.5 w-1.5 rounded-full"></span>
                信息收集
              </h4>
              <p class="text-muted">
                我们收集必要的网络身份标识(IP/UA)及浏览过程数据以保障服务运行。
              </p>
            </div>
            <div>
              <h4 class="text-ink mb-1 flex items-center gap-1.5 font-medium">
                <span class="bg-warning h-1.5 w-1.5 rounded-full"></span>
                本地存储
              </h4>
              <p class="text-muted">
                使用 Cookie 和 LocalStorage 保存您的登录状态及界面偏好设置。
              </p>
            </div>
            <div>
              <h4 class="text-ink mb-1 flex items-center gap-1.5 font-medium">
                <span class="bg-warning h-1.5 w-1.5 rounded-full"></span>
                第三方服务
              </h4>
              <p class="text-muted">
                接入 Gravatar (头像) 及 GitHub OAuth
                (快捷登录)，仅在您使用时生效。
              </p>
            </div>
            <div class="border-t pt-2">
              <button
                @click="navigateToFullPolicy"
                class="text-warning/80 hover:text-warning inline-flex items-center gap-1 text-[12px] transition-colors"
              >
                阅读完整《隐私政策》
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                  />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" x2="21" y1="14" y2="3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <AlertDialogFooter class="mt-4">
          <AlertDialogCancel
            class="text-muted hover:bg-surface hover:text-ink h-9 rounded-xl border px-4 text-[12px] font-medium"
          >
            返回
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-accent text-ink hover:bg-accent/90 h-9 rounded-xl px-4 text-[12px] font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            @click="acceptAll"
            :disabled="!hasReadPrivacy"
          >
            我已阅读并同意
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 设置弹窗 -->
    <AlertDialog :open="showSettings" @update:open="showSettings = $event">
      <AlertDialogContent class="sm:max-w-[400px]">
        <AlertDialogHeader>
          <AlertDialogTitle class="text-[15px] font-medium">
            Cookie 偏好设置
          </AlertDialogTitle>
          <AlertDialogDescription class="mt-1 text-[12.5px] leading-relaxed">
            选择允许的 Cookie 类别。您可随时通过清除浏览器数据撤回同意。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div class="flex flex-col gap-2.5 py-1">
          <div
            v-for="cat in cookieCategories"
            :key="cat.id"
            class="flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors"
            :class="{ 'opacity-70': cat.required }"
          >
            <div class="flex h-5 items-center pt-0.5">
              <input
                :id="`cookie-${cat.id}`"
                type="checkbox"
                :checked="cat.required || (settings[cat.id] ?? false)"
                :disabled="cat.required"
                class="border-input bg-page checked:border-accent checked:bg-accent focus:ring-ring/30 h-3.5 w-3.5 appearance-none rounded-[3px] border transition-[background-color,border-color] duration-150 focus:ring-1 focus:ring-offset-0 disabled:opacity-60"
                @change="settings[cat.id] = !settings[cat.id]"
              />
            </div>
            <label :for="`cookie-${cat.id}`" class="flex-1 cursor-pointer">
              <span class="text-ink text-[13px] font-medium">{{
                cat.label
              }}</span>
              <p class="text-muted mt-0.5 text-[11.5px]">
                {{ cat.description }}
              </p>
            </label>
            <span
              v-if="cat.required"
              class="text-muted mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px]"
            >
              必需
            </span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            class="text-muted hover:bg-surface hover:text-ink h-9 rounded-xl border px-4 text-[12px] font-medium transition-all duration-200"
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-accent text-ink hover:bg-accent/90 h-9 rounded-xl px-4 text-[12px] font-medium shadow-sm transition-all duration-200"
            @click="saveSettings"
          >
            保存设置
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
