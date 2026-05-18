import crypto from 'crypto';

export const createMediaAssetFingerprint = (buffer: Buffer): string =>
  crypto.createHash('sha256').update(buffer).digest('hex');
