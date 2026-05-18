import { Request, Response } from 'express';
import { uploadToCloudinary } from '../middleware/upload';
import { AppError } from '../middleware/errorHandler';
import { createMediaAssetFingerprint } from '../utils/mediaFingerprint';

export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (files.length === 0) {
    throw new AppError('At least one image is required', 400);
  }

  const images = await Promise.all(
    files.map(async (file, index) => {
      const result = await uploadToCloudinary(file.buffer);
      const assetFingerprint = createMediaAssetFingerprint(file.buffer);

      return {
        imageUrl: result.secure_url,
        imageId: result.public_id,
        assetFingerprint,
        alt: file.originalname.replace(/\.[^.]+$/, ''),
        caption: '',
        sortOrder: index,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      images,
    },
  });
};
