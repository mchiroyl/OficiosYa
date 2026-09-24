import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Request } from 'express';
import { assertCuentaOperable } from '../common/usuario.util';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    const jwksUrl = config.getOrThrow<string>('SUPABASE_JWKS_URL');
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    this.issuer = `${config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '')}/auth/v1`;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.readBearer(request);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    let payload: { email?: string; sub?: string };
    try {
      const verified = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      payload = verified.payload as { email?: string; sub?: string };
    } catch {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    const email = payload.email;
    if (!email) {
      throw new UnauthorizedException('El token no contiene el correo del usuario.');
    }

    const usuario = await this.authService.findUsuarioByCorreo(email);
    if (!usuario) {
      throw new UnauthorizedException('El usuario no existe en el sistema.');
    }

    const isReactivate =
      request.method === 'PATCH' && request.url.includes('/auth/reactivate');
    if (!isReactivate) {
      const bloqueo = assertCuentaOperable(usuario);
      if (bloqueo) {
        throw new UnauthorizedException(bloqueo);
      }
    }

    request.user = usuario;
    return true;
  }

  private readBearer(request: Request) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim();
  }
}
