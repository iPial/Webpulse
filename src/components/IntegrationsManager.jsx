'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';
import { Input, Select, Field } from '@/components/ui/Field';

export default function IntegrationsManager({ teamId, initialIntegrations }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [psiApiKey, setPsiApiKey] = useState(
    integrations.find((i) => i.type === 'pagespeed')?.config?.apiKey || ''
  );
  const aiIntegrationInit =
    integrations.find((i) => i.type === 'ai_provider') ||
    integrations.find((i) => i.type === 'anthropic');
  const [aiProvider, setAiProvider] = useState(aiIntegrationInit?.config?.provider || 'anthropic');
  const [aiApiKey, setAiApiKey] = useState(aiIntegrationInit?.config?.apiKey || '');
  const [slackUrl, setSlackUrl] = useState(
    integrations.find((i) => i.type === 'slack')?.config?.webhookUrl || ''
  );
  const [emailList, setEmailList] = useState(
    integrations.find((i) => i.type === 'email')?.config?.emails || ''
  );
  const [saving, setSaving] = useState('');
  const [testing, setTesting] = useState('');
  const [message, setMessage] = useState('');

  async function saveIntegration(type, config) {
    setSaving(type);
    setMessage('');
    const existing = integrations.find((i) => i.type === type);

    try {
      let res;
      if (existing) {
        res = await fetch(`/api/integrations/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
        });
      } else {
        res = await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, type, config }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const { integration } = await res.json();
      setIntegrations((prev) => {
        const filtered = prev.filter((i) => i.type !== type);
        return [...filtered, integration];
      });
      setMessage(`${type} integration saved.`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving('');
    }
  }

  async function testIntegration(type) {
    setTesting(type);
    setMessage('');
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Test failed');
      }
      setMessage(`${type} test sent successfully!`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setTesting('');
    }
  }

  async function toggleIntegration(id, enabled) {
    const res = await fetch(`/api/integrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (res.ok) {
      const { integration } = await res.json();
      setIntegrations((prev) => prev.map((i) => (i.id === id ? integration : i)));
    }
  }

  const psiIntegration = integrations.find((i) => i.type === 'pagespeed');
  const aiIntegration =
    integrations.find((i) => i.type === 'ai_provider') ||
    integrations.find((i) => i.type === 'anthropic');
  const slackIntegration = integrations.find((i) => i.type === 'slack');
  const emailIntegration = integrations.find((i) => i.type === 'email');

  const aiProviderOptions = [
    { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-…' },
    { value: 'openai', label: 'OpenAI (GPT)', placeholder: 'sk-…' },
    { value: 'gemini', label: 'Google (Gemini)', placeholder: 'AIza…' },
  ];
  const currentProviderOption =
    aiProviderOptions.find((o) => o.value === aiProvider) || aiProviderOptions[0];

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

      <div className="grid md:grid-cols-2 grid-cols-1 gap-6">
        {/* PageSpeed API */}
        <Card>
          <IntegHead
            icon={<GoogleIcon />}
            iconBg="bg-surface border border-line"
            title="Google PageSpeed API"
            subtitle="Required to run Lighthouse scans."
            configured={!!psiIntegration}
          />
          <div className="h-px bg-line my-3" />
          <Field label="API key">
            <div className="flex gap-2">
              <Input
                type="password"
                value={psiApiKey}
                onChange={(e) => setPsiApiKey(e.target.value)}
                placeholder="AIza…"
                className="flex-1 font-mono"
              />
              <Button
                variant="ink"
                onClick={() => saveIntegration('pagespeed', { apiKey: psiApiKey })}
                disabled={saving === 'pagespeed' || !psiApiKey}
              >
                {saving === 'pagespeed' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Field>
          <p className="text-[11px] text-muted mt-2">
            Get a key from console.cloud.google.com → APIs → PageSpeed Insights.
          </p>
        </Card>

        {/* AI Provider (ink tile in the mockup) */}
        <Card variant="ink">
          <IntegHead
            icon={<AIIcon />}
            iconBg="bg-ink text-lime"
            title="AI Provider"
            subtitle="API key for AI-powered recommendations."
            configured={!!aiIntegration}
            dark
          />
          <div className="h-px bg-white/10 my-3" />
          <div className="flex flex-col gap-3">
            <Field label="Provider" className="[&_label]:text-white/70">
              <Select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="bg-white/5 text-surface border-white/10"
              >
                {aiProviderOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-ink">
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="API key" className="[&_label]:text-white/70">
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={currentProviderOption.placeholder}
                  className="flex-1 font-mono bg-white/5 text-surface border-white/10 placeholder:text-white/40"
                />
                <Button
                  variant="primary"
                  onClick={() => saveIntegration('ai_provider', { provider: aiProvider, apiKey: aiApiKey })}
                  disabled={saving === 'ai_provider' || !aiApiKey}
                >
                  {saving === 'ai_provider' ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </Field>
          </div>
        </Card>

        {/* Slack */}
        <Card>
          <IntegHead
            icon={<span className="text-[20px] font-bold">#</span>}
            iconBg="bg-[#4A154B] text-white"
            title="Slack"
            subtitle="Daily digests & regression alerts."
            toggle={slackIntegration ? {
              on: slackIntegration.enabled,
              onClick: () => toggleIntegration(slackIntegration.id, slackIntegration.enabled),
            } : null}
          />
          <div className="h-px bg-line my-3" />
          <Field label="Webhook URL">
            <div className="flex gap-2 flex-wrap">
              <Input
                type="url"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/…"
                className="flex-1 min-w-0 font-mono"
              />
              {slackIntegration && (
                <Button onClick={() => testIntegration('slack')} disabled={testing === 'slack'}>
                  {testing === 'slack' ? 'Testing…' : 'Test'}
                </Button>
              )}
              <Button
                variant="ink"
                onClick={() => saveIntegration('slack', { webhookUrl: slackUrl })}
                disabled={saving === 'slack' || !slackUrl}
              >
                {saving === 'slack' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Field>
        </Card>

        {/* Email */}
        <Card>
          <IntegHead
            icon={<EmailIcon />}
            iconBg="bg-sky text-cobalt"
            title="Email reports"
            subtitle="Scan reports via email, per recipient."
            toggle={emailIntegration ? {
              on: emailIntegration.enabled,
              onClick: () => toggleIntegration(emailIntegration.id, emailIntegration.enabled),
            } : null}
          />
          <div className="h-px bg-line my-3" />
          <Field label="Recipients" hint="Comma-separated list of email addresses.">
            <div className="flex gap-2 flex-wrap">
              <Input
                type="text"
                value={emailList}
                onChange={(e) => setEmailList(e.target.value)}
                placeholder="you@example.com, team@example.com"
                className="flex-1 min-w-0"
              />
              {emailIntegration && (
                <Button onClick={() => testIntegration('email')} disabled={testing === 'email'}>
                  {testing === 'email' ? 'Testing…' : 'Test'}
                </Button>
              )}
              <Button
                variant="ink"
                onClick={() => saveIntegration('email', { emails: emailList })}
                disabled={saving === 'email' || !emailList}
              >
                {saving === 'email' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Field>
        </Card>
      </div>
    </div>
  );
}

/* ───── helpers ───── */

function IntegHead({ icon, iconBg, title, subtitle, configured, dark, toggle }) {
  return (
    <div className="flex items-center gap-[14px]">
      <span
        className={`w-[48px] h-[48px] rounded-r-sm grid place-items-center shrink-0 ${iconBg}`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <h3 className={`font-semibold text-[15px] ${dark ? 'text-surface' : 'text-ink'}`}>
          {title}
        </h3>
        <p className={`text-[12px] mt-0.5 ${dark ? 'text-white/60' : 'text-muted'}`}>{subtitle}</p>
      </div>
      {configured && (
        <Pill variant={dark ? 'lime' : 'good'} dot>
          Configured
        </Pill>
      )}
      {toggle && <SwitchButton on={toggle.on} onClick={toggle.onClick} />}
    </div>
  );
}

function SwitchButton({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-[44px] h-[24px] rounded-full border transition-colors ${
        on ? 'bg-lime border-lime-deep' : 'bg-paper-2 border-line'
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-[2px] w-[18px] h-[18px] rounded-full shadow-1 transition-all ${
          on ? 'left-[22px] bg-ink' : 'left-[2px] bg-surface'
        }`}
      />
    </button>
  );
}

/* Icons (inline SVG — no extra deps) */
function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M12 10v3.9h6.8c-.3 1.7-2 5-6.8 5-4.1 0-7.5-3.4-7.5-7.5S7.9 3.9 12 3.9c2.4 0 4 1 4.9 1.9l3.3-3.2C18.2 .8 15.4 0 12 0 5.4 0 0 5.4 0 12s5.4 12 12 12c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-2.2H12z" />
    </svg>
  );
}
function AIIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 10c1-1.3 2.5-2 4-2s3 .7 4 2M8 14c1 1.3 2.5 2 4 2s3-.7 4-2" />
    </svg>
  );
}
function EmailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}
