'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';

export default function PasswordUpdate() {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserSupabase();
      if (!supabase) {
        setMessage({ type: 'error', text: 'Supabase is not configured.' });
        setSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully.' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
        }, 2000);
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Change password</Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="New password" htmlFor="new-pw">
        <Input
          id="new-pw"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min. 6 characters"
          required
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm-pw">
        <Input
          id="confirm-pw"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          required
        />
      </Field>

      {message && (
        <p className={`text-[13px] ${message.type === 'success' ? 'text-good' : 'text-bad'}`}>
          {message.text}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="ink" disabled={saving}>
          {saving ? 'Saving…' : 'Save password'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setNewPassword('');
            setConfirmPassword('');
            setMessage(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
