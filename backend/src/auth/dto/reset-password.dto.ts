import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({
    description: 'Token temporal del enlace de recuperación (query ?token=).',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  token?: string;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @ValidateIf((dto: ResetPasswordDto) => !dto.token && !dto.accessToken)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  correo?: string;

  @ApiPropertyOptional({
    example: '847291',
    description: 'Código temporal de 6 dígitos enviado en la simulación.',
  })
  @ValidateIf((dto: ResetPasswordDto) => !dto.token && !dto.accessToken)
  @IsString()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos.' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos.' })
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Sesión de recuperación de Supabase (flujo alterno por hash de URL).',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({ example: 'nuevaClave123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;
}
