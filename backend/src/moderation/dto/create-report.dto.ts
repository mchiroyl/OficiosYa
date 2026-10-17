import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const TIPOS_RECURSO_REPORTE = [
  'usuario',
  'perfil',
  'solicitud',
  'resena',
  'mensaje',
] as const;

export class CreateReportDto {
  @ApiProperty({ enum: TIPOS_RECURSO_REPORTE, example: 'usuario' })
  @IsIn(TIPOS_RECURSO_REPORTE, { message: 'El tipo de recurso no es válido.' })
  tipo_recurso: (typeof TIPOS_RECURSO_REPORTE)[number];

  @ApiProperty({ example: 12, description: 'id_usuario, id_perfil u otro id según tipo_recurso.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_recurso: number;

  @ApiProperty({ example: 'El perfil publica datos de contacto falsos.' })
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres.' })
  @MaxLength(2000)
  motivo: string;

  @ApiPropertyOptional({ example: 'Suplantación de identidad' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoria?: string;
}
