import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateReportDto {
  @ApiProperty({ enum: ['RESUELTO', 'RECHAZADO'] })
  @IsIn(['RESUELTO', 'RECHAZADO'], {
    message: 'El estado del reporte debe ser RESUELTO o RECHAZADO.',
  })
  estado: 'RESUELTO' | 'RECHAZADO';

  @ApiPropertyOptional({
    enum: ['ACTIVO', 'SUSPENDIDO', 'ELIMINADO'],
    description: 'Si se indica, se aplica a la cuenta denunciada.',
  })
  @IsOptional()
  @IsIn(['ACTIVO', 'SUSPENDIDO', 'ELIMINADO'])
  accion_cuenta?: 'ACTIVO' | 'SUSPENDIDO' | 'ELIMINADO';
}
