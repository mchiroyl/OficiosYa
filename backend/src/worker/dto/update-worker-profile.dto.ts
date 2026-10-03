import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { HorarioDto } from './horario.dto';
import { TarifasDto } from './tarifas.dto';

export class UpdateWorkerProfileDto {
  @ApiPropertyOptional({ example: 'Plomería' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  oficio_principal?: string;

  @ApiPropertyOptional({ example: 'Reparaciones residenciales y comerciales.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiPropertyOptional({ example: '8 años' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  experiencia?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  contacto_visible?: boolean;

  @ApiPropertyOptional({ type: TarifasDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TarifasDto)
  tarifas?: TarifasDto;

  @ApiPropertyOptional({ type: [HorarioDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => HorarioDto)
  horarios?: HorarioDto[];

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  cobertura?: number[];
}
