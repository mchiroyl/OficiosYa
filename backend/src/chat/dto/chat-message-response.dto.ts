import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageResponseDto {
  @ApiProperty({ example: 21 })
  id_mensaje: number;

  @ApiProperty({ example: 8 })
  id_solicitud: number;

  @ApiProperty({ example: 12 })
  id_emisor: number;

  @ApiProperty({ example: 'Ana Pérez' })
  emisor_nombre: string;

  @ApiProperty({ example: '¿Puede llegar hoy por la tarde?' })
  contenido: string;

  @ApiPropertyOptional({ nullable: true })
  adjunto_url: string | null;

  @ApiPropertyOptional({ nullable: true })
  adjunto_thumb_url: string | null;

  @ApiProperty({ enum: ['texto', 'imagen'], example: 'texto' })
  tipo: 'texto' | 'imagen';

  @ApiProperty()
  fecha_envio: string;

  @ApiProperty({ description: 'true si el mensaje lo envió el usuario autenticado.' })
  mio: boolean;
}
