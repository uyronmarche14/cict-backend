import { describe, expect, it } from 'vitest';
import { createMediaAssetFingerprint } from './mediaFingerprint';

describe('createMediaAssetFingerprint', () => {
  it('returns the same fingerprint for identical file buffers', () => {
    const first = Buffer.from('same image bytes');
    const second = Buffer.from('same image bytes');

    expect(createMediaAssetFingerprint(first)).toBe(createMediaAssetFingerprint(second));
  });

  it('returns different fingerprints for different file buffers even with similar metadata', () => {
    const first = Buffer.from('image bytes a');
    const second = Buffer.from('image bytes b');

    expect(createMediaAssetFingerprint(first)).not.toBe(createMediaAssetFingerprint(second));
  });
});
