import { Injectable, Logger } from '@nestjs/common';

export type SimulatedRecoveryMail = {
  correo: string;
  codigo: string;
  enlace: string;
  expiresAt: Date;
  expiresInMinutes: number;
};

export type SimulatedDispatch = {
  canal: 'simulacion';
  destinatario: string;
  asunto: string;
  enviadoEn: string;
  codigo: string;
  enlace: string;
  vence: string;
  expiresInMinutes: number;
  nota: string;
};

@Injectable()
export class MailSimulatorService {
  private readonly logger = new Logger('MailSimulator');
  private lastDispatch: SimulatedDispatch | null = null;

  enviarRecuperacion(mail: SimulatedRecoveryMail): SimulatedDispatch {
    const dispatch: SimulatedDispatch = {
      canal: 'simulacion',
      destinatario: mail.correo,
      asunto: 'Restablece tu contraseña — OficiosYa',
      enviadoEn: new Date().toISOString(),
      codigo: mail.codigo,
      enlace: mail.enlace,
      vence: mail.expiresAt.toISOString(),
      expiresInMinutes: mail.expiresInMinutes,
      nota: 'Este envío es simulado. No se despachó un correo real.',
    };

    this.lastDispatch = dispatch;

    this.logger.log(
      [
        '[HU-03] Simulación de envío de restablecimiento',
        `Para: ${dispatch.destinatario}`,
        `Asunto: ${dispatch.asunto}`,
        `Código temporal: ${dispatch.codigo}`,
        `Enlace temporal: ${dispatch.enlace}`,
        `Vence: ${dispatch.vence} (${dispatch.expiresInMinutes} min)`,
        dispatch.nota,
      ].join(' | '),
    );

    return dispatch;
  }

  ultimoEnvio() {
    return this.lastDispatch;
  }
}
