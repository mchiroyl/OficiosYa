import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { assertCuentaOperable, UsuarioRow } from '../common/usuario.util';
import { AuthService } from './auth.service';

@Injectable()
export class AccessTokenService {
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

  async resolve(token?: string | null, options?: { allowInactive?: boolean }): Promise<UsuarioRow> {
    const raw = (token || '').trim();
    if (!raw) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    let email: string | undefined;
    try {
      const verified = await jwtVerify(raw, this.jwks, { issuer: this.issuer });
      email = (verified.payload as { email?: string }).email;
    } catch {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    if (!email) {
      throw new UnauthorizedException('El token no contiene el correo del usuario.');
    }

    const usuario = await this.authService.findUsuarioByCorreo(email);
    if (!usuario) {
      throw new UnauthorizedException('El usuario no existe en el sistema.');
    }

    if (!options?.allowInactive) {
      const bloqueo = assertCuentaOperable(usuario);
      if (bloqueo) {
        throw new UnauthorizedException(bloqueo);
      }
    }

    return usuario;
  }

  readBearer(authorization?: string | string[] | null) {
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim();
  }
}
