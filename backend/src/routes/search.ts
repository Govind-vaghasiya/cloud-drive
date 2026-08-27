import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function extractSnippet(text: string | null, query: string): string | null {
  if (!text || !query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  let snippet = text.substring(start, end).replace(/[\r\n\t]+/g, ' ');
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return snippet;
}

// =============================================================================
// Full-Text Filename & Document Content Search
// =============================================================================
router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = (req.query.q as string || '').trim();
    const category = (req.query.category as string || 'all').toLowerCase();

    if (!query) {
      res.json({ results: [], totalCount: 0, query: '' });
      return;
    }

    const searchPattern = `%${query}%`;

    // 1. Search matching files (by name OR by indexed content text)
    const filesRes = await pool.query(
      `SELECT f.id, f.folder_id, f.original_name as name, f.mime_type, f.size, f.thumbnail_path, f.content_text, f.created_at, f.updated_at,
              p.name as folder_name
       FROM "files" f
       LEFT JOIN "folders" p ON f.folder_id = p.id
       WHERE f.owner_id = $1 AND f.deleted_at IS NULL AND (f.original_name ILIKE $2 OR f.content_text ILIKE $2)
       ORDER BY f.updated_at DESC
       LIMIT 100`,
      [userId, searchPattern]
    );

    // 2. Search matching folders
    const foldersRes = await pool.query(
      `SELECT fol.id, fol.parent_id, fol.name, fol.created_at, fol.updated_at,
              p.name as parent_folder_name
       FROM "folders" fol
       LEFT JOIN "folders" p ON fol.parent_id = p.id
       WHERE fol.owner_id = $1 AND fol.deleted_at IS NULL AND fol.name ILIKE $2
       ORDER BY fol.updated_at DESC
       LIMIT 50`,
      [userId, searchPattern]
    );

    const files = filesRes.rows.map((f) => {
      const mime = (f.mime_type || '').toLowerCase();
      const ext = (f.name.split('.').pop() || '').toLowerCase();

      let fileCategory = 'other';
      if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext)) {
        fileCategory = 'images';
      } else if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
        fileCategory = 'videos';
      } else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
        fileCategory = 'audio';
      } else if (mime.includes('pdf') || mime.includes('word') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation') || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) {
        fileCategory = 'documents';
      } else if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed') || ['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
        fileCategory = 'archives';
      } else if (mime.startsWith('text/') || ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'sh', 'md'].includes(ext)) {
        fileCategory = 'code';
      }

      const snippet = extractSnippet(f.content_text, query);

      return {
        id: f.id,
        type: 'file' as const,
        name: f.name,
        mimeType: f.mime_type,
        size: Number(f.size),
        sizeFormatted: formatBytes(Number(f.size)),
        thumbnailPath: f.thumbnail_path,
        folderId: f.folder_id,
        folderName: f.folder_name || 'My Drive',
        category: fileCategory,
        snippet,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      };
    });

    const folders = foldersRes.rows.map((fol) => ({
      id: fol.id,
      type: 'folder' as const,
      name: fol.name,
      parentId: fol.parent_id,
      folderName: fol.parent_folder_name || 'My Drive',
      category: 'folders',
      createdAt: fol.created_at,
      updatedAt: fol.updated_at,
    }));

    // Apply category filter if specified
    let allResults = [...folders, ...files];
    if (category && category !== 'all') {
      allResults = allResults.filter((item) => item.category === category);
    }

    res.json({
      query,
      results: allResults,
      totalCount: allResults.length,
      categoriesCount: {
        all: folders.length + files.length,
        folders: folders.length,
        documents: files.filter((f) => f.category === 'documents').length,
        images: files.filter((f) => f.category === 'images').length,
        videos: files.filter((f) => f.category === 'videos').length,
        audio: files.filter((f) => f.category === 'audio').length,
        archives: files.filter((f) => f.category === 'archives').length,
        code: files.filter((f) => f.category === 'code').length,
        other: files.filter((f) => f.category === 'other').length,
      },
    });
  } catch (error: any) {
    console.error('[Search] Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
