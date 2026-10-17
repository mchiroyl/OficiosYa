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

  async uploadPrivate(bucket: string, path: string, buffer: Buffer, contentType: string) {
    await this.ensurePrivateBucket(bucket);
    const { error } = await this.supabase.admin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      throw new BadRequestException(error.message || 'No se pudo guardar el documento.');
    }
    return path;
  }

  async signedUrl(bucket: string, path: string | null | undefined, expiresIn = 600) {
    if (!path) return null;
    const { data, error } = await this.supabase.admin.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
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

  private readonly privateReady = new Set<string>();

  private async ensurePrivateBucket(bucket: string) {
    if (this.privateReady.has(bucket)) return;

    const { data, error } = await this.supabase.admin.storage.getBucket(bucket);
    if (data && !error) {
      this.privateReady.add(bucket);
      return;
    }

    const { error: createError } = await this.supabase.admin.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: '8MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });

    if (createError && !/already exists|duplicate/i.test(createError.message)) {
      this.logger.error(`No se pudo crear el bucket privado ${bucket}: ${createError.message}`);
      throw new BadRequestException(
        'El almacenamiento seguro de documentos no está disponible. Revisa el bucket de identidad en Supabase Storage.',
      );
    }

    this.privateReady.add(bucket);
  }
}
