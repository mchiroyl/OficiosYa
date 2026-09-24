import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ORDEN_BUSQUEDA = ['relevancia', 'reputacion', 'precio_asc', 'precio_desc'] as const;

export class SearchProfilesDto {
  @ApiPropertyOptional({ example: 'plomería urgente', description: 'Texto libre (oficio, bio o servicio).' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_zona?: number;

  @ApiPropertyOptional({ example: 'Zona 10' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  zona?: string;

  @ApiPropertyOptional({ example: 'Disponible', enum: ['Disponible', 'Ocupado', 'todos'] })
  @IsOptional()
  @IsString()
  @IsIn(['Disponible', 'Ocupado', 'todos'])
  disponibilidad?: string;

  @ApiPropertyOptional({ example: 40, description: 'Precio mínimo (tarifa desde/hasta).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_min?: number;

  @ApiPropertyOptional({ example: 150, description: 'Precio máximo.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_max?: number;

  @ApiPropertyOptional({ example: 4, description: 'Calificación mínima 1-5.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  reputacion_min?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  verificado?: boolean;

  @ApiPropertyOptional({ enum: ORDEN_BUSQUEDA, example: 'relevancia' })
  @IsOptional()
  @IsIn(ORDEN_BUSQUEDA)
  orden?: (typeof ORDEN_BUSQUEDA)[number];

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
