import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UsuarioRow } from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { UploadPortfolioDto } from './dto/upload-portfolio.dto';
import { ImageCompressService } from './image-compress.service';
import { StorageService } from './storage.service';

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
};

type PortafolioRow = {
  id_elemento: number;
  id_perfil: number;
  titulo: string;
  descripcion: string | null;
  imagen_url: string | null;
  fecha_publicacion: string;
};

@Injectable()
export class PortfolioService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly images: ImageCompressService,
    private readonly storage: StorageService,
  ) {}

  async listMine(usuario: UsuarioRow) {
    const perfil = await this.requirePerfil(usuario.id_usuario);
    const { data, error } = await this.supabase
      .from('portafolio')
      .select('*')
      .eq('id_perfil', perfil.id_perfil)
      .order('fecha_publicacion', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return ((data || []) as PortafolioRow[]).map((row) => this.present(row));
  }

  async upload(
    usuario: UsuarioRow,
    file: { buffer: Buffer; mimetype?: string; originalname?: string } | undefined,
    dto: UploadPortfolioDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debes adjuntar una imagen en el campo file.');
    }

    const perfil = await this.requirePerfil(usuario.id_usuario);
    const compressed = await this.images.compress(file.buffer, file.mimetype);
    const stem = `${perfil.id_perfil}/${Date.now()}-${randomBytes(4).toString('hex')}`;
    const fullPath = `${stem}-full.webp`;
    const thumbPath = `${stem}-thumb.webp`;

    const imagenUrl = await this.storage.uploadPublic(fullPath, compressed.full, 'image/webp');
    const thumbUrl = await this.storage.uploadPublic(thumbPath, compressed.thumb, 'image/webp');

    const saved = await this.insertElemento({
      id_perfil: perfil.id_perfil,
      titulo: (dto.titulo || this.titleFromName(file.originalname)).slice(0, 150),
      descripcion: dto.descripcion?.trim() || null,
      imagen_url: imagenUrl.slice(0, 500),
      fecha_publicacion: new Date().toISOString(),
    });

    await this.registrarBitacora(usuario.id_usuario, 'UPLOAD_PORTFOLIO', 'portafolio');
    return this.present(saved, thumbUrl);
  }

  private present(row: PortafolioRow, thumbUrl?: string) {
    const imagenUrl = row.imagen_url;
    return {
      id_elemento: row.id_elemento,
      id_perfil: row.id_perfil,
      titulo: row.titulo,
      descripcion: row.descripcion,
      imagen_url: imagenUrl,
      imagen_thumb_url: thumbUrl || this.storage.thumbUrlFromFull(imagenUrl),
      fecha_publicacion: row.fecha_publicacion,
      loading: 'lazy',
    };
  }

  private async requirePerfil(idUsuario: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new NotFoundException('Primero crea tu perfil de trabajador para subir fotos.');
    }
    return data as PerfilRow;
  }

  private async insertElemento(payload: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('portafolio')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) return data as PortafolioRow;

    if (/null value in column ["']?id_elemento["']?/i.test(error?.message || '')) {
      const nextId = await this.nextId('portafolio', 'id_elemento');
      const { data: retry, error: retryError } = await this.supabase
        .from('portafolio')
        .insert({ ...payload, id_elemento: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo guardar el elemento.');
      }
      return retry as PortafolioRow;
    }

    throw new BadRequestException(error?.message || 'No se pudo guardar el elemento.');
  }

  private titleFromName(name?: string) {
    const base = (name || '').replace(/\.[^.]+$/, '').trim();
    return base || 'Trabajo realizado';
  }

  private async nextId(table: 'portafolio' | 'bitacora', pk: 'id_elemento' | 'id_evento') {
    const { data } = await this.supabase
      .from(table)
      .select(pk)
      .order(pk, { ascending: false })
      .limit(1);
    const row = (data?.[0] || {}) as Record<string, number>;
    return (Number(row[pk]) || 0) + 1;
  }

  private async registrarBitacora(idActor: number, accion: string, recurso: string) {
    const payload = {
      id_actor: idActor,
      accion,
      recurso,
      origen: 'api/portfolio',
    };
    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const nextId = await this.nextId('bitacora', 'id_evento');
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }
}
