import { NextRequest, NextResponse } from 'next/server';
import { findSessionById, findFilesBySessionId } from '@/lib/db';

// GET /api/files/browse?sessionId=xxx&path=/ - Browse files by directory path
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const browsePath = searchParams.get('path') || '/';

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const uploadedFiles = await findFilesBySessionId(sessionId);

    // Build directory tree from file paths
    // Each file has a filePath like "/storage/emulated/0/DCIM/photo.jpg"
    const directories: Record<string, { name: string; path: string; fileCount: number; totalSize: number }> = {};
    const filesInDir: any[] = [];

    for (const file of uploadedFiles) {
      const filePath = file.filePath || file.fileName;

      // Normalize the path
      const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
      const dirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) || '/';

      // Check if this file belongs to the current browse path (or is a subdirectory)
      if (browsePath === '/' || normalizedPath.startsWith(browsePath + '/') || dirPath === browsePath) {
        // If file is directly in the browse path
        if (dirPath === browsePath) {
          filesInDir.push({
            id: file.id,
            fileName: file.fileName,
            filePath: file.filePath,
            fileSize: file.fileSize,
            fileType: file.fileType,
            serverPath: file.serverPath,
            uploadedAt: file.uploadedAt,
            downloadUrl: `/api/files/file/${file.id}`,
          });
        }

        // Find subdirectories at this level
        const relativePath = normalizedPath.startsWith(browsePath === '/' ? '/' : browsePath + '/')
          ? normalizedPath.slice(browsePath === '/' ? 1 : browsePath.length + 1)
          : null;

        if (relativePath) {
          const parts = relativePath.split('/').filter(Boolean);
          if (parts.length > 1 || (parts.length === 1 && normalizedPath.includes('/', normalizedPath.lastIndexOf(parts[0]) + 1))) {
            // There's a subdirectory at the first level
            const subDirName = parts[0];
            const subDirPath = browsePath === '/' ? '/' + subDirName : browsePath + '/' + subDirName;

            if (!directories[subDirPath]) {
              directories[subDirPath] = {
                name: subDirName,
                path: subDirPath,
                fileCount: 0,
                totalSize: 0,
              };
            }
            directories[subDirPath].fileCount++;
            directories[subDirPath].totalSize += file.fileSize;
          }
        }
      }
    }

    // Build breadcrumbs from the browse path
    const breadcrumbs: { name: string; path: string }[] = [{ name: 'Root', path: '/' }];
    if (browsePath !== '/') {
      const parts = browsePath.split('/').filter(Boolean);
      let currentPath = '';
      for (const part of parts) {
        currentPath += '/' + part;
        breadcrumbs.push({ name: part, path: currentPath });
      }
    }

    return NextResponse.json({
      currentPath: browsePath,
      breadcrumbs,
      directories: Object.values(directories).sort((a, b) => a.name.localeCompare(b.name)),
      files: filesInDir.sort((a, b) => a.fileName.localeCompare(b.fileName)),
      totalFiles: uploadedFiles.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to browse files' }, { status: 500 });
  }
}
