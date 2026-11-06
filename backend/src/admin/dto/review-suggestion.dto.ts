import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewSuggestionDto {
  @ApiProperty({ enum: ['aprobar', 'rechazar'] })
  @IsIn(['aprobar', 'rechazar'], { message: 'La acción debe ser aprobar o rechazar.' })
  accion: 'aprobar' | 'rechazar';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
