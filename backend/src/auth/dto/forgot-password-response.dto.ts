import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SimulacionEnvioDto {
  @ApiProperty({ example: 'simulacion' })
  canal: string;

  @ApiProperty({ example: 'Restablece tu contraseña — OficiosYa' })
  asunto: string;

  @ApiProperty({ example: 'ana@example.com' })
  destinatario: string;

  @ApiProperty({
    example: 'No se despachó un correo real. El código y el enlace se registran en la consola del API.',
  })
  nota: string;

  @ApiPropertyOptional({
    example: '847291',
    description: 'Solo en entorno de pruebas (RECOVERY_SIMULATION_EXPOSE).',
  })
  codigo?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:5173/reset-password?token=abc',
    description: 'Solo en entorno de pruebas (RECOVERY_SIMULATION_EXPOSE).',
  })
  enlace?: string;

  @ApiPropertyOptional({ example: '2026-09-28T21:05:00.000Z' })
  vence?: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example:
      'Si el correo está registrado, te enviaremos instrucciones para restablecer la contraseña.',
  })
  message: string;

  @ApiProperty({ example: 15 })
  expiresInMinutes: number;

  @ApiProperty({ type: SimulacionEnvioDto })
  envio: SimulacionEnvioDto;
}
