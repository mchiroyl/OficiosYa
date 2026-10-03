import { Module } from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { MailSimulatorService } from './recovery/mail-simulator.service';
import { RecoveryTokenStore } from './recovery/recovery-token.store';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RecoveryTokenStore,
    MailSimulatorService,
  ],
  exports: [AuthService, AccessTokenService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
