import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioRow } from '../common/usuario.util';
import { correoEsAdmin } from './admin-emails';
import { normalizeRol, ROL_ADMINISTRADOR } from './roles';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: UsuarioRow }>();
    const user = request.user;
    const porRol = normalizeRol(user?.rol) === ROL_ADMINISTRADOR;
    const porCorreo = correoEsAdmin(user?.correo, this.config.get<string>('ADMIN_EMAILS'));
    if (!user || (!porRol && !porCorreo)) {
      throw new ForbiddenException('Solo el administrador puede acceder.');
    }
    return true;
  }
}
