import { describe, expect, it } from 'vitest';
import { normalizeGalleryExcludingCover } from './content';

describe('normalizeGalleryExcludingCover', () => {
  it('removes a gallery item when it matches the cover image by imageId', () => {
    const gallery = normalizeGalleryExcludingCover(
      [
        { imageId: 'cover-1', imageUrl: 'https://example.com/cover.jpg', alt: 'Cover' },
        { imageId: 'gallery-1', imageUrl: 'https://example.com/gallery.jpg', alt: 'Gallery' },
      ],
      { imageId: 'cover-1', imageUrl: 'https://example.com/cover.jpg', alt: 'Cover', sortOrder: 0 }
    );

    expect(gallery).toHaveLength(1);
    expect(gallery[0]?.imageId).toBe('gallery-1');
    expect(gallery[0]?.sortOrder).toBe(0);
  });

  it('removes duplicate gallery items and preserves unique supporting media', () => {
    const gallery = normalizeGalleryExcludingCover([
      { imageUrl: 'https://example.com/one.jpg', alt: 'One' },
      { imageUrl: 'https://example.com/one.jpg', alt: 'Duplicate one' },
      { imageUrl: 'https://example.com/two.jpg', alt: 'Two' },
    ]);

    expect(gallery).toHaveLength(2);
    expect(gallery.map((asset) => asset.imageUrl)).toEqual([
      'https://example.com/one.jpg',
      'https://example.com/two.jpg',
    ]);
    expect(gallery.map((asset) => asset.sortOrder)).toEqual([0, 1]);
  });

  it('removes a gallery item when it matches the cover image by assetFingerprint', () => {
    const gallery = normalizeGalleryExcludingCover(
      [
        {
          imageId: 'gallery-copy',
          imageUrl: 'https://example.com/cover-copy.jpg',
          assetFingerprint: 'same-file:1024:image/jpeg',
          alt: 'Duplicate file',
        },
        {
          imageId: 'gallery-unique',
          imageUrl: 'https://example.com/unique.jpg',
          assetFingerprint: 'unique-file:2048:image/jpeg',
          alt: 'Unique file',
        },
      ],
      {
        imageId: 'cover-asset',
        imageUrl: 'https://example.com/cover.jpg',
        assetFingerprint: 'same-file:1024:image/jpeg',
        alt: 'Cover',
        sortOrder: 0,
      }
    );

    expect(gallery).toHaveLength(1);
    expect(gallery[0]?.imageId).toBe('gallery-unique');
  });
});
