import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

const MAX_CODE_ATTEMPTS = 5;

export type RecoveryChallenge = {
  idUsuario: number;
  correo: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: number;
  used: boolean;
  attempts: number;
};

export type IssuedRecovery = {
  token: string;
  codigo: string;
  expiresAt: Date;
  expiresInMinutes: number;
};

@Injectable()
export class RecoveryTokenStore {
  private readonly challenges = new Map<string, RecoveryChallenge>();

  constructor(private readonly config: ConfigService) {}

  issue(idUsuario: number, correo: string, ttlMinutes: number): IssuedRecovery {
    const token = randomBytes(32).toString('base64url');
    const codigo = String(randomInt(100000, 1000000));
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    const key = this.normalize(correo);

    this.challenges.set(key, {
      idUsuario,
      correo: key,
      tokenHash: this.digest(token),
      codeHash: this.digest(codigo),
      expiresAt,
      used: false,
      attempts: 0,
    });

    return {
      token,
      codigo,
      expiresAt: new Date(expiresAt),
      expiresInMinutes: ttlMinutes,
    };
  }

  consumeByToken(token: string): RecoveryChallenge | null {
    const tokenHash = this.digest((token || '').trim());
    return this.consume((challenge) => this.safeEqual(challenge.tokenHash, tokenHash));
  }

  consumeByCode(correo: string, codigo: string): RecoveryChallenge | null {
    const challenge = this.challenges.get(this.normalize(correo));
    if (!this.isUsable(challenge)) return null;

    if (!this.safeEqual(challenge.codeHash, this.digest((codigo || '').trim()))) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
        this.challenges.delete(challenge.correo);
      }
      return null;
    }

    challenge.used = true;
    this.challenges.delete(challenge.correo);
    return challenge;
  }

  private consume(predicate: (challenge: RecoveryChallenge) => boolean) {
    for (const [key, challenge] of this.challenges.entries()) {
      if (!this.isUsable(challenge) || !predicate(challenge)) continue;
      challenge.used = true;
      this.challenges.delete(key);
      return challenge;
    }
    return null;
  }

  private isUsable(challenge?: RecoveryChallenge): challenge is RecoveryChallenge {
    if (!challenge || challenge.used) return false;
    if (challenge.expiresAt <= Date.now()) {
      this.challenges.delete(challenge.correo);
      return false;
    }
    return true;
  }

  private digest(value: string) {
    const secret = this.config.get<string>('RESET_TOKEN_SECRET');
    if (secret) {
      return createHmac('sha256', secret).update(value).digest('hex');
    }
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private normalize(correo: string) {
    return correo.trim().toLowerCase();
  }
}
