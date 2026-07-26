// 认证表单类型

export interface LoginForm {
  username: string;
  password: string;
}

export interface ProfileForm {
  name?: string;
  username?: string;
  gender?: string;
  email?: string;
  mobile?: string;
  password?: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirm_password?: string;
  confirmPassword?: string;
  emailCode?: string;
}

export interface UserInfo {
  id: number;
  username: string;
  is_admin: boolean;
  name?: string;
  email?: string;
  photo?: string;
  gender?: string | null;
  mobile?: string | null;
  has_passkey?: boolean;
  github_bound?: boolean;
}
