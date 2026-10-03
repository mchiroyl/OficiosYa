import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenService } from './access-token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.tokens.readBearer(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    const isReactivate =
      request.method === 'PATCH' && request.url.includes('/auth/reactivate');
    request.user = await this.tokens.resolve(token, { allowInactive: isReactivate });
    return true;
  }
}
