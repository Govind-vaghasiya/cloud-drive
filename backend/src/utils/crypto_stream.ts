import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function encryptFileInPlace(
  filePath: string,
  destPath: string,
  fileKey: Buffer
): Promise<void> {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
    
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(destPath);
    
    // Write IV and placeholder for Auth Tag
    const placeholderAuthTag = Buffer.alloc(16, 0);
    writeStream.write(iv);
    writeStream.write(placeholderAuthTag);
    
    readStream.pipe(cipher).pipe(writeStream, { end: false });
    
    cipher.on('end', () => {
      const authTag = cipher.getAuthTag();
      writeStream.end(() => {
        // Now open the file again and write the real auth tag at offset 12
        fs.open(destPath, 'r+', (err, fd) => {
          if (err) return reject(err);
          fs.write(fd, authTag, 0, 16, 12, (err) => {
            if (err) return reject(err);
            fs.close(fd, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
        });
      });
    });
    
    cipher.on('error', reject);
    readStream.on('error', reject);
    writeStream.on('error', reject);
  });
}
