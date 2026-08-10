import { ref } from 'vue';

export interface FormErrors {
  name?: string[];
  email?: string[];
  siteName?: string[];
  siteUrl?: string[];
  description?: string[];
}

export interface FriendLinkSubmitResult {
  /** 提交成功（已触发邮件客户端） */
  ok: true;
}

export interface FriendLinkSubmitError {
  /** 校验未通过，errors 已填充 */
  ok: false;
}

export type FriendLinkSubmitOutcome =
  | FriendLinkSubmitResult
  | FriendLinkSubmitError;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

export function useFriendLinkSubmit() {
  const name = ref('');
  const email = ref('');
  const siteName = ref('');
  const siteUrl = ref('');
  const description = ref('');
  const submitting = ref(false);
  const successMessage = ref('');
  const errors = ref<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.value.trim()) {
      newErrors.name = ['请输入您的昵称'];
    }

    if (!email.value.trim()) {
      newErrors.email = ['请输入联系邮箱'];
    } else if (!EMAIL_REGEX.test(email.value)) {
      newErrors.email = ['邮箱格式不正确'];
    }

    if (!siteName.value.trim()) {
      newErrors.siteName = ['请输入网站名称'];
    }

    if (!siteUrl.value.trim()) {
      newErrors.siteUrl = ['请输入网站地址'];
    } else if (!URL_REGEX.test(siteUrl.value)) {
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

  const reset = () => {
    name.value = '';
    email.value = '';
    siteName.value = '';
    siteUrl.value = '';
    description.value = '';
    submitting.value = false;
    successMessage.value = '';
    errors.value = {};
  };

  const submit = (): FriendLinkSubmitOutcome => {
    successMessage.value = '';

    if (!validate()) {
      return { ok: false };
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
    return { ok: true };
  };

  return {
    name,
    email,
    siteName,
    siteUrl,
    description,
    submitting,
    successMessage,
    errors,
    validate,
    reset,
    submit,
  };
}
