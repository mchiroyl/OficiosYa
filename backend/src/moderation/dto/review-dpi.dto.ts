import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDpiDto {
  @ApiProperty({ enum: ['aprobar', 'rechazar'] })
  @IsIn(['aprobar', 'rechazar'])
  decision: 'aprobar' | 'rechazar';

  @ApiPropertyOptional({ example: 'La foto del reverso está ilegible.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
