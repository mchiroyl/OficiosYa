import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const ACCIONES_SANCION = ['suspender', 'banear', 'reactivar'] as const;
export type AccionSancion = (typeof ACCIONES_SANCION)[number];

export class SancionCuentaDto {
  @ApiProperty({
    enum: ACCIONES_SANCION,
    description: 'suspender bloquea el acceso y se puede revertir. banear cierra la cuenta de forma permanente.',
  })
  @IsIn(ACCIONES_SANCION, {
    message: 'La acción debe ser suspender, banear o reactivar.',
  })
  accion: AccionSancion;

  @ApiPropertyOptional({ example: 'Incumplimiento reiterado de las normas de la comunidad.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo?: string;
}
