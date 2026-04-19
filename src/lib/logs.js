import { createServiceSupabase } from './supabase';

// Fire-and-forget log writer. Never throws; logs its own failures to the
// server console so instrumentation can't break the main pipeline.
//
// type:  'schedule' | 'scan' | 'notification' | 'ai' | 'system'
// level: 'info' | 'warn' | 'error'
export async function logEvent({ teamId = null, type, level = 'info', message, metadata = {} }) {
  try {
    const supabase = createServiceSupabase();
    await supabase.from('event_logs').insert({
      team_id: teamId,
      type,
      level,
      message,
      metadata,
    });
  } catch (err) {
    console.error('[logEvent] failed:', err?.message || err);
  }
}
