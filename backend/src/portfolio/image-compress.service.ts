import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class ImageCompressService {
  async compress(buffer: Buffer, mimeType?: string) {
    if (mimeType && !TIPOS_PERMITIDOS.has(mimeType)) {
      throw new BadRequestException('Solo se permiten imágenes JPG, PNG, WebP o GIF.');
    }

    try {
      const image = sharp(buffer, { failOn: 'none' }).rotate();
      const metadata = await image.metadata();

      const full = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const thumb = await sharp(buffer)
        .rotate()
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();

      return {
        full,
        thumb,
        width: metadata.width || null,
        height: metadata.height || null,
      };
    } catch {
      throw new BadRequestException('No se pudo procesar la imagen. Prueba con otro archivo.');
    }
  }
}
