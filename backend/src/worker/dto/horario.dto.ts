import { ApiProperty } from '@nestjs/swagger';
import { IsIn, Matches } from 'class-validator';

export const DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export class HorarioDto {
  @ApiProperty({ enum: DIAS, example: 'lunes' })
  @IsIn(DIAS, { message: 'El día debe ser un día de la semana válido.' })
  dia: (typeof DIAS)[number];

  @ApiProperty({ example: '08:00' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'El horario de inicio debe ser HH:mm.' })
  desde: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'El horario de fin debe ser HH:mm.' })
  hasta: string;
}
