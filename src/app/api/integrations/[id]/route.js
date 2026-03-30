import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateIntegration, deleteIntegration } from '@/lib/db';

// PATCH /api/integrations/[id]
// Body: { config?, enabled? }
export async function PATCH(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    const integrationId = parseInt(id, 10);

    if (isNaN(integrationId)) {
      return NextResponse.json({ error: 'Invalid integration ID' }, { status: 400 });
    }

    const body = await request.json();
    const integration = await updateIntegration(cookieStore, integrationId, body);
    return NextResponse.json({ integration });
  } catch (error) {
    if (error.message === 'No valid fields to update') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PATCH /api/integrations/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}

// DELETE /api/integrations/[id]
export async function DELETE(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    const integrationId = parseInt(id, 10);

    if (isNaN(integrationId)) {
      return NextResponse.json({ error: 'Invalid integration ID' }, { status: 400 });
    }

    await deleteIntegration(cookieStore, integrationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/integrations/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 });
  }
}
