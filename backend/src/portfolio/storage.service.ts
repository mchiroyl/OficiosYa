import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private bucketReady = false;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('SUPABASE_STORAGE_BUCKET') || 'portafolio';
  }

  async uploadPublic(path: string, buffer: Buffer, contentType: string) {
    await this.ensureBucket();

    const { error } = await this.supabase.admin.storage.from(this.bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      throw new BadRequestException(error.message || 'No se pudo subir el archivo.');
    }

    return this.publicUrl(path);
  }

  publicUrl(path: string) {
    const { data } = this.supabase.admin.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  thumbUrlFromFull(url: string | null | undefined) {
    if (!url) return null;
    return url.includes('-full.webp') ? url.replace('-full.webp', '-thumb.webp') : url;
  }

  private async ensureBucket() {
    if (this.bucketReady) return;

    const { data, error } = await this.supabase.admin.storage.getBucket(this.bucket);
    if (data && !error) {
      this.bucketReady = true;
      return;
    }

    const { error: createError } = await this.supabase.admin.storage.createBucket(this.bucket, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });

    if (createError && !/already exists|duplicate/i.test(createError.message)) {
      this.logger.error(`No se pudo crear el bucket ${this.bucket}: ${createError.message}`);
      throw new BadRequestException(
        'El almacenamiento de imágenes no está disponible. Revisa el bucket de Supabase Storage.',
      );
    }

    this.bucketReady = true;
  }
}
