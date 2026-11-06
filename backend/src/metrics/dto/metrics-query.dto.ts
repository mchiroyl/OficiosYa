import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MetricsQueryDto {
  @ApiPropertyOptional({
    example: 6,
    description: 'Cuántos oficios devolver en el ranking. Entre 1 y 20.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
