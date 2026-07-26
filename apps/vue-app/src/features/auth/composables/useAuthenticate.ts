import { useAuthStore } from '@/features/auth';
import type { LoginForm } from '@/features/auth/types';
import { startAuthentication } from '@simplewebauthn/browser';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export function useAuthenticate() {
  const auth = useAuthStore();
  const route = useRoute();
  const router = useRouter();
  const errors = ref<Record<string, string>>({});
  const isSubmitting = ref(false);
  const isPasskeySubmitting = ref(false);

  // 处理登录表单提交
  const handleSubmit = async (form: LoginForm) => {
    errors.value = {};
    isSubmitting.value = true;

    if (!form.username) {
      errors.value.username = '用户名不能为空';
    }
    if (!form.password) {
      errors.value.password = '密码不能为空';
    }
    if (errors.value.username || errors.value.password) {
      isSubmitting.value = false;
      return;
    }

    try {
      await auth.login(form.username, form.password);
      const redirect = (route.query.redirect as string) || '/';
      router.push(redirect);
    } catch {
      errors.value.password = '用户名或密码错误';
    } finally {
      isSubmitting.value = false;
    }
  };

  // Passkey 登录
  const handlePasskeyLogin = async () => {
    errors.value = {};
    isPasskeySubmitting.value = true;

    try {
      // 获取认证选项
      const options = await auth.getPasskeyAuthenticationOptions();

      // 调用浏览器 Passkey 认证
      const assertion = await startAuthentication({
        optionsJSON: options,
      });
      await auth.loginWithPasskey(assertion);
      const redirect = (route.query.redirect as string) || '/';
      router.push(redirect);
    } catch {
      errors.value.passkey = '登录失败，请稍后重试';
    } finally {
      isPasskeySubmitting.value = false;
    }
  };

  // GitHub 登录
  const handleGitHubLogin = () => {
    // 直接跳转到后端 GitHub 授权接口，后端会处理后续流程
    auth.loginWithGitHub();
  };

  return {
    errors,
    isSubmitting,
    isPasskeySubmitting,
    handleSubmit,
    handlePasskeyLogin,
    handleGitHubLogin,
  };
}
