import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 1, description: 'Solicitud finalizada que se califica.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_solicitud: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(1, { message: 'La calificación mínima es 1.' })
  @Max(5, { message: 'La calificación máxima es 5.' })
  calificacion: number;

  @ApiPropertyOptional({ example: 'Excelente trabajo, puntual y ordenado.' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El comentario debe tener al menos 3 caracteres.' })
  @MaxLength(2000)
  comentario?: string;
}
