import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessTokenService } from '../auth/access-token.service';
import { UsuarioRow } from '../common/usuario.util';
import { ChatHub } from './chat.hub';
import { ChatService } from './chat.service';

type AuthedSocket = Socket & { data: { user?: UsuarioRow } };

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private unsubscribe?: () => void;

  constructor(
    private readonly tokens: AccessTokenService,
    private readonly chat: ChatService,
    private readonly hub: ChatHub,
  ) {}

  afterInit() {
    this.unsubscribe = this.hub.onPublish((idSolicitud, message) => {
      this.server?.to(`solicitud:${idSolicitud}`).emit('message', message);
    });
    this.logger.log('WebSocket /chat listo (Socket.IO, fallback polling HTTP).');
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        (typeof client.handshake.query?.token === 'string'
          ? client.handshake.query.token
          : undefined) ||
        this.tokens.readBearer(client.handshake.headers.authorization);
      const user = await this.tokens.resolve(token);
      client.data.user = user;
      client.emit('ready', { id_usuario: user.id_usuario, transport: client.conn.transport.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No autorizado.';
      client.emit('error', { message });
      client.disconnect();
    }
  }

  handleDisconnect() {
    // Las salas de Socket.IO se limpian solas.
  }

  @SubscribeMessage('join')
  async join(client: AuthedSocket, payload: { id_solicitud?: number }) {
    const user = this.requireUser(client);
    const idSolicitud = Number(payload?.id_solicitud);
    if (!Number.isFinite(idSolicitud) || idSolicitud < 1) {
      return { ok: false, message: 'id_solicitud inválido.' };
    }
    await this.chat.requireParticipant(user, idSolicitud);
    await client.join(`solicitud:${idSolicitud}`);
    return { ok: true, id_solicitud: idSolicitud };
  }

  @SubscribeMessage('leave')
  async leave(client: AuthedSocket, payload: { id_solicitud?: number }) {
    const idSolicitud = Number(payload?.id_solicitud);
    if (Number.isFinite(idSolicitud)) {
      await client.leave(`solicitud:${idSolicitud}`);
    }
    return { ok: true };
  }

  @SubscribeMessage('message')
  async message(client: AuthedSocket, payload: { id_solicitud?: number; contenido?: string }) {
    const user = this.requireUser(client);
    const idSolicitud = Number(payload?.id_solicitud);
    const contenido = (payload?.contenido || '').trim();
    if (!Number.isFinite(idSolicitud) || !contenido) {
      return { ok: false, message: 'Debes enviar id_solicitud y contenido.' };
    }
    const saved = await this.chat.sendText(user, idSolicitud, contenido);
    return { ok: true, message: saved };
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  private requireUser(client: AuthedSocket) {
    if (!client.data.user) {
      throw new Error('Debes iniciar sesión.');
    }
    return client.data.user;
  }
}
