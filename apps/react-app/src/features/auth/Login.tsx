import { IconGitHub } from '@/components';
import { useAuthStore } from '@/features/auth';
import { startAuthentication } from '@simplewebauthn/browser';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldUser } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function IconCloud({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 33C8.66666 33 4 31.5 4 25.5C4 18.5 11 17 13 17C14 13.5 16 8 24 8C31 8 34 12 35 15.5C35 15.5 44 16.5 44 25C44 31 40 33 36 33"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 33L24 38L32 28"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="24"
        cy="30"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        d="M31 18V11C31 7.13401 27.866 4 24 4V4C20.134 4 17 7.13401 17 11V18"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M24 26L24 34"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.8682 24.2982C25.4105 26.7935 26.4138 30.4526 25.4971 33.8863C24.5805 37.32 21.8844 40.0019 18.4325 40.9137C14.9806 41.8256 11.3022 40.8276 8.79375 38.2986C5.02208 34.4141 5.07602 28.2394 8.91499 24.4206C12.754 20.6019 18.9613 20.5482 22.8664 24.3L22.8682 24.2982Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M23 24L40 7"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30.3052 16.9001L35.7337 22.3001L42.0671 16.0001L36.6385 10.6001L30.3052 16.9001Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthStore();

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    passkey?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      await auth.login(loginForm.username, loginForm.password);
      const redirect =
        new URLSearchParams(location.search).get('redirect') || '/';
      navigate(redirect);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrors({ password: err.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setErrors({});
    setIsPasskeySubmitting(true);

    try {
      const options = await auth.getPasskeyAuthenticationOptions();
      const assertion = await startAuthentication({
        optionsJSON: options,
      });
      await auth.loginWithPasskey(assertion);
      const redirect =
        new URLSearchParams(location.search).get('redirect') || '/';
      navigate(redirect);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrors({ passkey: err.message });
      }
    } finally {
      setIsPasskeySubmitting(false);
    }
  };

  const handleGitHubLogin = () => {
    window.location.href = '/v3/auth/github';
  };

  return (
    <div className="font-body bg-page relative min-h-screen overflow-hidden">
      {/* Main Content */}
      <main className="relative z-10 mt-4 flex flex-col items-center px-5 pt-8 pb-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
          className={`mb-8 flex flex-col items-center justify-center`}
        >
          <div className="bg-accent text-ink mb-5 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_16px_rgba(37,99,235,0.25)]">
            <IconCloud className="size-8" />
          </div>
          <h2 className="font-headline text-ink text-center text-[28px] font-extrabold tracking-tight">
            kanocifer
            <span className="text-ink">.chat</span>
          </h2>
          <p className="text-muted mt-1 text-center text-[15px] font-medium">
            Welcome back to the reading space.
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          className={`} /50 bg-page/70 w-full max-w-100 rounded-4xl border p-6 shadow-xl`}
        >
          <form className="flex flex-col" onSubmit={handleSubmit}>
            {/* Username Field */}
            <div className="mb-5">
              <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
                Username
              </label>
              <div className="relative">
                <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <ShieldUser className="size-6" />
                </div>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Enter your username"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                  className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-4 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
                />
              </div>
              {errors.username && (
                <span className="text-destructive mt-1 block pl-1 text-[12px] font-medium">
                  {errors.username}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="mb-5">
              <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
                Password
              </label>
              <div className="relative">
                <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <IconLock className="size-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-12 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
                />
                <button
                  type="button"
                  className="text-muted hover:text-ink absolute inset-y-0 right-0 flex items-center pr-4 transition-all duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="text-destructive mt-1 block pl-1 text-[12px] font-medium">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Forgot Password */}
            <div className="mb-6 flex items-center justify-end px-1">
              <a
                href="#"
                className="text-ink text-[14px] font-bold hover:underline"
              >
                {' '}
                Forgot?{' '}
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent text-ink hover:bg-accent/90 mb-4 w-full rounded-full py-4 text-[15px] font-bold shadow-[0_8px_16px_rgba(30,58,138,0.2)] transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>

            {/* Passkey Button */}
            <button
              type="button"
              disabled={isPasskeySubmitting}
              className="bg-page text-ink disabled:bg-surface flex w-full items-center justify-center space-x-2 rounded-full py-4 text-[15px] font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-70"
              onClick={handlePasskeyLogin}
            >
              <IconKey className="size-5" />
              {isPasskeySubmitting ? (
                <span className="border-ink h-4.5 w-4.5 animate-spin rounded-full border-2 border-t-transparent"></span>
              ) : (
                <span>Login with Passkey</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center justify-center text-center">
            <div className="bg-border h-px flex-1"></div>
            <span className="text-muted px-3 text-[11px] font-bold tracking-wider uppercase">
              OR CONTINUE WITH
            </span>
            <div className="bg-border h-px flex-1"></div>
          </div>

          {/* GitHub Button */}
          <button
            className="bg-ink text-page hover:bg-ink/90 flex w-full items-center justify-center space-x-2.5 rounded-full py-4 text-[15px] font-bold shadow-md transition-all active:scale-[0.98]"
            onClick={handleGitHubLogin}
          >
            <IconGitHub />
            <span>Login with GitHub</span>
          </button>

          {/* Passkey Error */}
          {errors.passkey && (
            <div className="bg-destructive/10 text-destructive mt-4 rounded-2xl p-2 text-center text-[12px] font-medium">
              {errors.passkey}
            </div>
          )}

          {/* Register Link */}
          <div className="mt-8 text-center">
            <p className="text-muted text-[14.5px] font-medium">
              Don't have an account?
              <Link
                to="/register"
                className="text-ink ml-1 font-bold hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
