import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ACCIONES_SOLICITUD, AccionSolicitud } from '../request-state';

export class UpdateRequestStatusDto {
  @ApiProperty({
    enum: ACCIONES_SOLICITUD,
    example: 'Aceptar',
    description: 'Aceptar y Rechazar: trabajador. Cancelar: cliente. Finalizar: cliente o trabajador, solo si está Aceptada.',
  })
  @IsIn(ACCIONES_SOLICITUD, {
    message: 'La acción debe ser Aceptar, Rechazar, Cancelar o Finalizar.',
  })
  accion: AccionSolicitud;
}
