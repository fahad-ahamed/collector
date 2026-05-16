import { NextRequest, NextResponse } from 'next/server';
import { findFileById, findSessionById, updateSession, deleteFileById } from '@/lib/db';

// DELETE /api/files/delete - Delete a specific uploaded file
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, sessionId } = body;

    if (!fileId || !sessionId) {
      return NextResponse.json({ error: 'File ID and Session ID required' }, { status: 400 });
    }

    const file = await findFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Use the correct deleteFileById which uses proper UPLOAD_DIR
    const deleted = await deleteFileById(fileId);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    // Update session file count
    const session = await findSessionById(sessionId);
    if (session && session.fileCount > 0) {
      await updateSession(sessionId, { fileCount: session.fileCount - 1 });
    }

    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete file' }, { status: 500 });
  }
}
