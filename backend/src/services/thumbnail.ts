import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { pool } from '../db.js';
import { unwrapKey, decryptFileFromDisk } from '../utils/crypto.js';

// Setup ffmpeg path from installer if not already set in environment
if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

const storageBaseDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'data', 'storage');
const filesDir = path.join(storageBaseDir, 'files');
const tempDir = path.join(storageBaseDir, 'temp');
const thumbnailsDir = path.join(storageBaseDir, 'thumbnails');

// Ensure directories exist
fs.mkdirSync(thumbnailsDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

export function isImageFile(mimeType: string, filename: string): boolean {
  if (mimeType && mimeType.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|svg|avif|tiff|bmp)$/i.test(filename);
}

export function isVideoFile(mimeType: string, filename: string): boolean {
  if (mimeType && mimeType.startsWith('video/')) return true;
  return /\.(mp4|webm|mkv|mov|avi|wmv|flv|m4v)$/i.test(filename);
}

/**
 * Generates a WebP thumbnail (300x300) for a given file ID.
 * Decrypts the file on-the-fly, processes it via Sharp or FFMPEG, and stores thumbnail in storage/thumbnails.
 */
export async function generateThumbnail(fileId: string): Promise<string | null> {
  try {
    const fileRes = await pool.query(
      'SELECT id, original_name, mime_type, uuid_storage_name, encryption_key_wrapped FROM "files" WHERE id = $1',
      [fileId]
    );

    if (fileRes.rowCount === 0) {
      console.warn(`[Thumbnail Service] File ${fileId} not found in database.`);
      return null;
    }

    const file = fileRes.rows[0];
    const mimeType = file.mime_type || '';
    const originalName = file.original_name || '';

    const isImage = isImageFile(mimeType, originalName);
    const isVideo = isVideoFile(mimeType, originalName);

    if (!isImage && !isVideo) {
      // Not a supported media type for thumbnail generation
      return null;
    }

    const encryptedFilePath = path.join(filesDir, file.uuid_storage_name);
    if (!fs.existsSync(encryptedFilePath)) {
      console.warn(`[Thumbnail Service] Encrypted file not found on disk: ${encryptedFilePath}`);
      return null;
    }

    // 1. Unwrap key and decrypt content
    const fileKey = unwrapKey(file.encryption_key_wrapped);
    const decryptedBuffer = await decryptFileFromDisk(encryptedFilePath, fileKey);

    const thumbnailFilename = `${fileId}.webp`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);

    if (isImage) {
      // 2. Generate Image Thumbnail via Sharp
      await sharp(decryptedBuffer)
        .resize(300, 300, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: false,
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    } else if (isVideo) {
      // 3. Generate Video Thumbnail via FFMPEG frame extraction + Sharp resize
      const tempVideoPath = path.join(tempDir, `temp_vid_${fileId}_${Date.now()}.mp4`);
      const tempFramePath = path.join(tempDir, `temp_frame_${fileId}_${Date.now()}.png`);

      try {
        await fs.promises.writeFile(tempVideoPath, decryptedBuffer);

        // Extract frame at 1 second mark (or beginning if video is shorter)
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempVideoPath)
            .screenshots({
              timestamps: ['00:00:01.000'],
              filename: path.basename(tempFramePath),
              folder: tempDir,
              size: '640x?',
            })
            .on('end', () => resolve())
            .on('error', (err) => {
              // Try at timestamp 0 if 1s fails
              ffmpeg(tempVideoPath)
                .screenshots({
                  timestamps: ['00:00:00.000'],
                  filename: path.basename(tempFramePath),
                  folder: tempDir,
                  size: '640x?',
                })
                .on('end', () => resolve())
                .on('error', (err2) => reject(err2));
            });
        });

        if (fs.existsSync(tempFramePath)) {
          const frameBuffer = await fs.promises.readFile(tempFramePath);
          await sharp(frameBuffer)
            .resize(300, 300, {
              fit: 'cover',
              position: 'center',
            })
            .webp({ quality: 80 })
            .toFile(thumbnailPath);
        } else {
          throw new Error('Video frame extraction did not create output file');
        }
      } finally {
        // Clean up temporary video and frame files
        await fs.promises.unlink(tempVideoPath).catch(() => {});
        await fs.promises.unlink(tempFramePath).catch(() => {});
      }
    }

    // 4. Update file row in PostgreSQL with thumbnail_path
    const relativeThumbnailPath = thumbnailFilename;
    await pool.query(
      'UPDATE "files" SET "thumbnail_path" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2',
      [relativeThumbnailPath, fileId]
    );

    console.log(`[Thumbnail Service] Successfully generated thumbnail for file ${fileId} (${originalName})`);
    return relativeThumbnailPath;
  } catch (error: any) {
    console.error(`[Thumbnail Service] Error generating thumbnail for file ${fileId}:`, error);
    return null;
  }
}
