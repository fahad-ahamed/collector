import { NextRequest, NextResponse } from 'next/server';
import { findFileById, findSessionById, updateSession } from '@/lib/db';
import fs from 'fs';
import path from 'path';

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

    // Delete the physical file from server
    if (file.serverPath) {
      const fullPath = path.join(process.cwd(), file.serverPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Delete the file metadata JSON
    const FILES_DIR = path.join(process.cwd(), 'db', 'files');
    const metaPath = path.join(FILES_DIR, `${fileId}.json`);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
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
