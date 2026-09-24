import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const TIPOS_TARIFA = ['por_hora', 'por_servicio', 'a_convenir'] as const;

export class TarifasDto {
  @ApiPropertyOptional({ enum: TIPOS_TARIFA, example: 'por_hora' })
  @IsOptional()
  @IsIn(TIPOS_TARIFA, { message: 'El tipo de tarifa no es válido.' })
  tipo?: (typeof TIPOS_TARIFA)[number];

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto_desde?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto_hasta?: number;

  @ApiPropertyOptional({ example: 'GTQ' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  moneda?: string;

  @ApiPropertyOptional({ example: 'Visita técnica 80' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notas?: string;
}
