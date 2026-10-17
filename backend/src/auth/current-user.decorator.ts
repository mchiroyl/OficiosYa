import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioRow => {
    return ctx.switchToHttp().getRequest().user;
  },
);
