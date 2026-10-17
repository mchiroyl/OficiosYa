import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UsuarioRow } from '../common/usuario.util';
import { ImageCompressService } from '../portfolio/image-compress.service';
import { StorageService } from '../portfolio/storage.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatHub } from './chat.hub';
import { ChatConversation, ChatMessage } from './chat.types';
import { ListMessagesDto, PollMessagesDto } from './dto/list-messages.dto';

type SolicitudRow = {
  id_solicitud: number;
  id_cliente: number;
  id_trabajador: number;
  descripcion: string;
  estado: string;
};

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal?: string;
};

type MensajeRow = {
  id_mensaje: number;
  id_solicitud: number;
  id_emisor: number;
  contenido: string;
  adjunto_url: string | null;
  fecha_envio: string;
};

type UploadFile = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly hub: ChatHub,
    private readonly images: ImageCompressService,
    private readonly storage: StorageService,
  ) {}

  async listConversations(usuario: UsuarioRow): Promise<ChatConversation[]> {
    const solicitudes = await this.listSolicitudesDe(usuario);
    if (!solicitudes.length) return [];

    const ids = solicitudes.map((row) => row.id_solicitud);
    const [usuarios, perfiles, mensajes] = await Promise.all([
      this.loadUsuarios(solicitudes.flatMap((row) => [row.id_cliente])),
      this.loadPerfiles(solicitudes.map((row) => row.id_trabajador)),
      this.loadRecentMessages(ids),
    ]);

    const workerUserIds = perfiles.map((perfil) => perfil.id_usuario);
    const workerUsers = await this.loadUsuarios(workerUserIds);
    for (const [id, user] of workerUsers) {
      usuarios.set(id, user);
    }

    const lastByThread = new Map<number, ChatMessage>();
    for (const mensaje of mensajes) {
      if (!lastByThread.has(mensaje.id_solicitud)) {
        lastByThread.set(mensaje.id_solicitud, this.present(mensaje, usuario.id_usuario, usuarios));
      }
    }

    return solicitudes
      .map((solicitud) => {
        const perfil = perfiles.find((item) => item.id_perfil === solicitud.id_trabajador);
        const soyCliente = solicitud.id_cliente === usuario.id_usuario;
        const contraparteId = soyCliente ? perfil?.id_usuario : solicitud.id_cliente;
        const contraparte = contraparteId ? usuarios.get(contraparteId) : null;

        return {
          id_solicitud: solicitud.id_solicitud,
          estado: solicitud.estado,
          descripcion: solicitud.descripcion,
          rol: soyCliente ? ('cliente' as const) : ('trabajador' as const),
          contraparte: {
            id_usuario: contraparte?.id_usuario || contraparteId || 0,
            nombre: contraparte?.nombre || 'Usuario',
          },
          ultimo_mensaje: lastByThread.get(solicitud.id_solicitud) || null,
        };
      })
      .sort((a, b) => {
        const ta = a.ultimo_mensaje?.fecha_envio || '';
        const tb = b.ultimo_mensaje?.fecha_envio || '';
        return tb.localeCompare(ta);
      });
  }

  async listMessages(usuario: UsuarioRow, idSolicitud: number, query: ListMessagesDto) {
    await this.requireParticipant(usuario, idSolicitud);
    const limit = query.limit || 50;
    const rows = await this.fetchMessages(idSolicitud, query.after || 0, limit);
    const usuarios = await this.loadUsuarios(rows.map((row) => row.id_emisor));
    return rows.map((row) => this.present(row, usuario.id_usuario, usuarios));
  }

  async pollMessages(usuario: UsuarioRow, idSolicitud: number, query: PollMessagesDto) {
    const after = query.after || 0;
    const existing = await this.listMessages(usuario, idSolicitud, {
      after,
      limit: query.limit || 50,
    });
    if (existing.length) {
      return { messages: existing, transport: 'poll' as const, waited: false };
    }

    const timeoutMs = Math.min(Math.max(query.timeout || 25, 1), 30) * 1000;
    const incoming = await this.hub.waitFor(idSolicitud, after, timeoutMs);
    const messages = incoming.map((message) => ({
      ...message,
      mio: message.id_emisor === usuario.id_usuario,
    }));
    return { messages, transport: 'poll' as const, waited: true };
  }

  async sendText(usuario: UsuarioRow, idSolicitud: number, contenido: string) {
    await this.requireParticipant(usuario, idSolicitud);
    const saved = await this.insertMensaje({
      id_solicitud: idSolicitud,
      id_emisor: usuario.id_usuario,
      contenido: contenido.trim(),
      adjunto_url: null,
    });
    return this.publish(saved, usuario);
  }

  async sendImage(
    usuario: UsuarioRow,
    idSolicitud: number,
    file: UploadFile | undefined,
    caption?: string,
  ) {
    await this.requireParticipant(usuario, idSolicitud);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debes adjuntar una imagen en el campo file.');
    }

    const compressed = await this.images.compress(file.buffer, file.mimetype);
    const stem = `chat/${idSolicitud}/${usuario.id_usuario}/${Date.now()}-${randomBytes(4).toString('hex')}`;
    const imagenUrl = await this.storage.uploadPublic(
      `${stem}-full.webp`,
      compressed.full,
      'image/webp',
    );
    await this.storage.uploadPublic(`${stem}-thumb.webp`, compressed.thumb, 'image/webp');

    const saved = await this.insertMensaje({
      id_solicitud: idSolicitud,
      id_emisor: usuario.id_usuario,
      contenido: (caption || '').trim() || '[imagen]',
      adjunto_url: imagenUrl.slice(0, 500),
    });
    return this.publish(saved, usuario);
  }

  async requireParticipant(usuario: UsuarioRow, idSolicitud: number) {
    const solicitud = await this.findSolicitud(idSolicitud);
    if (!solicitud) {
      throw new NotFoundException('La solicitud no existe.');
    }

    if (solicitud.id_cliente === usuario.id_usuario) {
      return { solicitud, rol: 'cliente' as const };
    }

    const perfil = await this.findPerfilById(solicitud.id_trabajador);
    if (perfil?.id_usuario === usuario.id_usuario) {
      return { solicitud, rol: 'trabajador' as const };
    }

    throw new ForbiddenException('No puedes ver el chat de esta solicitud.');
  }

  private async publish(row: MensajeRow, autor: UsuarioRow) {
    const usuarios = new Map<number, UsuarioRow>([[autor.id_usuario, autor]]);
    const message = this.present(row, autor.id_usuario, usuarios);
    this.hub.publish(row.id_solicitud, { ...message, mio: false });
    await this.registrarBitacora(autor.id_usuario, 'SEND_CHAT_MESSAGE', 'mensaje');
    return message;
  }

  private present(
    row: MensajeRow,
    viewerId: number,
    usuarios: Map<number, UsuarioRow>,
  ): ChatMessage {
    const adjunto = row.adjunto_url || null;
    return {
      id_mensaje: row.id_mensaje,
      id_solicitud: row.id_solicitud,
      id_emisor: row.id_emisor,
      emisor_nombre: usuarios.get(row.id_emisor)?.nombre || 'Usuario',
      contenido: row.contenido,
      adjunto_url: adjunto,
      adjunto_thumb_url: this.storage.thumbUrlFromFull(adjunto),
      tipo: adjunto ? 'imagen' : 'texto',
      fecha_envio: row.fecha_envio,
      mio: row.id_emisor === viewerId,
    };
  }

  private async fetchMessages(idSolicitud: number, after: number, limit: number) {
    let query = this.supabase
      .from('mensaje')
      .select('*')
      .eq('id_solicitud', idSolicitud)
      .order('id_mensaje', { ascending: true })
      .limit(limit);

    if (after > 0) {
      query = query.gt('id_mensaje', after);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data || []) as MensajeRow[];
  }

  private async loadRecentMessages(ids: number[]) {
    const { data, error } = await this.supabase
      .from('mensaje')
      .select('*')
      .in('id_solicitud', ids)
      .order('id_mensaje', { ascending: false })
      .limit(200);
    if (error) throw new BadRequestException(error.message);
    return (data || []) as MensajeRow[];
  }

  private async listSolicitudesDe(usuario: UsuarioRow) {
    const { data: asClient, error: clientError } = await this.supabase
      .from('solicitud_servicio')
      .select('id_solicitud, id_cliente, id_trabajador, descripcion, estado')
      .eq('id_cliente', usuario.id_usuario);
    if (clientError) throw new BadRequestException(clientError.message);

    const { data: perfiles, error: perfilError } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil')
      .eq('id_usuario', usuario.id_usuario);
    if (perfilError) throw new BadRequestException(perfilError.message);

    const perfilIds = ((perfiles || []) as { id_perfil: number }[]).map((row) => row.id_perfil);
    let asWorker: SolicitudRow[] = [];
    if (perfilIds.length) {
      const { data, error } = await this.supabase
        .from('solicitud_servicio')
        .select('id_solicitud, id_cliente, id_trabajador, descripcion, estado')
        .in('id_trabajador', perfilIds);
      if (error) throw new BadRequestException(error.message);
      asWorker = (data || []) as SolicitudRow[];
    }

    const map = new Map<number, SolicitudRow>();
    for (const row of [...((asClient || []) as SolicitudRow[]), ...asWorker]) {
      map.set(row.id_solicitud, row);
    }
    return [...map.values()];
  }

  private async findSolicitud(idSolicitud: number) {
    const { data, error } = await this.supabase
      .from('solicitud_servicio')
      .select('id_solicitud, id_cliente, id_trabajador, descripcion, estado')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as SolicitudRow) || null;
  }

  private async findPerfilById(idPerfil: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal')
      .eq('id_perfil', idPerfil)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as PerfilRow) || null;
  }

  private async loadPerfiles(ids: number[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [] as PerfilRow[];
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal')
      .in('id_perfil', unique);
    if (error) throw new BadRequestException(error.message);
    return (data || []) as PerfilRow[];
  }

  private async loadUsuarios(ids: number[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<number, UsuarioRow>();
    if (!unique.length) return map;
    const { data, error } = await this.supabase
      .from('usuario')
      .select('id_usuario, nombre, correo, telefono, modo_activo, estado')
      .in('id_usuario', unique);
    if (error) throw new BadRequestException(error.message);
    for (const row of (data || []) as UsuarioRow[]) {
      map.set(row.id_usuario, row);
    }
    return map;
  }

  private async insertMensaje(payload: {
    id_solicitud: number;
    id_emisor: number;
    contenido: string;
    adjunto_url: string | null;
  }) {
    const row = {
      ...payload,
      fecha_envio: new Date().toISOString(),
    };

    const { data, error } = await this.supabase.from('mensaje').insert(row).select('*').single();
    if (!error && data) return data as MensajeRow;

    if (/null value in column ["']?id_mensaje["']?/i.test(error?.message || '')) {
      const nextId = await this.nextId();
      const { data: retry, error: retryError } = await this.supabase
        .from('mensaje')
        .insert({ ...row, id_mensaje: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo guardar el mensaje.');
      }
      return retry as MensajeRow;
    }

    throw new BadRequestException(error?.message || 'No se pudo guardar el mensaje.');
  }

  private async nextId() {
    const { data } = await this.supabase
      .from('mensaje')
      .select('id_mensaje')
      .order('id_mensaje', { ascending: false })
      .limit(1);
    return (Number((data?.[0] as { id_mensaje?: number } | undefined)?.id_mensaje) || 0) + 1;
  }

  private async registrarBitacora(idActor: number, accion: string, recurso: string) {
    const payload = { id_actor: idActor, accion, recurso, origen: 'api/chat' };
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
