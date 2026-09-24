import { Injectable, Logger } from '@nestjs/common';

export type SimulatedRecoveryMail = {
  correo: string;
  codigo: string;
  enlace: string;
  expiresAt: Date;
  expiresInMinutes: number;
};

@Injectable()
export class MailSimulatorService {
  private readonly logger = new Logger('MailSimulator');

  enviarRecuperacion(mail: SimulatedRecoveryMail) {
    const lines = [
      '[HU-03] Simulación de envío de restablecimiento',
      `Para: ${mail.correo}`,
      'Asunto: Restablece tu contraseña — OficiosYa',
      `Código temporal: ${mail.codigo}`,
      `Enlace temporal: ${mail.enlace}`,
      `Vence: ${mail.expiresAt.toISOString()} (${mail.expiresInMinutes} min)`,
      'Este envío es simulado. No se despachó un correo real.',
    ];

    this.logger.log(lines.join(' | '));

    return {
      canal: 'simulacion',
      destinatario: mail.correo,
      asunto: 'Restablece tu contraseña — OficiosYa',
      enviadoEn: new Date().toISOString(),
    };
  }
}
