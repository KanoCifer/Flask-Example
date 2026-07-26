import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFriendLinkSubmit } from '../useFriendLinkSubmit';

describe('useFriendLinkSubmit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('初始状态为空且无错误', () => {
    const f = useFriendLinkSubmit();
    expect(f.name.value).toBe('');
    expect(f.email.value).toBe('');
    expect(f.siteName.value).toBe('');
    expect(f.siteUrl.value).toBe('');
    expect(f.description.value).toBe('');
    expect(f.submitting.value).toBe(false);
    expect(f.successMessage.value).toBe('');
    expect(f.errors.value).toEqual({});
  });

  describe('validate', () => {
    it('空表单返回 false 并填充全部错误', () => {
      const f = useFriendLinkSubmit();
      expect(f.validate()).toBe(false);
      expect(f.errors.value.name).toEqual(['请输入您的昵称']);
      expect(f.errors.value.email).toEqual(['请输入联系邮箱']);
      expect(f.errors.value.siteName).toEqual(['请输入网站名称']);
      expect(f.errors.value.siteUrl).toEqual(['请输入网站地址']);
      expect(f.errors.value.description).toEqual(['请输入网站描述']);
    });

    it('邮箱格式不正确', () => {
      const f = useFriendLinkSubmit();
      f.email.value = 'not-an-email';
      f.validate();
      expect(f.errors.value.email).toEqual(['邮箱格式不正确']);
    });

    it('邮箱格式合法通过', () => {
      const f = useFriendLinkSubmit();
      f.email.value = 'user@example.com';
      f.name.value = 'Me';
      f.siteName.value = 'Site';
      f.siteUrl.value = 'https://site.com';
      f.description.value = 'desc';
      expect(f.validate()).toBe(true);
      expect(f.errors.value).toEqual({});
    });

    it('URL 格式不正确', () => {
      const f = useFriendLinkSubmit();
      f.siteUrl.value = 'not a url';
      f.validate();
      expect(f.errors.value.siteUrl).toEqual(['URL 格式不正确，需包含域名']);
    });

    it('URL 合法（含 https）通过', () => {
      const f = useFriendLinkSubmit();
      f.name.value = 'Me';
      f.email.value = 'a@b.com';
      f.siteName.value = 'Site';
      f.siteUrl.value = 'https://example.com/path';
      f.description.value = 'desc';
      expect(f.validate()).toBe(true);
    });

    it('描述超过 200 字报错', () => {
      const f = useFriendLinkSubmit();
      f.description.value = 'x'.repeat(201);
      f.validate();
      expect(f.errors.value.description).toEqual(['描述不能超过 200 字']);
    });

    it('描述恰好 200 字通过', () => {
      const f = useFriendLinkSubmit();
      f.name.value = 'Me';
      f.email.value = 'a@b.com';
      f.siteName.value = 'Site';
      f.siteUrl.value = 'https://site.com';
      f.description.value = 'x'.repeat(200);
      expect(f.validate()).toBe(true);
    });

    it('validate 覆盖旧错误而非累积', () => {
      const f = useFriendLinkSubmit();
      f.validate(); // 全空
      expect(Object.keys(f.errors.value).length).toBe(5);
      f.name.value = 'Me';
      f.email.value = 'a@b.com';
      f.siteName.value = 'Site';
      f.siteUrl.value = 'https://site.com';
      f.description.value = 'desc';
      f.validate();
      expect(f.errors.value).toEqual({});
    });
  });

  describe('submit', () => {
    it('校验未通过返回 ok:false，不触发 mailto', () => {
      const f = useFriendLinkSubmit();
      const result = f.submit();
      expect(result.ok).toBe(false);
      expect(f.submitting.value).toBe(false);
    });

    it('校验通过触发 mailto 并返回 ok:true', () => {
      const f = useFriendLinkSubmit();
      f.name.value = 'Me';
      f.email.value = 'me@example.com';
      f.siteName.value = 'MySite';
      f.siteUrl.value = 'https://mysite.com';
      f.description.value = 'my blog';

      const setHref = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          set href(v: string) {
            setHref(v);
          },
        },
        writable: true,
      });

      const result = f.submit();

      expect(result.ok).toBe(true);
      expect(f.submitting.value).toBe(false);
      expect(setHref).toHaveBeenCalledTimes(1);
      const href = setHref.mock.calls[0][0] as string;
      expect(href.startsWith('mailto:kano3255@outlook.com')).toBe(true);
      expect(href).toContain(
        `subject=${encodeURIComponent('友链申请：MySite')}`,
      );
      expect(href).toContain(encodeURIComponent('昵称：Me'));
      expect(href).toContain(
        encodeURIComponent('网站地址：https://mysite.com'),
      );
      expect(f.successMessage.value).toBe(
        '已打开邮件客户端，请发送邮件完成申请。',
      );
    });

    it('submit 前先清空上次的 successMessage', () => {
      const f = useFriendLinkSubmit();
      f.successMessage.value = 'old';
      const result = f.submit(); // 校验失败
      expect(result.ok).toBe(false);
      expect(f.successMessage.value).toBe('');
    });
  });

  describe('reset', () => {
    it('reset 清空所有字段与状态', () => {
      const f = useFriendLinkSubmit();
      f.name.value = 'Me';
      f.email.value = 'a@b.com';
      f.siteName.value = 'Site';
      f.siteUrl.value = 'https://site.com';
      f.description.value = 'desc';
      f.submitting.value = true;
      f.successMessage.value = 'ok';
      f.errors.value = { name: ['x'] };

      f.reset();

      expect(f.name.value).toBe('');
      expect(f.email.value).toBe('');
      expect(f.siteName.value).toBe('');
      expect(f.siteUrl.value).toBe('');
      expect(f.description.value).toBe('');
      expect(f.submitting.value).toBe(false);
      expect(f.successMessage.value).toBe('');
      expect(f.errors.value).toEqual({});
    });
  });
});
