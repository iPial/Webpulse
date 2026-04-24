'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { Input, Select, Field } from '@/components/ui/Field';

const ROLE_STYLES = {
  owner: 'bg-ink text-lime',
  admin: 'bg-[#EDE2F8] text-violet',
  editor: 'bg-good-bg text-good',
  viewer: 'bg-paper-2 text-muted',
};

export default function TeamManager() {
  const [members, setMembers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    try {
      const res = await fetch('/api/team/members');
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members);
        setTeamName(data.teamName);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setMessage('');

    try {
      const res = await fetch('/api/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);

      setEmail('');
      setRole('viewer');
      setMessage(`Added ${data.member.email} as ${data.member.role}`);
      fetchMembers();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId, memberEmail) {
    if (!confirm(`Remove ${memberEmail} from the team?`)) return;

    const res = await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setMessage(`Removed ${memberEmail}`);
    } else {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
    }
  }

  async function handleRoleChange(userId, newRole) {
    const res = await fetch('/api/team/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });

    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
      );
    } else {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
    }
  }

  if (loading) {
    return (
      <Card variant="hairline" className="text-center py-10">
        <p className="text-[13px] text-muted">Loading team…</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div
          className={`rounded-r-sm p-3 text-[13px] border ${
            message.startsWith('Error')
              ? 'bg-bad-bg border-bad/20 text-bad'
              : 'bg-good-bg border-good/20 text-good'
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-12 grid-cols-1 gap-6">
        {/* Seat / team info */}
        <Card variant="lime" className="md:col-span-5">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: '#364503' }}>
            Team
          </div>
          <h2 className="font-serif text-[32px] leading-tight mt-1 text-lime-ink">
            {teamName || 'Your workspace'}
          </h2>
          <p className="text-[13px]" style={{ color: '#364503' }}>
            {members.length} member{members.length === 1 ? '' : 's'}
          </p>
        </Card>

        {/* Invite form */}
        <Card className="md:col-span-7">
          <h3 className="font-semibold text-[15px] text-ink">Add team member</h3>
          <p className="text-[12px] text-muted mt-1">
            The user must have signed up first. Admins can manage sites and integrations. Viewers are read-only.
          </p>
          <form onSubmit={handleAdd} className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <Field label="Email" className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value)} className="min-w-[140px]">
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Button type="submit" variant="ink" disabled={adding || !email}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Members table */}
      <Card padding="sm">
        <div className="px-2 pt-2 mb-3">
          <h3 className="font-semibold text-[15px] text-ink">Team members</h3>
          <p className="text-[12px] text-muted mt-0.5">
            Active members with access to this workspace
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">
                <th className="px-3 py-2.5">Member</th>
                <th className="px-3 py-2.5 text-center">Role</th>
                <th className="px-3 py-2.5 text-center">Joined</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.email?.split('@')[0]} email={member.email} size="sm" />
                      <span className="font-medium text-ink">{member.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {member.role === 'owner' ? (
                      <span className={`font-mono text-[11px] px-2.5 py-0.5 rounded-r-pill ${ROLE_STYLES.owner}`}>
                        ● owner
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        className="text-[11px] rounded-r-pill bg-surface border border-line text-ink-2 px-2.5 py-1 shadow-1 font-mono focus:outline-none focus:border-ink"
                      >
                        <option value="admin">admin</option>
                        <option value="viewer">viewer</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-[12px] text-muted">
                    {new Date(member.joinedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {member.role !== 'owner' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRemove(member.userId, member.email)}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
