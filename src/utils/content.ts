import { IContentSection, IEventScheduleItem, IMediaAsset } from '../types';

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildLegacyPlainText = (bodyHtml: string): string => stripHtml(bodyHtml);

export const normalizeMediaAsset = (
  value: unknown,
  fallback?: { imageUrl?: string; imageId?: string; assetFingerprint?: string }
): IMediaAsset | undefined => {
  if (value && typeof value === 'object') {
    const asset = value as Record<string, unknown>;
    const imageUrl = typeof asset.imageUrl === 'string' ? asset.imageUrl : fallback?.imageUrl;
    if (!imageUrl) {
      return undefined;
    }

    return {
      imageUrl,
      imageId: typeof asset.imageId === 'string' ? asset.imageId : fallback?.imageId,
      assetFingerprint:
        typeof asset.assetFingerprint === 'string'
          ? asset.assetFingerprint
          : fallback?.assetFingerprint,
      alt:
        typeof asset.alt === 'string' && asset.alt.trim().length > 0
          ? asset.alt.trim()
          : 'Uploaded image',
      caption:
        typeof asset.caption === 'string' && asset.caption.trim().length > 0
          ? asset.caption.trim()
          : undefined,
      sortOrder: typeof asset.sortOrder === 'number' ? asset.sortOrder : 0,
    };
  }

  if (fallback?.imageUrl) {
    return {
      imageUrl: fallback.imageUrl,
      imageId: fallback.imageId,
      assetFingerprint: fallback.assetFingerprint,
      alt: 'Uploaded image',
      sortOrder: 0,
    };
  }

  return undefined;
};

export const normalizeGallery = (value: unknown): IMediaAsset[] => {
  return normalizeGalleryExcludingCover(value);
};

const isSameMediaAsset = (left: IMediaAsset, right: IMediaAsset) => {
  if (left.imageId && right.imageId && left.imageId === right.imageId) {
    return true;
  }

  if (
    left.assetFingerprint &&
    right.assetFingerprint &&
    left.assetFingerprint === right.assetFingerprint
  ) {
    return true;
  }

  return left.imageUrl === right.imageUrl;
};

export const normalizeGalleryExcludingCover = (
  value: unknown,
  coverImage?: IMediaAsset
): IMediaAsset[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const assets: IMediaAsset[] = [];

  value.forEach((item, index) => {
    const asset = normalizeMediaAsset(item);
    if (!asset) {
      return;
    }

    assets.push({
      ...asset,
      sortOrder: typeof asset.sortOrder === 'number' ? asset.sortOrder : index,
    });
  });

  const uniqueGallery: IMediaAsset[] = [];

  for (const asset of assets) {
    if (coverImage && isSameMediaAsset(asset, coverImage)) {
      continue;
    }

    if (uniqueGallery.some((existingAsset) => isSameMediaAsset(existingAsset, asset))) {
      continue;
    }

    uniqueGallery.push(asset);
  }

  return uniqueGallery.map((asset, index) => ({
    ...asset,
    sortOrder: index,
  }));
};

export const normalizeSections = (value: unknown): IContentSection[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return undefined;
      }

      const section = item as Record<string, unknown>;
      const heading = typeof section.heading === 'string' ? section.heading.trim() : '';
      if (!heading) {
        return undefined;
      }

      const style =
        section.style === 'callout' || section.style === 'checklist'
          ? section.style
          : 'default';

      const items = Array.isArray(section.items)
        ? section.items.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [];

      return {
        heading,
        style,
        bodyHtml: typeof section.bodyHtml === 'string' ? section.bodyHtml : '',
        items,
      } as IContentSection;
    })
    .filter((section): section is IContentSection => Boolean(section));
};

export const normalizeSchedule = (value: unknown): IEventScheduleItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return undefined;
      }

      const scheduleItem = item as Record<string, unknown>;
      const label = typeof scheduleItem.label === 'string' ? scheduleItem.label.trim() : '';
      const title = typeof scheduleItem.title === 'string' ? scheduleItem.title.trim() : '';
      if (!label || !title) {
        return undefined;
      }

      return {
        label,
        title,
        description:
          typeof scheduleItem.description === 'string' && scheduleItem.description.trim().length > 0
            ? scheduleItem.description.trim()
            : undefined,
      } as IEventScheduleItem;
    })
    .filter((item): item is IEventScheduleItem => Boolean(item));
};
