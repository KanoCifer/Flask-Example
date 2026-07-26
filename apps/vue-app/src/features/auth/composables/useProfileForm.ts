import { authGateway } from '@/features/auth/api/authGateway';
import { useAuthStore } from '@/features/auth';
import type { ProfileForm } from '@/features/auth/types';
import { ref } from 'vue';

/**
 * 个人资料表单 composable — 管理表单状态、校验、提交。
 * 视图层仅保留 template 与纯视图交互（头像上传 / Passkey / GitHub 绑定）。
 */
export function useProfileForm() {
  const authStore = useAuthStore();

  const form = ref<ProfileForm>({
    name: '',
    username: '',
    gender: '',
    email: '',
    mobile: '',
    password: '',
  });

  const errors = ref<Record<string, string>>({});
  const saving = ref(false);
  const message = ref('');
  const messageType = ref<'success' | 'error'>('success');

  const loadUserData = () => {
    if (authStore.user) {
      form.value.name = authStore.user.name || '';
      form.value.username = authStore.user.username || '';
      form.value.gender = authStore.user.gender || '';
      form.value.email = authStore.user.email || '';
      const userWithMobile = authStore.user as { mobile?: string } | null;
      form.value.mobile = userWithMobile?.mobile || '';
    }
  };

  const toggleGender = (value: string) => {
    if (form.value.gender === value) {
      form.value.gender = '';
    } else {
      form.value.gender = value;
    }
  };

  const handleSubmit = async () => {
    saving.value = true;
    errors.value = {};
    message.value = '';

    try {
      const payload = {
        name: form.value.name || '',
        username: form.value.username || '',
        gender: form.value.gender || null,
        email: form.value.email || null,
        mobile: form.value.mobile || null,
        password: form.value.password || null,
      };

      await authGateway.updateProfileSettings(payload);
      await authStore.fetchUser();
      form.value.password = '';
      message.value = 'Profile updated successfully!';
      messageType.value = 'success';
    } catch (error) {
      console.error('Settings update error:', error);
      message.value = 'Network error, please try again';
      messageType.value = 'error';
    } finally {
      saving.value = false;
    }
  };

  return {
    form,
    errors,
    saving,
    message,
    messageType,
    loadUserData,
    toggleGender,
    handleSubmit,
  };
}
