import apiClient from '@/api/apiClient';
import { useAuthStore } from '@/features/auth';
import type { ProfileForm } from '@/types';
import { startRegistration } from '@simplewebauthn/browser';
import { motion } from 'framer-motion';
import axios from 'axios';
import { User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertDialog,
  AvatarUpload,
  ProfileFormFields,
  SecuritySection,
} from './components';

export default function ProfileSettingView() {
  const [searchParams] = useSearchParams();
  const auth = useAuthStore();

  const [form, setForm] = useState<ProfileForm>({
    name: '',
    username: '',
    gender: '',
    email: '',
    mobile: '',
    password: '',
  });

  const [errors, setErrors] = useState<{
    name?: string;
    username?: string;
    email?: string;
    mobile?: string;
    password?: string;
    submit?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [avatarUrl, setAvatarUrl] = useState('/v3/media/default.png');
  const [showPassword, setShowPassword] = useState(false);

  const [hasPasskey, setHasPasskey] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [deletingPasskey, setDeletingPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState('');
  const [passkeyMessageType, setPasskeyMessageType] = useState<
    'success' | 'error'
  >('success');

  const [hasGitHubBound, setHasGitHubBound] = useState(false);
  const [bindingGitHub, setBindingGitHub] = useState(false);
  const [unbindingGitHub, setUnbindingGitHub] = useState(false);
  const [githubMessage, setGithubMessage] = useState('');
  const [githubMessageType, setGithubMessageType] = useState<
    'success' | 'error'
  >('success');

  const [passkeyDialogOpen, setPasskeyDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);

  useEffect(() => {
    if (auth.user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: auth.user.name || '',
        username: auth.user.username || '',
        gender: auth.user.gender || '',
        email: auth.user.email || '',
        mobile: auth.user.mobile || '',
        password: '',
      });
      setHasPasskey(!!auth.user.has_passkey);
      setHasGitHubBound(!!auth.user.github_bound);

      if (auth.user.photo?.startsWith('http')) {
        setAvatarUrl(auth.user.photo);
      } else if (auth.user.photo) {
        setAvatarUrl(`/v3/media/${auth.user.photo}`);
      }
    }
  }, [auth.user]);

  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGithubMessage(errorMessages[error] || 'GitHub binding failed');
      setGithubMessageType('error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (success) {
      const successMessages: Record<string, string> = {
        github_bound: 'GitHub account bound successfully!',
        github_unbound: 'GitHub account unbound successfully!',
      };
      setGithubMessage(successMessages[success] || 'Operation successful');
      setGithubMessageType('success');
      auth.hydrateAuth();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams, auth]);

  const toggleGender = (value: string) => {
    setForm((prev) => ({
      ...prev,
      gender: prev.gender === value ? '' : value,
    }));
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await apiClient.put('v3/upload-pic', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data) {
        await auth.hydrateAuth();
        setMessage('Avatar updated successfully!');
        setMessageType('success');
      }
    } catch {
      setMessage('Network error, please try again');
      setMessageType('error');
    }

    event.target.value = '';
  };

  const handleAddPasskey = async () => {
    setAddingPasskey(true);
    setPasskeyMessage('');

    try {
      const optionsRes = await apiClient.get(
        '/auth/passkey/registration-options',
      );
      const options = optionsRes.data.data;

      const credential = await startRegistration({ optionsJSON: options });

      await apiClient.post('/auth/passkey/register', {
        response: credential,
      });

      setPasskeyMessage('Passkey added successfully!');
      setPasskeyMessageType('success');
      setHasPasskey(true);
      await auth.hydrateAuth();
    } catch (err) {
      console.error('Add passkey error:', err);
      setPasskeyMessage('Failed to add passkey');
      setPasskeyMessageType('error');
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleDeletePasskey = async () => {
    setDeletingPasskey(true);
    setPasskeyMessage('');

    try {
      await apiClient.delete('/auth/passkey/delete');
      setPasskeyMessage('Passkey deleted successfully!');
      setPasskeyMessageType('success');
      setHasPasskey(false);
      await auth.hydrateAuth();
    } catch (err) {
      console.error('Delete passkey error:', err);
      setPasskeyMessage('Failed to delete passkey');
      setPasskeyMessageType('error');
    } finally {
      setDeletingPasskey(false);
    }
  };

  const handleBindGitHub = () => {
    setBindingGitHub(true);
    setGithubMessage('');
    window.location.href = '/v3/github/bind';
  };

  const handleUnbindGitHub = async () => {
    setUnbindingGitHub(true);
    setGithubMessage('');

    try {
      await apiClient.post('/v3/github/unbind');
      setGithubMessage('GitHub account unbound successfully!');
      setGithubMessageType('success');
      setHasGitHubBound(false);
      await auth.hydrateAuth();
    } catch (err) {
      console.error('Unbind GitHub error:', err);
      setGithubMessage('Failed to unbind GitHub account');
      setGithubMessageType('error');
    } finally {
      setUnbindingGitHub(false);
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage('');
    setSaving(true);

    try {
      const payload = {
        name: form.name || '',
        username: form.username || '',
        gender: form.gender || null,
        email: form.email || null,
        mobile: form.mobile || null,
        password: form.password || null,
      };

      const response = await apiClient.put('/auth/settings', payload);

      if (response.data.code === 200) {
        await auth.hydrateAuth();
        setForm((prev) => ({ ...prev, password: '' }));
        setMessage('Profile updated successfully!');
        setMessageType('success');
      } else {
        setMessage(response.data.message || 'Failed to update profile');
        setMessageType('error');
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as Record<
          string,
          string | string[] | undefined
        >;
        setErrors({
          name: typeof data.name === 'string' ? data.name : undefined,
          username:
            typeof data.username === 'string' ? data.username : undefined,
          email: typeof data.email === 'string' ? data.email : undefined,
          mobile: typeof data.mobile === 'string' ? data.mobile : undefined,
          password:
            typeof data.password === 'string' ? data.password : undefined,
          submit: typeof data.error === 'string' ? data.error : undefined,
        });
        if (!errors.submit) {
          setMessage('Failed to update profile');
          setMessageType('error');
        }
      } else {
        setMessage('Network error, please try again');
        setMessageType('error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="font-body bg-page relative mb-24 h-full overflow-hidden">
      {/* Main Content */}
      <main className="relative z-10 mt-4 flex flex-col items-center px-5 pt-8 pb-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
          className="mb-8 flex flex-col items-center justify-center"
        >
          <div className="bg-accent text-ink mb-5 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_16px_rgba(37,99,235,0.25)]">
            <User className="size-8" />
          </div>
          <h2 className="font-headline text-ink text-center text-[28px] font-extrabold tracking-tight">
            Profile Settings
          </h2>
          <p className="text-muted mt-1 text-center text-[15px] font-medium">
            Manage your profile and preferences
          </p>
        </motion.div>

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          className="/50 bg-page/70 w-full max-w-100 rounded-4xl border p-6 shadow-xl"
        >
          <form className="flex flex-col" onSubmit={handleSubmit}>
            {/* Avatar Upload */}
            <AvatarUpload
              avatarUrl={avatarUrl}
              onPhotoUpload={handlePhotoUpload}
            />

            {/* Form Fields */}
            <ProfileFormFields
              form={form}
              errors={errors}
              showPassword={showPassword}
              toggleGender={toggleGender}
              setForm={setForm}
              setShowPassword={setShowPassword}
            />

            {/* Security Section */}
            <SecuritySection
              hasPasskey={hasPasskey}
              addingPasskey={addingPasskey}
              deletingPasskey={deletingPasskey}
              passkeyMessage={passkeyMessage}
              passkeyMessageType={passkeyMessageType}
              hasGitHubBound={hasGitHubBound}
              bindingGitHub={bindingGitHub}
              unbindingGitHub={unbindingGitHub}
              githubMessage={githubMessage}
              githubMessageType={githubMessageType}
              onAddPasskey={handleAddPasskey}
              onBindGitHub={handleBindGitHub}
              onOpenPasskeyDialog={() => setPasskeyDialogOpen(true)}
              onOpenGithubDialog={() => setGithubDialogOpen(true)}
            />

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-ink hover:bg-accent/90 w-full rounded-full py-4 text-[15px] font-bold shadow-[0_8px_16px_rgba(30,58,138,0.2)] transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="border-accent h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>

            {/* Message */}
            {message && (
              <div
                className={`mt-4 rounded-2xl p-3 text-center text-[12px] font-medium ${
                  messageType === 'success'
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </motion.div>
      </main>

      {/* Dialogs */}
      <AlertDialog
        open={passkeyDialogOpen}
        onOpenChange={setPasskeyDialogOpen}
        title="Are you absolutely sure?"
        description="This action cannot be undone. You will need to use your password to log in after deleting your passkey."
        onConfirm={handleDeletePasskey}
        destructive
      />

      <AlertDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        title="Are you absolutely sure?"
        description="This action will unbind your GitHub account from your profile. You will no longer be able to log in with GitHub after this."
        onConfirm={handleUnbindGitHub}
        destructive
      />
    </div>
  );
}
