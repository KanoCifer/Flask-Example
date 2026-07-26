import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProfileForm } from '../useProfileForm';
import type { UserInfo } from '@/features/auth/types';

// ── authGateway mock ────────────────────────────────────────────
const updateProfileSettings = vi.fn();
const fetchUser = vi.fn();
let mockUser: UserInfo | null = null;

vi.mock('@/features/auth', () => ({
  authGateway: {
    updateProfileSettings: (...args: unknown[]) =>
      updateProfileSettings(...args),
  },
  useAuthStore: () => ({
    get user() {
      return mockUser;
    },
    fetchUser: (...args: unknown[]) => fetchUser(...args),
  }),
}));

function makeUser(overrides: Partial<UserInfo> = {}): UserInfo {
  return {
    id: 1,
    username: 'tester',
    is_admin: false,
    name: 'Test User',
    email: 'test@example.com',
    photo: undefined,
    gender: 'male',
    mobile: '13800138000',
    ...overrides,
  };
}

describe('useProfileForm', () => {
  beforeEach(() => {
    mockUser = null;
    updateProfileSettings.mockReset();
    fetchUser.mockReset();
  });

  it('初始化表单为空字符串', () => {
    const { form } = useProfileForm();
    expect(form.value).toEqual({
      name: '',
      username: '',
      gender: '',
      email: '',
      mobile: '',
      password: '',
    });
  });

  it('初始状态：未提交、无消息', () => {
    const { saving, message, messageType, errors } = useProfileForm();
    expect(saving.value).toBe(false);
    expect(message.value).toBe('');
    expect(messageType.value).toBe('success');
    expect(errors.value).toEqual({});
  });

  it('loadUserData 从 authStore.user 填充表单', () => {
    mockUser = makeUser();
    const { form, loadUserData } = useProfileForm();
    loadUserData();
    expect(form.value.name).toBe('Test User');
    expect(form.value.username).toBe('tester');
    expect(form.value.gender).toBe('male');
    expect(form.value.email).toBe('test@example.com');
    expect(form.value.mobile).toBe('13800138000');
  });

  it('loadUserData 缺失字段回退为空串', () => {
    mockUser = makeUser({
      name: undefined,
      email: undefined,
      mobile: undefined,
      gender: undefined,
    });
    const { form, loadUserData } = useProfileForm();
    loadUserData();
    expect(form.value.name).toBe('');
    expect(form.value.email).toBe('');
    expect(form.value.mobile).toBe('');
    expect(form.value.gender).toBe('');
  });

  it('loadUserData 在 user 为空时不操作', () => {
    mockUser = null;
    const { form, loadUserData } = useProfileForm();
    loadUserData();
    expect(form.value.name).toBe('');
    expect(form.value.username).toBe('');
  });

  it('toggleGender 切换：选中 → 取消 → 换选', () => {
    const { form, toggleGender } = useProfileForm();
    expect(form.value.gender).toBe('');
    toggleGender('male');
    expect(form.value.gender).toBe('male');
    toggleGender('male');
    expect(form.value.gender).toBe('');
    toggleGender('female');
    expect(form.value.gender).toBe('female');
  });

  it('handleSubmit 成功：调用 API、刷新用户、清空密码、显示成功消息', async () => {
    updateProfileSettings.mockResolvedValue({});
    fetchUser.mockResolvedValue(undefined);

    const { form, handleSubmit, saving, message, messageType } =
      useProfileForm();
    form.value.name = 'New Name';
    form.value.username = 'newname';
    form.value.gender = 'female';
    form.value.email = 'new@example.com';
    form.value.mobile = '13900139000';
    form.value.password = 'secret123';

    await handleSubmit();

    expect(updateProfileSettings).toHaveBeenCalledWith({
      name: 'New Name',
      username: 'newname',
      gender: 'female',
      email: 'new@example.com',
      mobile: '13900139000',
      password: 'secret123',
    });
    expect(fetchUser).toHaveBeenCalledTimes(1);
    expect(form.value.password).toBe('');
    expect(message.value).toBe('Profile updated successfully!');
    expect(messageType.value).toBe('success');
    expect(saving.value).toBe(false);
  });

  it('handleSubmit 空字段以空串 / null 送出', async () => {
    updateProfileSettings.mockResolvedValue({});
    fetchUser.mockResolvedValue(undefined);

    const { handleSubmit } = useProfileForm();
    await handleSubmit();

    expect(updateProfileSettings).toHaveBeenCalledWith({
      name: '',
      username: '',
      gender: null,
      email: null,
      mobile: null,
      password: null,
    });
  });

  it('handleSubmit 失败：显示错误消息、saving 复位', async () => {
    updateProfileSettings.mockRejectedValue(new Error('Network error'));

    const { handleSubmit, saving, message, messageType } = useProfileForm();
    expect(saving.value).toBe(false);

    await handleSubmit();

    expect(message.value).toBe('Network error, please try again');
    expect(messageType.value).toBe('error');
    expect(saving.value).toBe(false);
  });

  it('handleSubmit 期间 saving 为 true', async () => {
    let resolveSubmit: () => void = () => {};
    updateProfileSettings.mockImplementation(
      () => new Promise<void>((resolve) => (resolveSubmit = resolve)),
    );

    const { handleSubmit, saving } = useProfileForm();
    const promise = handleSubmit();
    expect(saving.value).toBe(true);
    resolveSubmit();
    await promise;
    expect(saving.value).toBe(false);
  });
});
