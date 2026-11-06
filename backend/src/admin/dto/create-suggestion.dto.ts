import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSuggestionDto {
  @ApiProperty({ example: 'Herrería' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'El nombre del oficio es obligatorio.' })
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({ example: 'Trabajos en metal, rejas y portones.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  descripcion?: string;
}
