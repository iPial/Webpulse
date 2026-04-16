'use client';

import { useState } from 'react';

export default function IntegrationsManager({ teamId, initialIntegrations }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [psiApiKey, setPsiApiKey] = useState(
    integrations.find((i) => i.type === 'pagespeed')?.config?.apiKey || ''
  );
  const aiIntegrationInit = integrations.find((i) => i.type === 'ai_provider') || integrations.find((i) => i.type === 'anthropic');
  const [aiProvider, setAiProvider] = useState(
    aiIntegrationInit?.config?.provider || 'anthropic'
  );
  const [aiApiKey, setAiApiKey] = useState(
    aiIntegrationInit?.config?.apiKey || ''
  );
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
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? integration : i))
      );
    }
  }

  const psiIntegration = integrations.find((i) => i.type === 'pagespeed');
  const aiIntegration = integrations.find((i) => i.type === 'ai_provider') || integrations.find((i) => i.type === 'anthropic');
  const slackIntegration = integrations.find((i) => i.type === 'slack');
  const emailIntegration = integrations.find((i) => i.type === 'email');

  const aiProviderOptions = [
    { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
    { value: 'openai', label: 'OpenAI (GPT)', placeholder: 'sk-...' },
    { value: 'gemini', label: 'Google (Gemini)', placeholder: 'AIza...' },
  ];
  const currentProviderOption = aiProviderOptions.find((o) => o.value === aiProvider) || aiProviderOptions[0];

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

      {/* Google PageSpeed API Key */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Google PageSpeed API</h3>
              <p className="text-xs text-gray-400">Required for scanning sites. Get a key from Google Cloud Console.</p>
            </div>
          </div>
          {psiIntegration && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
              Configured
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <input
            type="password"
            value={psiApiKey}
            onChange={(e) => setPsiApiKey(e.target.value)}
            placeholder="AIza..."
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => saveIntegration('pagespeed', { apiKey: psiApiKey })}
            disabled={saving === 'pagespeed' || !psiApiKey}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving === 'pagespeed' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* AI Provider */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Provider</h3>
              <p className="text-xs text-gray-400">API key for AI-powered recommendations. Choose your preferred provider.</p>
            </div>
          </div>
          {aiIntegration && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
              Configured
            </span>
          )}
        </div>
        <div className="space-y-3">
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {aiProviderOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={currentProviderOption.placeholder}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => saveIntegration('ai_provider', { provider: aiProvider, apiKey: aiApiKey })}
              disabled={saving === 'ai_provider' || !aiApiKey}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving === 'ai_provider' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Slack */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <span className="text-purple-400 text-sm font-bold">#</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Slack</h3>
              <p className="text-xs text-gray-400">Daily scan summaries and regression alerts</p>
            </div>
          </div>
          {slackIntegration && (
            <button
              onClick={() => toggleIntegration(slackIntegration.id, slackIntegration.enabled)}
              className={`text-xs px-2 py-0.5 rounded-full ${
                slackIntegration.enabled
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {slackIntegration.enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <input
            type="url"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => saveIntegration('slack', { webhookUrl: slackUrl })}
            disabled={saving === 'slack' || !slackUrl}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving === 'slack' ? 'Saving...' : 'Save'}
          </button>
          {slackIntegration && (
            <button
              onClick={() => testIntegration('slack')}
              disabled={testing === 'slack'}
              className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing === 'slack' ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-400 text-sm font-bold">@</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Email Reports</h3>
              <p className="text-xs text-gray-400">Receive scan reports via email</p>
            </div>
          </div>
          {emailIntegration && (
            <button
              onClick={() => toggleIntegration(emailIntegration.id, emailIntegration.enabled)}
              className={`text-xs px-2 py-0.5 rounded-full ${
                emailIntegration.enabled
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {emailIntegration.enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={emailList}
            onChange={(e) => setEmailList(e.target.value)}
            placeholder="you@example.com, team@example.com"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => saveIntegration('email', { emails: emailList })}
            disabled={saving === 'email' || !emailList}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving === 'email' ? 'Saving...' : 'Save'}
          </button>
          {emailIntegration && (
            <button
              onClick={() => testIntegration('email')}
              disabled={testing === 'email'}
              className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing === 'email' ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
