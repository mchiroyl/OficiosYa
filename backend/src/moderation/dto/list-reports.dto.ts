import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { TIPOS_RECURSO_REPORTE } from './create-report.dto';

export const ESTADOS_REPORTE = ['PENDIENTE', 'RESUELTO', 'RECHAZADO'] as const;

export class ListReportsDto {
  @ApiPropertyOptional({ enum: [...ESTADOS_REPORTE, 'todos'], example: 'PENDIENTE' })
  @IsOptional()
  @IsIn([...ESTADOS_REPORTE, 'todos'])
  estado?: (typeof ESTADOS_REPORTE)[number] | 'todos';

  @ApiPropertyOptional({ enum: TIPOS_RECURSO_REPORTE })
  @IsOptional()
  @IsIn(TIPOS_RECURSO_REPORTE)
  tipo_recurso?: (typeof TIPOS_RECURSO_REPORTE)[number];
}
