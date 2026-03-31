'use client';

import { useState, useEffect } from 'react';

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
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-sm text-gray-400">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.startsWith('Error')
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-green-500/10 border border-green-500/20 text-green-400'
        }`}>
          {message}
        </div>
      )}

      {/* Add member form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Add Team Member</h3>
        <div className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={adding || !email}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          The user must have signed up first. Admins can manage sites and integrations. Viewers are read-only.
        </p>
      </form>

      {/* Members list */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Email</th>
              <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Role</th>
              <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Joined</th>
              <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId} className="border-b border-gray-800/50 last:border-0">
                <td className="px-5 py-3 text-sm text-white">{member.email}</td>
                <td className="px-3 py-3 text-center">
                  {member.role === 'owner' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                      Owner
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      className="text-xs rounded bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5"
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-xs text-gray-500">
                  {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-5 py-3 text-right">
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(member.userId, member.email)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
