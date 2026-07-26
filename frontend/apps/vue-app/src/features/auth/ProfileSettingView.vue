<script setup lang="ts">
import { authGateway, useProfileForm } from '@/features/auth';
import { useAuthStore } from '@/features/auth';
import { useUpload } from '@/features/upload';
import { AuthLayout } from './components';
import { FieldError, IconCloud } from '@/components';
import {
  AlertCircle,
  AtSign,
  Camera,
  Check,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  ShieldUser,
  Trash2,
  User,
} from '@lucide/vue';
import { startRegistration } from '@simplewebauthn/browser';
import { computed, onMounted, ref } from 'vue';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components';

const authStore = useAuthStore();
const {
  form,
  errors,
  saving,
  message,
  messageType,
  loadUserData,
  toggleGender,
  handleSubmit,
} = useProfileForm();

// 头像上传：走 uploadGateway 的 avatar 分支（PUT v3/upload-pic, field=image）
const { upload: uploadAvatar } = useUpload({ type: 'avatar' });

const avatarUrl = computed(() => {
  if (authStore.user?.photo?.startsWith('http')) {
    return authStore.user.photo;
  }
  if (authStore.user?.photo) {
    return `/v3/media/${authStore.user.photo}`;
  }
  return '/v3/media/default.png';
});

const handlePhotoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  try {
    await uploadAvatar(file);
    await authStore.fetchUser();
    message.value = 'Avatar updated successfully!';
    messageType.value = 'success';
  } catch (error) {
    console.error('Avatar upload error:', error);
    message.value = 'Network error, please try again';
    messageType.value = 'error';
  }

  input.value = '';
};

const addingPasskey = ref(false);
const deletingPasskey = ref(false);
const passkeyMessage = ref('');
const passkeyMessageType = ref<'success' | 'error'>('success');
const hasPasskey = ref(false);

const bindingGitHub = ref(false);
const unbindingGitHub = ref(false);
const githubMessage = ref('');
const githubMessageType = ref<'success' | 'error'>('success');
const hasGitHubBound = ref<boolean>(false);

const handleAddPasskey = async () => {
  addingPasskey.value = true;
  passkeyMessage.value = '';

  try {
    const optionsRes = await authGateway.getPasskeyRegistrationOptions();
    const options = optionsRes.data.data;
    if (!options) throw new Error('Failed to get passkey registration options');

    const credential = await startRegistration({ optionsJSON: options });

    await authGateway.registerPasskey({
      response: credential,
    });

    passkeyMessage.value = 'Passkey added successfully!';
    passkeyMessageType.value = 'success';
    hasPasskey.value = true;
  } catch (error) {
    console.error('Add passkey error:', error);
    passkeyMessage.value = 'Failed to add passkey';
    passkeyMessageType.value = 'error';
  } finally {
    addingPasskey.value = false;
  }
};

const handleDeletePasskey = async () => {
  deletingPasskey.value = true;
  passkeyMessage.value = '';

  try {
    await authGateway.deletePasskey();
    passkeyMessage.value = 'Passkey deleted successfully!';
    passkeyMessageType.value = 'success';
    hasPasskey.value = false;
  } catch (error) {
    console.error('Delete passkey error:', error);
    passkeyMessage.value = 'Failed to delete passkey';
    passkeyMessageType.value = 'error';
  } finally {
    deletingPasskey.value = false;
  }
};

const handleBindGitHub = () => {
  bindingGitHub.value = true;
  githubMessage.value = '';
  window.location.href = '/v3/github/bind';
};

const handleUnbindGitHub = async () => {
  unbindingGitHub.value = true;
  githubMessage.value = '';

  try {
    await authGateway.unbindGithub();
    githubMessage.value = 'GitHub account unbound successfully!';
    githubMessageType.value = 'success';
    hasGitHubBound.value = false;
    await authStore.fetchUser();
  } catch (error) {
    console.error('Unbind GitHub error:', error);
    githubMessage.value = 'Failed to unbind GitHub account';
    githubMessageType.value = 'error';
  } finally {
    unbindingGitHub.value = false;
  }
};

onMounted(() => {
  loadUserData();

  if (authStore.user) {
    const userWithPasskey = authStore.user as { has_passkey?: boolean } | null;
    hasPasskey.value = !!userWithPasskey?.has_passkey;
    const userWithGitHub = authStore.user as { github_bound?: boolean } | null;
    hasGitHubBound.value = !!userWithGitHub?.github_bound;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const success = urlParams.get('success');

  if (error) {
    const errorMessages: Record<string, string> = {
      not_logged_in: 'Please log in first to bind GitHub account',
      github_already_bound:
        'This GitHub account is already bound to another user',
      github_not_bound: 'Your account is not bound to GitHub',
      invalid_oauth_state: 'Invalid OAuth state, please try again',
      missing_pkce_info: 'Missing PKCE information, please try again',
      github_auth_failed: 'GitHub authentication failed, please try again',
    };
    githubMessage.value = errorMessages[error] || 'GitHub binding failed';
    githubMessageType.value = 'error';
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (success) {
    const successMessages: Record<string, string> = {
      github_bound: 'GitHub account bound successfully!',
      github_unbound: 'GitHub account unbound successfully!',
    };
    githubMessage.value = successMessages[success] || 'Operation successful';
    githubMessageType.value = 'success';
    authStore.fetchUser();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
</script>

<template>
  <AuthLayout
    brand-width="w-1/2"
    form-width="lg:w-1/2"
    form-max-width="max-w-md xl:max-w-xl"
  >
    <template #branding>
      <div class="flex items-center gap-2 text-xl font-bold tracking-tight">
        <IconCloud class="text-ink size-8" />
        <span>Kanocifer<span class="text-ink">.chat</span></span>
      </div>
      <div class="z-10 my-auto">
        <div class="flex flex-col">
          <h1 class="text-5xl font-extrabold tracking-tight xl:text-6xl">
            Shape your <br />
            reading identity.
          </h1>
          <p class="mt-6 max-w-md text-lg text-zinc-400">
            Update your profile, manage your passkeys, and connect the accounts
            that power your reading life.
          </p>
        </div>
      </div>
      <div class="z-10 font-serif text-sm text-zinc-500">Kuroome's Blog</div>
    </template>

    <template #header>
      <div class="mb-8 flex flex-col items-center lg:items-start">
        <div
          class="bg-accent text-ink mb-5 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_16px_rgba(37,99,235,0.25)] lg:hidden"
        >
          <IconCloud class="size-8" />
        </div>
        <h2
          class="font-headline text-ink text-center text-3xl text-[28px] font-extrabold tracking-tight lg:text-left"
        >
          Profile Settings
        </h2>
        <p
          class="text-muted mt-2 text-center text-[15px] font-medium lg:text-left"
        >
          Manage your profile and security preferences.
        </p>
      </div>
    </template>

    <div class="mb-8 flex flex-col items-center gap-3">
      <div class="group relative">
        <div class="h-24 w-24 overflow-hidden rounded-full border-4 shadow-lg">
          <img
            :src="avatarUrl"
            alt="Avatar"
            class="h-full w-full object-cover"
          />
        </div>
        <input
          id="photo-upload"
          type="file"
          accept=".jpg,.jpeg,.png,.gif"
          class="sr-only"
          @change="handlePhotoUpload"
        />
        <label
          for="photo-upload"
          class="bg-accent text-ink hover:bg-accent/90 focus:ring-accent/30 absolute -right-1 -bottom-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          <Camera class="size-4" />
        </label>
      </div>
      <p class="text-muted text-xs">Click the camera to update</p>
    </div>

    <form @submit.prevent="handleSubmit" class="w-full">
      <div>
        <div class="relative my-3">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <User class="size-6" />
          </div>
          <input
            v-model="form.name"
            type="text"
            autocomplete="off"
            placeholder="display name"
            class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.name,
            }"
          />
        </div>
        <FieldError :message="errors.name" />
      </div>

      <div>
        <div class="relative my-3">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <AtSign class="size-6" />
          </div>
          <input
            v-model="form.username"
            type="text"
            autocomplete="off"
            placeholder="username"
            class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.username,
            }"
          />
        </div>
        <FieldError :message="errors.username" />
      </div>

      <div class="my-3">
        <div class="text-muted/60 flex items-center gap-2 text-sm">
          <ShieldUser class="size-5" />
          <span>Gender</span>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-3">
          <label class="group relative cursor-pointer">
            <input
              v-model="form.gender"
              type="radio"
              value="male"
              class="peer sr-only"
              @click="toggleGender('male')"
            />
            <div
              class="bg-surface peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:shadow-accent/10 hover:border-accent/30 flex items-center justify-center rounded-xl border-2 px-4 py-2.5 transition-all duration-200 select-none group-active:scale-95"
            >
              <span
                class="text-muted peer-checked:text-ink text-sm font-bold transition-colors"
                >Male</span
              >
            </div>
          </label>
          <label class="group relative cursor-pointer">
            <input
              v-model="form.gender"
              type="radio"
              value="female"
              class="peer sr-only"
              @click="toggleGender('female')"
            />
            <div
              class="bg-surface peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:shadow-accent/10 hover:border-accent/30 flex items-center justify-center rounded-xl border-2 px-4 py-2.5 transition-all duration-200 select-none group-active:scale-95"
            >
              <span
                class="text-muted peer-checked:text-ink text-sm font-bold transition-colors"
                >Female</span
              >
            </div>
          </label>
        </div>
      </div>

      <div>
        <div class="relative my-3">
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
            class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.email,
            }"
          />
        </div>
        <span
          v-if="errors.email"
          class="text-destructive mt-1.5 flex items-center gap-1.5 text-sm"
        >
          <AlertCircle class="size-4 shrink-0" />
          {{ errors.email }}
        </span>
      </div>

      <div>
        <div class="relative my-3">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <Phone class="size-6" />
          </div>
          <input
            v-model="form.mobile"
            type="tel"
            autocomplete="off"
            placeholder="mobile"
            class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.mobile,
            }"
          />
        </div>
        <span
          v-if="errors.mobile"
          class="text-destructive mt-1.5 flex items-center gap-1.5 text-sm"
        >
          <AlertCircle class="size-4 shrink-0" />
          {{ errors.mobile }}
        </span>
      </div>

      <div>
        <div class="relative my-3">
          <div
            class="text-muted/60 pointer-events-none absolute top-1/2 left-0 z-10 flex -translate-y-1/2 items-center pl-4"
          >
            <Lock class="size-6" />
          </div>
          <input
            v-model="form.password"
            type="password"
            autocomplete="off"
            placeholder="new password (leave empty to keep current)"
            class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl py-3 pr-4 pl-11 transition-colors placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            :class="{
              'border-destructive focus:border-destructive focus:ring-destructive/30':
                errors.password,
            }"
          />
        </div>
        <span
          v-if="errors.password"
          class="text-destructive mt-1.5 flex items-center gap-1.5 text-sm"
        >
          <AlertCircle class="size-4 shrink-0" />
          {{ errors.password }}
        </span>
      </div>

      <div class="mt-6">
        <button
          type="submit"
          class="bg-accent text-ink shadow-accent/30 hover:bg-accent/90 focus:ring-accent/30 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-8 py-2.5 font-bold shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="saving"
        >
          <Loader2 v-if="saving" class="h-5 w-5 animate-spin" />
          <Save v-else class="h-5 w-5" />
          {{ saving ? 'Saving Changes...' : 'Save Changes' }}
        </button>
      </div>

      <div
        v-if="message"
        :class="[
          messageType === 'success' ? 'text-success' : 'text-destructive',
          'mt-3 flex items-center justify-center gap-1.5 text-center text-sm',
        ]"
      >
        <Check v-if="messageType === 'success'" class="h-4 w-4" />
        <AlertCircle v-else class="h-4 w-4" />
        {{ message }}
      </div>
    </form>

    <div class="relative mt-8">
      <div class="absolute inset-0 flex items-center">
        <span class="w-full border-t"></span>
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="bg-page text-muted px-2"> Security </span>
      </div>
    </div>

    <div class="mt-6">
      <button
        v-if="!hasPasskey"
        type="button"
        @click="handleAddPasskey"
        :disabled="addingPasskey"
        class="bg-success text-ink shadow-success/30 hover:bg-success/90 focus:ring-success/30 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-8 py-2.5 font-bold shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Loader2 v-if="addingPasskey" class="h-5 w-5 animate-spin" />
        <KeyRound v-else class="h-5 w-5" />
        {{ addingPasskey ? 'Adding Passkey...' : 'Add Passkey' }}
      </button>
      <AlertDialog v-else>
        <AlertDialogTrigger as-child>
          <button
            type="button"
            :disabled="deletingPasskey"
            class="bg-destructive text-ink shadow-destructive/30 hover:bg-destructive/90 focus:ring-destructive/30 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-8 py-2.5 font-bold shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Loader2 v-if="deletingPasskey" class="h-5 w-5 animate-spin" />
            <Trash2 v-else class="h-5 w-5" />
            {{ deletingPasskey ? 'Deleting Passkey...' : 'Delete Passkey' }}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You will need to use your password
              to log in after deleting your passkey.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="handleDeletePasskey">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p
        v-if="passkeyMessage"
        :class="[
          passkeyMessageType === 'success'
            ? 'text-success'
            : 'text-destructive',
          'mt-2 flex items-center justify-center gap-1.5 text-center text-sm',
        ]"
      >
        <Check v-if="passkeyMessageType === 'success'" class="h-4 w-4" />
        <AlertCircle v-else class="h-4 w-4" />
        {{ passkeyMessage }}
      </p>
    </div>

    <div class="relative mt-8">
      <div class="absolute inset-0 flex items-center">
        <span class="w-full border-t"></span>
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="bg-page text-muted px-2"> Connected Accounts </span>
      </div>
    </div>

    <div class="mt-6">
      <button
        v-if="!hasGitHubBound"
        type="button"
        @click="handleBindGitHub"
        :disabled="bindingGitHub"
        class="text-ink focus:ring-accent inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-black px-8 py-2.5 font-bold shadow-lg transition-colors hover:bg-black/90 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Loader2 v-if="bindingGitHub" class="h-5 w-5 animate-spin" />
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
          />
        </svg>
        {{ bindingGitHub ? 'Binding GitHub...' : 'Bind GitHub Account' }}
      </button>
      <AlertDialog v-else>
        <AlertDialogTrigger as-child>
          <button
            type="button"
            :disabled="unbindingGitHub"
            class="text-ink focus:ring-accent inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-black px-8 py-2.5 font-bold shadow-lg transition-colors hover:bg-black/90 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
          >
            <Loader2 v-if="unbindingGitHub" class="h-5 w-5 animate-spin" />
            <Trash2 v-else class="h-5 w-5" />
            {{ unbindingGitHub ? 'Unbinding...' : 'Unbind GitHub Account' }}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will unbind your GitHub account from your profile. You
              will no longer be able to log in with GitHub after this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="handleUnbindGitHub">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p
        v-if="githubMessage"
        :class="[
          githubMessageType === 'success' ? 'text-success' : 'text-destructive',
          'mt-2 flex items-center justify-center gap-1.5 text-center text-sm',
        ]"
      >
        <Check v-if="githubMessageType === 'success'" class="h-4 w-4" />
        <AlertCircle v-else class="h-4 w-4" />
        {{ githubMessage }}
      </p>
    </div>
  </AuthLayout>
</template>
