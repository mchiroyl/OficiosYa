import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ example: 1, description: 'id_perfil del trabajador.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_trabajador: number;

  @ApiProperty({ example: 1, description: 'Servicio ofrecido por ese trabajador.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_servicio: number;

  @ApiProperty({ example: 'Hay fugas de agua en la cocina.' })
  @IsString()
  @MinLength(10, { message: 'Describe el trabajo con al menos 10 caracteres.' })
  @MaxLength(4000)
  descripcion: string;

  @ApiPropertyOptional({ example: 'Zona 10, cerca de Oakland' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ubicacion_aprox?: string;

  @ApiPropertyOptional({ example: '2026-09-15T09:00:00' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha deseada no es válida.' })
  fecha_deseada?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  urgente?: boolean;
}
