import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({ description: 'Token temporal del enlace de recuperación' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  correo?: string;

  @ApiPropertyOptional({ example: '847291', description: 'Código temporal de 6 dígitos' })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos.' })
  codigo?: string;

  @ApiPropertyOptional()
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
