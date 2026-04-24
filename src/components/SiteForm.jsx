'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Field';

export default function SiteForm({ teamId, onSiteAdded }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          name,
          url: url.startsWith('http') ? url : `https://${url}`,
          scanFrequency: frequency,
          logoUrl: logoUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add site');
      }

      const { site } = await res.json();
      setName('');
      setUrl('');
      setLogoUrl('');
      setFrequency('daily');
      onSiteAdded?.(site);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="lime">
      <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: '#364503' }}>
        Quick add
      </div>
      <h3 className="font-semibold text-[18px] text-lime-ink mt-1 mb-3">Watch a new site</h3>

      {error && (
        <div className="rounded-r-sm bg-bad-bg border border-bad/20 p-3 text-[13px] text-bad mb-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
          <Field label="Site name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Website"
              required
              style={{ background: '#FDFFE9', borderColor: 'var(--lime-deep)' }}
            />
          </Field>
          <Field label="URL">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              style={{ background: '#FDFFE9', borderColor: 'var(--lime-deep)' }}
            />
          </Field>
          <Field label="Frequency">
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={{ background: '#FDFFE9', borderColor: 'var(--lime-deep)' }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </Field>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] grid-cols-1 gap-3">
          <Field label="Logo URL (optional)" hint="Auto-detected from favicon when empty">
            <Input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              style={{ background: '#FDFFE9', borderColor: 'var(--lime-deep)' }}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="ink" disabled={loading} className="w-full md:w-auto">
              {loading ? 'Adding…' : '+ Add site'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
