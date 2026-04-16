import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserRole } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
import { sendSlackMessage } from '@/lib/slack';
import { sendReportEmail } from '@/lib/email';

// POST /api/integrations/test
// Body: { type, teamId }
// Sends a test message for the given integration
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const { type, teamId } = body;

    if (!type || !teamId) {
      return NextResponse.json({ error: 'type and teamId are required' }, { status: 400 });
    }

    const role = await getUserRole(cookieStore, teamId);
    if (!role || role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch the integration config
    const supabase = createServiceSupabase();
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', teamId)
      .eq('type', type)
      .eq('enabled', true)
      .maybeSingle();

    if (!integration) {
      return NextResponse.json({ error: `No ${type} integration configured` }, { status: 404 });
    }

    if (type === 'slack') {
      const webhookUrl = integration.config?.webhookUrl;
      if (!webhookUrl) {
        return NextResponse.json({ error: 'No webhook URL configured' }, { status: 400 });
      }
      await sendSlackMessage(webhookUrl, {
        text: 'Webpulse — Test message. Your Slack integration is working!',
      });
    } else if (type === 'email') {
      const emails = integration.config?.emails;
      if (!emails) {
        return NextResponse.json({ error: 'No email addresses configured' }, { status: 400 });
      }
      const recipients = emails.split(',').map((e) => e.trim());
      await sendReportEmail({
        to: recipients,
        subject: 'Webpulse — Test Email',
        html: '<div style="font-family: sans-serif; padding: 20px; background: #111827; color: #E5E7EB;"><h2 style="color: #F9FAFB;">Test Successful</h2><p>Your email integration is working correctly.</p><p style="color: #6B7280; font-size: 12px;">Sent by Webpulse</p></div>',
      });
    } else {
      return NextResponse.json({ error: `Unknown integration type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Integration test error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error.message },
      { status: 500 }
    );
  }
}
