import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Role from '../models/Role';
import News from '../models/News';
import Announcement from '../models/Announcement';
import { UserRole, Permission, NewsStatus, AnnouncementPriority, AnnouncementType } from '../types';
import logger from '../utils/logger';

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cict-crm';
    await mongoose.connect(mongoURI);
    logger.info('Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await User.deleteMany({});
    // await Role.deleteMany({});
    // logger.info('Cleared existing data');

    // Create default admin user
    const adminEmail = 'admin@cict.edu';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const admin = await User.create({
        email: adminEmail,
        password: 'Admin@123456', // Change this in production!
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.FULL_ADMIN,
        isActive: true,
      });
      logger.info(`✅ Default admin created: ${admin.email}`);
      logger.info(`   Password: Admin@123456 (CHANGE THIS!)`);
    } else {
      logger.info('Admin user already exists');
    }

    // Create system roles with default permissions
    const systemRoles = [
      {
        name: 'Content Manager',
        description: 'Can manage news and announcements',
        permissions: [
          Permission.CREATE_NEWS,
          Permission.EDIT_NEWS,
          Permission.DELETE_NEWS,
          Permission.PUBLISH_NEWS,
          Permission.ARCHIVE_NEWS,
          Permission.VIEW_NEWS,
          Permission.CREATE_ANNOUNCEMENT,
          Permission.EDIT_ANNOUNCEMENT,
          Permission.DELETE_ANNOUNCEMENT,
          Permission.PUBLISH_ANNOUNCEMENT,
          Permission.ARCHIVE_ANNOUNCEMENT,
          Permission.VIEW_ANNOUNCEMENT,
        ],
        isSystemRole: true,
      },
      {
        name: 'Member Manager',
        description: 'Can manage members and view content',
        permissions: [
          Permission.CREATE_MEMBER,
          Permission.EDIT_MEMBER,
          Permission.VIEW_MEMBER,
          Permission.VIEW_NEWS,
          Permission.VIEW_ANNOUNCEMENT,
        ],
        isSystemRole: true,
      },
      {
        name: 'Viewer',
        description: 'Can only view content',
        permissions: [
          Permission.VIEW_NEWS,
          Permission.VIEW_ANNOUNCEMENT,
          Permission.VIEW_MEMBER,
        ],
        isSystemRole: true,
      },
    ];

    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      logger.error('Admin user not found');
      process.exit(1);
    }

    for (const roleData of systemRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (!existingRole) {
        const role: any = await Role.create({
          ...roleData,
          createdBy: admin._id,
        } as any);
        logger.info(`✅ System role created: ${role.name}`);
      } else {
        logger.info(`System role already exists: ${roleData.name}`);
      }
    }

    // Create News and Announcements
    const newsCount = await News.countDocuments();
    if (newsCount === 0) {
      const newsData = [
        {
          title: 'CICT Hosts Annual Hackathon 2024',
          excerpt: 'Over 200 students participated in the biggest coding competition of the year.',
          content: 'The College of Information and Communication Technology successfully hosted its Annual Hackathon 2024...',
          imageUrl: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          status: NewsStatus.PUBLISHED,
          author: admin._id,
          tags: ['Hackathon', 'Innovation', 'Competition'],
          publishedAt: new Date('2024-03-15'),
        },
        {
          title: 'CICT Faculty Receives National Research Excellence Award',
          excerpt: 'Professor John Doe recognized for groundbreaking work in AI.',
          content: 'Professor John Doe from the Computer Science department has been awarded...',
          imageUrl: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
          status: NewsStatus.PUBLISHED,
          author: admin._id,
          tags: ['Research', 'Award', 'AI'],
          publishedAt: new Date('2024-03-10'),
        },
      ];

      await News.insertMany(newsData);
      logger.info('✅ News articles seeded');
    }

    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0) {
      const announcementData = [
        {
          title: 'Midterm Examination Schedule',
          content: 'The midterm examinations for the Second Semester AY 2023-2024 will be held from April 15-19, 2024.',
          priority: AnnouncementPriority.HIGH,
          type: AnnouncementType.ACADEMIC,
          status: NewsStatus.PUBLISHED,
          isActive: true,
          author: admin._id,
          targetAudience: ['All Students', 'Faculty'],
          publishedAt: new Date('2024-04-01'),
          expiresAt: new Date('2024-04-20'),
        },
        {
          title: 'System Maintenance Notice',
          content: 'The student portal will be undergoing scheduled maintenance on Saturday, March 23, from 10:00 PM to 2:00 AM.',
          priority: AnnouncementPriority.MEDIUM,
          type: AnnouncementType.GENERAL,
          status: NewsStatus.PUBLISHED,
          isActive: true,
          author: admin._id,
          targetAudience: ['All Users'],
          publishedAt: new Date('2024-03-20'),
          expiresAt: new Date('2024-03-24'),
        },
      ];

      await Announcement.insertMany(announcementData);
      logger.info('✅ Announcements seeded');
    }

    logger.info('🎉 Database seeding completed successfully!');
    logger.info('\n📝 Next steps:');
    logger.info('1. Change the default admin password');
    logger.info('2. Start the server with: pnpm dev');
    logger.info('3. Login with: admin@cict.edu / Admin@123456');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
