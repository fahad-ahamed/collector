import { NextRequest, NextResponse } from 'next/server';
import { findSessionById, updateSessionStatus } from '@/lib/db';

// POST /api/contacts/sync - Trigger contact re-sync from device
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update status to syncing_contacts to trigger re-sync on device
    await updateSessionStatus(sessionId, 'syncing_contacts', 'Manual sync triggered from web');

    return NextResponse.json({
      success: true,
      message: 'Contact sync triggered. The device will re-upload contacts on next heartbeat.',
      status: 'syncing_contacts',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to trigger sync' }, { status: 500 });
  }
}
