import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateEstadoDto {
  @ApiProperty({ enum: ['ACTIVO', 'SUSPENDIDO', 'ELIMINADO'] })
  @IsIn(['ACTIVO', 'SUSPENDIDO', 'ELIMINADO'], {
    message: 'El estado debe ser ACTIVO, SUSPENDIDO o ELIMINADO.',
  })
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'ELIMINADO';
}
