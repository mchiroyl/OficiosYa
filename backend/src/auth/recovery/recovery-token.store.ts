import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export type RecoveryChallenge = {
  idUsuario: number;
  correo: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: number;
  used: boolean;
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

  issue(idUsuario: number, correo: string, ttlMinutes: number): IssuedRecovery {
    const token = randomBytes(32).toString('hex');
    const codigo = String(randomInt(100000, 1000000));
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    const key = this.normalize(correo);

    this.challenges.set(key, {
      idUsuario,
      correo: key,
      tokenHash: this.hash(token),
      codeHash: this.hash(codigo),
      expiresAt,
      used: false,
    });

    return {
      token,
      codigo,
      expiresAt: new Date(expiresAt),
      expiresInMinutes: ttlMinutes,
    };
  }

  consumeByToken(token: string): RecoveryChallenge | null {
    return this.consume((challenge) => this.safeEqual(challenge.tokenHash, this.hash(token)));
  }

  consumeByCode(correo: string, codigo: string): RecoveryChallenge | null {
    const challenge = this.challenges.get(this.normalize(correo));
    if (!this.isUsable(challenge)) return null;
    if (!this.safeEqual(challenge.codeHash, this.hash(codigo))) return null;
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

  private hash(value: string) {
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
