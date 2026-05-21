import { v2 as cloudinary } from 'cloudinary';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import streamifier from 'streamifier';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload only images.'));
    }
  },
});

/**
 * Upload image to Cloudinary
 * @param buffer File buffer
 * @param folder Folder name in Cloudinary
 * @returns Promise with upload result
 */
export const uploadToCloudinary = (buffer: Buffer, folder: string = 'cict-crm'): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Middleware to handle image upload to Cloudinary
 */
export const handleImageUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next();
    }

    const result = await uploadToCloudinary(req.file.buffer);
    
    // Attach Cloudinary URL to request body
    req.body.imageUrl = result.secure_url;
    req.body.imageId = result.public_id;
    
    next();
  } catch (error) {
    logger.error('Image upload middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Image upload failed',
    });
  }
};

/**
 * Delete image from Cloudinary
 * @param publicId Cloudinary public ID
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    if (!publicId) {return;}
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error(`Failed to delete image ${publicId} from Cloudinary:`, error);
  }
};
