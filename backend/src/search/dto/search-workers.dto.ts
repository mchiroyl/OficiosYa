import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchWorkersDto {
  @ApiPropertyOptional({ example: 14.6349, description: 'Latitud aproximada del usuario.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -90.5069, description: 'Longitud aproximada del usuario.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 5, description: 'Buscar por id de zona/cuadrante.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_zona?: number;

  @ApiPropertyOptional({ example: 'Cuadrante Centro', description: 'Nombre o clave del cuadrante.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cuadrante?: string;

  @ApiPropertyOptional({ example: 'Plomería' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  oficio?: string;

  @ApiPropertyOptional({ example: 8, description: 'Radio en km para zonas cercanas. Por defecto 8.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radio_km?: number;

  @ApiPropertyOptional({ example: true, description: 'Incluye cuadrantes vecinos o dentro del radio.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  incluir_cercanos?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  incluir_ocupados?: boolean;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
