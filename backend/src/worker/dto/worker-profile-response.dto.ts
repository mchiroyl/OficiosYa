import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HorarioDto } from './horario.dto';
import { TarifasDto } from './tarifas.dto';

export class ZonaCoberturaDto {
  @ApiProperty({ example: 1 })
  id_zona: number;

  @ApiProperty({ example: 'Zona 10' })
  nombre: string;

  @ApiProperty({ example: 'cuadrante' })
  tipo: string;

  @ApiProperty({ example: 'ACTIVA' })
  estado: string;
}

export class WorkerProfileResponseDto {
  @ApiPropertyOptional({ example: 4, nullable: true })
  id_perfil: number | null;

  @ApiProperty({ example: 12 })
  id_usuario: number;

  @ApiProperty({ example: 'Plomería' })
  oficio_principal: string;

  @ApiProperty({ example: 'Reparaciones residenciales y comerciales.' })
  descripcion: string;

  @ApiPropertyOptional({ example: '8 años', nullable: true })
  experiencia: string | null;

  @ApiProperty({ example: true })
  contacto_visible: boolean;

  @ApiProperty({ example: false })
  verificado: boolean;

  @ApiProperty({ example: 'Disponible', enum: ['Disponible', 'Ocupado'] })
  disponibilidad: string;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado público mostrado en búsqueda. Igual a disponibilidad.',
    enum: ['Disponible', 'Ocupado'],
  })
  estado_publico: string;

  @ApiProperty({ example: 4.5 })
  reputacion: number;

  @ApiProperty({ example: 12 })
  total_resenas: number;

  @ApiPropertyOptional({ type: TarifasDto, nullable: true })
  tarifas: TarifasDto | null;

  @ApiProperty({ type: [HorarioDto] })
  horarios: HorarioDto[];

  @ApiProperty({ type: [ZonaCoberturaDto] })
  cobertura: ZonaCoberturaDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'false si el usuario aún no tiene fila en perfil_trabajador.',
  })
  existe?: boolean;
}
