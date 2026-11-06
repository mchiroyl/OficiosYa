import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const ESTADOS_DISPONIBILIDAD = ['Disponible', 'Ocupado'] as const;

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({
    enum: ESTADOS_DISPONIBILIDAD,
    description: 'Si se omite, el estado público se alterna.',
  })
  @IsOptional()
  @IsIn(ESTADOS_DISPONIBILIDAD, {
    message: 'La disponibilidad debe ser Disponible u Ocupado.',
  })
  disponibilidad?: (typeof ESTADOS_DISPONIBILIDAD)[number];
}
