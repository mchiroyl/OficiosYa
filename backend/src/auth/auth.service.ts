import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import {
  assertCuentaOperable,
  PerfilTrabajadorRow,
  publicUsuario,
  UsuarioRow,
} from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { MailSimulatorService } from './recovery/mail-simulator.service';
import { RecoveryTokenStore } from './recovery/recovery-token.store';

const MENSAJE_RECUPERACION =
  'Si el correo está registrado, te enviaremos instrucciones para restablecer la contraseña.';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly recoveryTokens: RecoveryTokenStore,
    private readonly mailSimulator: MailSimulatorService,
  ) {}

  async register(dto: RegisterDto) {
    const correo = dto.correo.toLowerCase();
    const existing = await this.findUsuarioByCorreo(correo);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const telefono = dto.telefono?.trim() || null;

    const { data: created, error: createError } =
      await this.supabase.admin.auth.admin.createUser({
        email: correo,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          nombre: dto.nombre,
          telefono,
          modo: dto.modo || 'cliente',
        },
      });

    if (createError || !created.user) {
      if (this.isDuplicateAuthError(createError?.message)) {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw new BadRequestException(
        createError?.message || 'No se pudo crear la cuenta.',
      );
    }

    const usuario = await this.insertUsuario({
      nombre: dto.nombre,
      correo,
      telefono,
      password_hash: passwordHash,
    });

    await this.registrarBitacora(usuario.id_usuario, 'REGISTER', 'usuario');
    await this.ensureWorkerProfile(usuario, dto);

    const session = await this.signInAfterRegister(correo, dto.password, usuario);
    if (!session) {
      return {
        user: publicUsuario(usuario),
        tokens: null,
        rememberMe: false,
        tienePerfilTrabajador: Boolean(await this.findPerfil(usuario.id_usuario)),
        perfilTrabajador: await this.findPerfil(usuario.id_usuario),
        needsLogin: true,
        message: 'Cuenta creada exitosamente. Inicia sesión para continuar.',
      };
    }
    return this.buildAuthResponse(usuario, session, false);
  }

  async login(dto: LoginDto) {
    const correo = dto.correo.toLowerCase();
    const usuario = await this.findUsuarioByCorreo(correo);

    if (!usuario) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const bloqueo = assertCuentaOperable(usuario);
    if (bloqueo) {
      throw new UnauthorizedException(bloqueo);
    }

    let session = await this.trySignIn(correo, dto.password);

    if (!session) {
      const passwordOk = await bcrypt.compare(dto.password, usuario.password_hash || '');
      if (!passwordOk) {
        throw new UnauthorizedException('Correo o contraseña incorrectos.');
      }
      await this.ensureAuthUser(usuario, dto.password);
      session = await this.signIn(correo, dto.password);
    } else {
      const sameHash = await bcrypt.compare(dto.password, usuario.password_hash || '');
      if (!sameHash) {
        await this.updatePasswordHash(usuario.id_usuario, dto.password);
      }
    }

    await this.registrarBitacora(usuario.id_usuario, 'LOGIN', 'usuario');
    return this.buildAuthResponse(usuario, session, dto.rememberMe === true);
  }

  async logout(accessToken?: string) {
    if (accessToken) {
      const scoped = this.userClient(accessToken);
      await scoped.auth.signOut();
    }
    return { message: 'Sesión cerrada.' };
  }

  async refresh(dto: RefreshTokenDto) {
    const { data, error } = await this.supabase.anon.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('No se pudo renovar la sesión.');
    }

    return this.sessionPayload(data.session);
  }

  async me(usuario: UsuarioRow) {
    const perfil = await this.findPerfil(usuario.id_usuario);
    return {
      user: publicUsuario(usuario),
      tienePerfilTrabajador: Boolean(perfil),
      perfilTrabajador: perfil,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const correo = dto.correo.toLowerCase();
    const usuario = await this.findUsuarioByCorreo(correo);

    if (usuario && assertCuentaOperable(usuario) === null) {
      const ttlMinutes = Number(this.config.get('RESET_TOKEN_TTL_MINUTES') || 15);
      const issued = this.recoveryTokens.issue(usuario.id_usuario, correo, ttlMinutes);
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const enlace = `${frontendUrl}/reset-password?token=${issued.token}`;

      this.mailSimulator.enviarRecuperacion({
        correo,
        codigo: issued.codigo,
        enlace,
        expiresAt: issued.expiresAt,
        expiresInMinutes: issued.expiresInMinutes,
      });

      await this.registrarBitacora(usuario.id_usuario, 'FORGOT_PASSWORD', 'usuario');
    }

    return {
      message: MENSAJE_RECUPERACION,
      expiresInMinutes: Number(this.config.get('RESET_TOKEN_TTL_MINUTES') || 15),
      envio: 'simulado',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.token || dto.codigo) {
      return this.resetPasswordWithChallenge(dto);
    }

    if (dto.accessToken) {
      return this.resetPasswordWithSupabaseSession(dto);
    }

    throw new BadRequestException(
      'Debes enviar el token del enlace o el código de 6 dígitos junto con el correo.',
    );
  }

  private async resetPasswordWithChallenge(dto: ResetPasswordDto) {
    const challenge = dto.token
      ? this.recoveryTokens.consumeByToken(dto.token)
      : dto.correo && dto.codigo
        ? this.recoveryTokens.consumeByCode(dto.correo, dto.codigo)
        : null;

    if (!challenge) {
      throw new UnauthorizedException('El código o enlace de recuperación no es válido o expiró.');
    }

    const usuario = await this.findUsuarioById(challenge.idUsuario);
    if (!usuario) {
      throw new UnauthorizedException('El código o enlace de recuperación no es válido o expiró.');
    }

    await this.applyNewPassword(usuario, dto.password);
    await this.registrarBitacora(usuario.id_usuario, 'RESET_PASSWORD', 'usuario');
    return { message: 'La contraseña se restableció correctamente.' };
  }

  private async resetPasswordWithSupabaseSession(dto: ResetPasswordDto) {
    const scoped = this.userClient(dto.accessToken as string, dto.refreshToken);
    const { data: userData, error: userError } = await scoped.auth.getUser(dto.accessToken);
    if (userError || !userData.user?.email) {
      throw new UnauthorizedException('El enlace de recuperación no es válido o expiró.');
    }

    const { error } = await scoped.auth.updateUser({ password: dto.password });
    if (error) {
      throw new BadRequestException(error.message || 'No se pudo restablecer la contraseña.');
    }

    const usuario = await this.findUsuarioByCorreo(userData.user.email.toLowerCase());
    if (usuario) {
      await this.updatePasswordHash(usuario.id_usuario, dto.password);
      await this.registrarBitacora(usuario.id_usuario, 'RESET_PASSWORD', 'usuario');
    }

    return { message: 'La contraseña se restableció correctamente.' };
  }

  async changePassword(usuario: UsuarioRow, dto: ChangePasswordDto) {
    const session = await this.trySignIn(usuario.correo, dto.passwordActual);
    const hashOk = await bcrypt.compare(dto.passwordActual, usuario.password_hash || '');
    if (!session && !hashOk) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }

    const authUser = await this.findAuthUserByEmail(usuario.correo);
    if (authUser) {
      const { error } = await this.supabase.admin.auth.admin.updateUserById(authUser.id, {
        password: dto.passwordNueva,
      });
      if (error) {
        throw new BadRequestException(error.message || 'No se pudo cambiar la contraseña.');
      }
    }

    await this.updatePasswordHash(usuario.id_usuario, dto.passwordNueva);
    await this.registrarBitacora(usuario.id_usuario, 'CHANGE_PASSWORD', 'usuario');
    return { message: 'La contraseña se actualizó correctamente.' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    if (!dto.correo) {
      throw new BadRequestException('El correo electrónico es obligatorio.');
    }

    const { error } = await this.supabase.anon.auth.verifyOtp({
      email: dto.correo,
      token: dto.token,
      type: 'email',
    });

    if (error) {
      throw new BadRequestException(error.message || 'No se pudo verificar el correo.');
    }

    return { message: 'Correo verificado correctamente.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const { error } = await this.supabase.anon.auth.resend({
      type: 'signup',
      email: dto.correo,
      options: { emailRedirectTo: `${frontendUrl}/login` },
    });

    if (error) {
      throw new BadRequestException(error.message || 'No se pudo reenviar la verificación.');
    }

    return { message: 'Si el correo existe, reenviamos el enlace de verificación.' };
  }

  async deactivate(usuario: UsuarioRow) {
    const updated = await this.patchUsuario(usuario.id_usuario, { modo_activo: false });
    await this.registrarBitacora(usuario.id_usuario, 'DEACTIVATE', 'usuario');
    return { user: publicUsuario(updated), message: 'La cuenta fue desactivada.' };
  }

  async reactivate(usuario: UsuarioRow) {
    if (usuario.estado === 'ELIMINADO' || usuario.estado === 'SUSPENDIDO') {
      throw new BadRequestException('Esta cuenta no se puede reactivar desde aquí.');
    }
    const updated = await this.patchUsuario(usuario.id_usuario, { modo_activo: true });
    await this.registrarBitacora(usuario.id_usuario, 'REACTIVATE', 'usuario');
    return { user: publicUsuario(updated), message: 'La cuenta fue reactivada.' };
  }

  async deleteAccount(usuario: UsuarioRow) {
    const updated = await this.patchUsuario(usuario.id_usuario, {
      estado: 'ELIMINADO',
      modo_activo: false,
    });

    const authUser = await this.findAuthUserByEmail(usuario.correo);
    if (authUser) {
      await this.supabase.admin.auth.admin.deleteUser(authUser.id);
    }

    await this.registrarBitacora(usuario.id_usuario, 'DELETE_ACCOUNT', 'usuario');
    return { user: publicUsuario(updated), message: 'La cuenta fue eliminada.' };
  }

  async updateEstado(idUsuario: number, estado: string) {
    const usuario = await this.findUsuarioById(idUsuario);
    if (!usuario) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const updated = await this.patchUsuario(idUsuario, {
      estado,
      modo_activo: estado === 'ACTIVO',
    });
    await this.registrarBitacora(idUsuario, 'ADMIN_ESTADO', 'usuario');
    return { user: publicUsuario(updated) };
  }

  async findUsuarioByCorreo(correo: string): Promise<UsuarioRow | null> {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('*')
      .eq('correo', correo.toLowerCase())
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data as UsuarioRow) || null;
  }

  async findUsuarioById(idUsuario: number): Promise<UsuarioRow | null> {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('*')
      .eq('id_usuario', idUsuario)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data as UsuarioRow) || null;
  }

  private async findPerfil(idUsuario: number): Promise<PerfilTrabajadorRow | null> {
    const { data } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    return (data as PerfilTrabajadorRow) || null;
  }

  private async insertUsuario(row: {
    nombre: string;
    correo: string;
    telefono: string | null;
    password_hash: string;
  }): Promise<UsuarioRow> {
    const payload = {
      ...row,
      modo_activo: true,
      estado: 'ACTIVO',
    };

    const { data, error } = await this.supabase
      .from('usuario')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) {
      return data as UsuarioRow;
    }

    if (this.isMissingIdError(error?.message)) {
      const nextId = await this.nextUsuarioId();
      const { data: retry, error: retryError } = await this.supabase
        .from('usuario')
        .insert({ ...payload, id_usuario: nextId })
        .select('*')
        .single();

      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo guardar el usuario.');
      }
      return retry as UsuarioRow;
    }

    throw new BadRequestException(error?.message || 'No se pudo guardar el usuario.');
  }

  private async nextUsuarioId() {
    const { data } = await this.supabase
      .from('usuario')
      .select('id_usuario')
      .order('id_usuario', { ascending: false })
      .limit(1);
    return (data?.[0]?.id_usuario || 0) + 1;
  }

  private isMissingIdError(message?: string) {
    if (!message) return false;
    return /null value in column ["']?id_usuario["']?/i.test(message) || /id_usuario/i.test(message);
  }

  private async patchUsuario(idUsuario: number, values: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('usuario')
      .update(values)
      .eq('id_usuario', idUsuario)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message || 'No se pudo actualizar el usuario.');
    }
    return data as UsuarioRow;
  }

  private async updatePasswordHash(idUsuario: number, password: string) {
    const password_hash = await bcrypt.hash(password, 12);
    await this.patchUsuario(idUsuario, { password_hash });
  }

  private async applyNewPassword(usuario: UsuarioRow, password: string) {
    await this.updatePasswordHash(usuario.id_usuario, password);

    const authUser = await this.findAuthUserByEmail(usuario.correo);
    if (authUser) {
      const { error } = await this.supabase.admin.auth.admin.updateUserById(authUser.id, {
        password,
      });
      if (error) {
        throw new BadRequestException(error.message || 'No se pudo restablecer la contraseña.');
      }
      return;
    }

    await this.ensureAuthUser(usuario, password);
  }

  private async signInAfterRegister(correo: string, password: string, usuario: UsuarioRow) {
    let session = await this.trySignIn(correo, password);
    if (session) return session;

    await this.ensureAuthUser(usuario, password);
    for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      session = await this.trySignIn(correo, password);
    }
    return session;
  }

  private async ensureWorkerProfile(usuario: UsuarioRow, dto: RegisterDto) {
    if ((dto.modo || 'cliente') !== 'trabajador') return;
    const existing = await this.findPerfil(usuario.id_usuario);
    if (existing) return;

    const payload = {
      id_usuario: usuario.id_usuario,
      oficio_principal: dto.oficio_principal?.trim() || usuario.nombre,
      descripcion: dto.descripcion?.trim() || null,
      experiencia: dto.experiencia?.trim() || null,
      disponibilidad: 'Disponible',
      contacto_visible: true,
      verificado: false,
    };

    const { error } = await this.supabase.from('perfil_trabajador').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_perfil["']?/i.test(error.message)) {
      const { data } = await this.supabase
        .from('perfil_trabajador')
        .select('id_perfil')
        .order('id_perfil', { ascending: false })
        .limit(1);
      const nextId = (data?.[0]?.id_perfil || 0) + 1;
      await this.supabase.from('perfil_trabajador').insert({ ...payload, id_perfil: nextId });
    }
  }

  private async signIn(correo: string, password: string) {
    const session = await this.trySignIn(correo, password);
    if (!session) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    return session;
  }

  private async trySignIn(correo: string, password: string) {
    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email: correo,
      password,
    });
    if (error || !data.session) {
      return null;
    }
    return data.session;
  }

  private async ensureAuthUser(usuario: UsuarioRow, password: string) {
    const existing = await this.findAuthUserByEmail(usuario.correo);
    if (existing) {
      await this.supabase.admin.auth.admin.updateUserById(existing.id, { password });
      return;
    }

    const { error } = await this.supabase.admin.auth.admin.createUser({
      email: usuario.correo,
      password,
      email_confirm: true,
      user_metadata: { nombre: usuario.nombre, telefono: usuario.telefono },
    });

    if (error && !this.isDuplicateAuthError(error.message)) {
      throw new BadRequestException(error.message);
    }
  }

  private async findAuthUserByEmail(correo: string) {
    const { data, error } = await this.supabase.admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) return null;
    return data.users.find((user) => user.email?.toLowerCase() === correo.toLowerCase()) || null;
  }

  private userClient(accessToken: string, refreshToken?: string) {
    const client = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (refreshToken) {
      void client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    return client;
  }

  private async buildAuthResponse(
    usuario: UsuarioRow,
    session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at?: number;
    },
    rememberMe: boolean,
  ) {
    const perfil = await this.findPerfil(usuario.id_usuario);
    return {
      user: publicUsuario(usuario),
      tokens: this.sessionPayload(session),
      rememberMe,
      tienePerfilTrabajador: Boolean(perfil),
      perfilTrabajador: perfil,
    };
  }

  private sessionPayload(session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
  }) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at || null,
    };
  }

  private async registrarBitacora(idActor: number, accion: string, recurso: string) {
    const payload = {
      id_actor: idActor,
      accion,
      recurso,
      origen: 'api/auth',
    };

    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;

    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const { data } = await this.supabase
        .from('bitacora')
        .select('id_evento')
        .order('id_evento', { ascending: false })
        .limit(1);
      const nextId = (data?.[0]?.id_evento || 0) + 1;
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }

  private isDuplicateAuthError(message?: string) {
    if (!message) return false;
    return /already|registered|exists|duplicate/i.test(message);
  }
}
