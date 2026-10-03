import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { UsuarioRow } from '../common/usuario.util';
import { ImageCompressService } from '../portfolio/image-compress.service';
import { StorageService } from '../portfolio/storage.service';
import { SupabaseService } from '../supabase/supabase.service';
import { DpiMeta, parseProfileExtras, serializeProfileExtras } from '../worker/worker-profile.codec';
import { ReviewDpiDto } from './dto/review-dpi.dto';

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal: string;
  descripcion: string | null;
  verificado: boolean;
};

type UploadFile = { buffer: Buffer; mimetype?: string; originalname?: string };

@Injectable()
export class IdentityService {
  private readonly bucket: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
    private readonly images: ImageCompressService,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('SUPABASE_IDENTITY_BUCKET') || 'identidad';
  }

  async getMine(usuario: UsuarioRow) {
    const perfil = await this.requirePerfil(usuario.id_usuario);
    return this.present(perfil, true);
  }

  async submit(
    usuario: UsuarioRow,
    files: { frente?: UploadFile; reverso?: UploadFile },
    numeroDpi?: string,
  ) {
    const frente = files.frente;
    const reverso = files.reverso;
    if (!frente?.buffer?.length || !reverso?.buffer?.length) {
      throw new BadRequestException('Debes adjuntar el frente y el reverso del DPI.');
    }

    const perfil = await this.requirePerfil(usuario.id_usuario);
    const extras = parseProfileExtras(perfil.descripcion);
    const stamp = Date.now();
    const frentePath = `dpi/${usuario.id_usuario}/frente-${stamp}.webp`;
    const reversoPath = `dpi/${usuario.id_usuario}/reverso-${stamp}.webp`;

    const [frenteImg, reversoImg] = await Promise.all([
      this.images.compress(frente.buffer, frente.mimetype),
      this.images.compress(reverso.buffer, reverso.mimetype),
    ]);

    await this.storage.uploadPrivate(this.bucket, frentePath, frenteImg.full, 'image/webp');
    await this.storage.uploadPrivate(this.bucket, reversoPath, reversoImg.full, 'image/webp');

    const dpi: DpiMeta = {
      estado: 'pendiente',
      numero_enmascarado: numeroDpi ? this.mask(numeroDpi) : extras.dpi?.numero_enmascarado || null,
      numero_hash: numeroDpi ? this.hash(numeroDpi) : extras.dpi?.numero_hash || null,
      frente_path: frentePath,
      reverso_path: reversoPath,
      enviado_en: new Date().toISOString(),
      revisado_en: null,
      motivo_rechazo: null,
    };

    const saved = await this.saveExtras(perfil, extras, dpi, false);
    await this.registrarBitacora(usuario.id_usuario, 'SUBMIT_DPI', 'perfil_trabajador');
    return this.present(saved, true);
  }

  async listPending() {
    const perfiles = await this.listPerfiles();
    const pendientes = perfiles.filter((perfil) => parseProfileExtras(perfil.descripcion).dpi?.estado === 'pendiente');
    return Promise.all(pendientes.map((perfil) => this.present(perfil, true)));
  }

  async getForAdmin(idUsuario: number) {
    const perfil = await this.findPerfil(idUsuario);
    if (!perfil) throw new NotFoundException('Ese trabajador no tiene perfil.');
    return this.present(perfil, true);
  }

  async review(admin: UsuarioRow, idUsuario: number, dto: ReviewDpiDto) {
    const perfil = await this.findPerfil(idUsuario);
    if (!perfil) throw new NotFoundException('Ese trabajador no tiene perfil.');
    const extras = parseProfileExtras(perfil.descripcion);
    if (!extras.dpi) {
      throw new BadRequestException('Ese trabajador no ha enviado documentos de identidad.');
    }

    if (dto.decision === 'rechazar' && !dto.motivo?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo.');
    }

    const dpi: DpiMeta = {
      ...extras.dpi,
      estado: dto.decision === 'aprobar' ? 'aprobado' : 'rechazado',
      revisado_en: new Date().toISOString(),
      motivo_rechazo: dto.decision === 'rechazar' ? dto.motivo!.trim() : null,
    };

    const saved = await this.saveExtras(perfil, extras, dpi, dto.decision === 'aprobar');
    await this.registrarBitacora(
      admin.id_usuario,
      dto.decision === 'aprobar' ? 'APPROVE_DPI' : 'REJECT_DPI',
      'perfil_trabajador',
    );
    return this.present(saved, true);
  }

  private async present(perfil: PerfilRow, includeUrls: boolean) {
    const extras = parseProfileExtras(perfil.descripcion);
    const dpi = extras.dpi;
    const usuario = await this.findUsuario(perfil.id_usuario);
    const [frente_url, reverso_url] = includeUrls
      ? await Promise.all([
          this.storage.signedUrl(this.bucket, dpi?.frente_path),
          this.storage.signedUrl(this.bucket, dpi?.reverso_path),
        ])
      : [null, null];

    return {
      id_usuario: perfil.id_usuario,
      id_perfil: perfil.id_perfil,
      nombre: usuario?.nombre || 'Usuario',
      oficio_principal: perfil.oficio_principal,
      verificado: perfil.verificado,
      dpi: dpi
        ? {
            estado: dpi.estado,
            numero_enmascarado: dpi.numero_enmascarado,
            enviado_en: dpi.enviado_en,
            revisado_en: dpi.revisado_en,
            motivo_rechazo: dpi.motivo_rechazo,
            frente_url,
            reverso_url,
            vence_url_segundos: includeUrls ? 600 : 0,
          }
        : null,
    };
  }

  private async saveExtras(
    perfil: PerfilRow,
    extras: ReturnType<typeof parseProfileExtras>,
    dpi: DpiMeta,
    verificado: boolean,
  ) {
    const descripcion = serializeProfileExtras({
      bio: extras.bio,
      tarifas: extras.tarifas,
      horarios: extras.horarios,
      reputacion: extras.reputacion,
      total_resenas: extras.total_resenas,
      dpi,
    });
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .update({ descripcion, verificado })
      .eq('id_perfil', perfil.id_perfil)
      .select('id_perfil, id_usuario, oficio_principal, descripcion, verificado')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message || 'No se pudo guardar la verificación.');
    }
    return data as PerfilRow;
  }

  private async requirePerfil(idUsuario: number) {
    const perfil = await this.findPerfil(idUsuario);
    if (!perfil) {
      throw new BadRequestException('Primero crea tu perfil de trabajador para enviar el DPI.');
    }
    return perfil;
  }

  private async findPerfil(idUsuario: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal, descripcion, verificado')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as PerfilRow) || null;
  }

  private async listPerfiles() {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal, descripcion, verificado');
    if (error) throw new BadRequestException(error.message);
    return (data || []) as PerfilRow[];
  }

  private async findUsuario(idUsuario: number) {
    const { data } = await this.supabase
      .from('usuario')
      .select('id_usuario, nombre')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    return data as { id_usuario: number; nombre: string } | null;
  }

  private mask(numero: string) {
    return `*********${numero.slice(-4)}`;
  }

  private hash(numero: string) {
    return createHash('sha256').update(numero).digest('hex');
  }

  private async registrarBitacora(idActor: number, accion: string, recurso: string) {
    const payload = { id_actor: idActor, accion, recurso, origen: 'api/identity' };
    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const { data } = await this.supabase
        .from('bitacora')
        .select('id_evento')
        .order('id_evento', { ascending: false })
        .limit(1);
      const nextId = (Number((data?.[0] as { id_evento?: number } | undefined)?.id_evento) || 0) + 1;
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }
}
