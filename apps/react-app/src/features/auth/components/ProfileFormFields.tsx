import { Eye, EyeOff, Lock, Mail, Phone, ShieldUser, User } from 'lucide-react';
import type { ProfileForm } from '@/types';

interface ProfileFormFieldsProps {
  form: ProfileForm;
  errors: {
    name?: string;
    username?: string;
    email?: string;
    mobile?: string;
    password?: string;
  };
  showPassword: boolean;
  toggleGender: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ProfileFormFields({
  form,
  errors,
  showPassword,
  toggleGender,
  setForm,
  setShowPassword,
}: ProfileFormFieldsProps) {
  return (
    <>
      {/* Display Name */}
      <div className="mb-5">
        <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
          Display Name
        </label>
        <div className="relative">
          <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <User className="size-5" />
          </div>
          <input
            type="text"
            autoComplete="off"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-4 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
            placeholder="Your name"
          />
        </div>
        {errors.name && (
          <span className="text-destructive mt-1 block pl-1 text-[12px] font-medium">
            {errors.name}
          </span>
        )}
      </div>

      {/* Username */}
      <div className="mb-5">
        <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
          Username <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <ShieldUser className="size-5" />
          </div>
          <input
            type="text"
            autoComplete="off"
            value={form.username}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, username: e.target.value }))
            }
            className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-4 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
            placeholder="Login username"
            required
          />
        </div>
        {errors.username && (
          <span className="text-destructive mt-1 block pl-1 text-[12px] font-medium">
            {errors.username}
          </span>
        )}
      </div>

      {/* Gender */}
      <div className="mb-5">
        <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
          Gender
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="group relative cursor-pointer">
            <input
              type="radio"
              value="male"
              checked={form.gender === 'male'}
              onChange={() => toggleGender('male')}
              className="peer sr-only"
            />
            <div className="bg-page/70 peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:shadow-accent/10 hover:border-accent/30 flex items-center justify-center rounded-2xl border-2 py-3.5 transition-all duration-300 group-active:scale-95 peer-checked:shadow-lg">
              <span className="text-muted peer-checked:text-ink text-sm font-medium transition-colors">
                Male
              </span>
            </div>
          </label>
          <label className="group relative cursor-pointer">
            <input
              type="radio"
              value="female"
              checked={form.gender === 'female'}
              onChange={() => toggleGender('female')}
              className="peer sr-only"
            />
            <div className="bg-page/70 peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:shadow-accent/10 hover:border-accent/30 flex items-center justify-center rounded-2xl border-2 py-3.5 transition-all duration-300 group-active:scale-95 peer-checked:shadow-lg">
              <span className="text-muted peer-checked:text-ink text-sm font-medium transition-colors">
                Female
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Email */}
      <div className="mb-5">
        <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
          Email
        </label>
        <div className="relative">
          <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Mail className="size-5" />
          </div>
          <input
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-4 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
            placeholder="your@email.com"
          />
        </div>
        {errors.email && (
          <span className="text-destructive mt-1 block pl-1 text-[12px] font-medium">
            {errors.email}
          </span>
        )}
      </div>

      {/* Mobile */}
      <div className="mb-5">
        <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
          Mobile
        </label>
        <div className="relative">
          <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Phone className="size-5" />
          </div>
          <input
            type="tel"
            autoComplete="off"
            value={form.mobile}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, mobile: e.target.value }))
            }
            className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-4 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
            placeholder="Phone number"
          />
        </div>
        {errors.mobile && (
          <span className="text-destructive mt-1 block pl-1 text-[12px] font-medium">
            {errors.mobile}
          </span>
        )}
      </div>

      {/* Password */}
      <div className="mb-6">
        <label className="text-muted mb-2 block pl-1 text-[13px] font-bold">
          Password
        </label>
        <div className="relative">
          <div className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Lock className="size-5" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, password: e.target.value }))
            }
            className="bg-secondary text-ink placeholder:text-muted focus:ring-ring/20 w-full rounded-2xl border-0 py-3.5 pr-12 pl-11 text-[15px] font-medium transition-all outline-none focus:ring-2"
            placeholder="Leave empty to keep current"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-muted hover:text-ink absolute inset-y-0 right-0 flex items-center pr-4 transition-all duration-200"
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
    </>
  );
}
