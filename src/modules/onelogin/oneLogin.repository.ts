import { OAuthKey } from '@prisma/client';
import { db } from '../../config/db';

/**
 * Phase 6 — TODO: implement full key management.
 */
export const oneLoginRepository = {
  async findActiveKeys(): Promise<OAuthKey[]> {
    return db.oAuthKey.findMany({ where: { active: true } });
  },

  async findByKid(kid: string): Promise<OAuthKey | null> {
    return db.oAuthKey.findUnique({ where: { kid } });
  },

  async createKey(_data: {
    kid: string;
    publicJwkJson: Record<string, unknown>;
    privateKeyRef: string;
    environment: string;
    expiresAt?: Date;
  }): Promise<OAuthKey> {
    throw new Error('not implemented');
  },

  async deactivateKey(_kid: string): Promise<void> {
    throw new Error('not implemented');
  },
};
