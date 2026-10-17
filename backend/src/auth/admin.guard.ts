import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioRow } from '../common/usuario.util';
import { correoEsAdmin } from './admin-emails';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: UsuarioRow }>();
    const user = request.user;
    if (!user || !correoEsAdmin(user.correo, this.config.get<string>('ADMIN_EMAILS'))) {
      throw new ForbiddenException('Solo el equipo de moderación puede acceder.');
    }
    return true;
  }
}
