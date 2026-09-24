import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuarioRow } from '../common/usuario.util';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/register')
  @ApiOperation({
    summary: 'Crear un usuario nuevo',
    description:
      'Registra la cuenta, guarda password_hash con bcrypt (costo 12) y devuelve un JWT de acceso y un refresh token.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('auth/login')
  @ApiOperation({
    summary: 'Iniciar sesión y obtener tokens',
    description:
      'Valida correo y contraseña con bcrypt, emite JWT (access + refresh) y rechaza cuentas no operables.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('auth/logout')
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    return this.authService.logout(token);
  }

  @Post('auth/refresh-token')
  @ApiOperation({ summary: 'Renovar el access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtener el usuario autenticado' })
  me(@CurrentUser() user: UsuarioRow) {
    return this.authService.me(user);
  }

  @Post('auth/forgot-password')
  @ApiOperation({ summary: 'Solicitar recuperación de acceso (HU-03)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('auth/reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña con token o código' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('auth/change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar contraseña estando autenticado' })
  changePassword(@CurrentUser() user: UsuarioRow, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }

  @Post('auth/verify-email')
  @ApiOperation({ summary: 'Verificar el correo electrónico' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('auth/resend-verification')
  @ApiOperation({ summary: 'Reenviar el correo de verificación' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Patch('auth/deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Desactivar la cuenta' })
  deactivate(@CurrentUser() user: UsuarioRow) {
    return this.authService.deactivate(user);
  }

  @Patch('auth/reactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reactivar la cuenta' })
  reactivate(@CurrentUser() user: UsuarioRow) {
    return this.authService.reactivate(user);
  }

  @Delete('auth/account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar la cuenta' })
  deleteAccount(@CurrentUser() user: UsuarioRow) {
    return this.authService.deleteAccount(user);
  }

  @Patch('admin/usuarios/:id/estado')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiTags('Admin')
  @ApiOperation({ summary: 'Cambiar el estado de un usuario' })
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDto,
  ) {
    return this.authService.updateEstado(id, dto.estado);
  }
}
