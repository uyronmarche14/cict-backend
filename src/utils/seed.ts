import mongoose from 'mongoose';
import '../config/loadEnv';
import User from '../models/User';
import Role from '../models/Role';
import News from '../models/News';
import Announcement from '../models/Announcement';
import Organization from '../models/Organization';
import { UserRole, Permission, NewsStatus, AnnouncementPriority, AnnouncementType } from '../types';
import logger from '../utils/logger';
import { validateEnv } from '../config/validateEnv';

const seedDatabase = async () => {
  try {
    validateEnv();

    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI is required');
    }
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
          Permission.VIEW_EVENT,
          Permission.CREATE_EVENT,
          Permission.EDIT_EVENT,
          Permission.PUBLISH_EVENT,
          Permission.CANCEL_EVENT,
          Permission.COMPLETE_EVENT,
          Permission.VIEW_ORGANIZATION,
          Permission.CREATE_ORGANIZATION,
          Permission.EDIT_ORGANIZATION,
          Permission.VIEW_ROLE,
        ],
        isSystemRole: true,
      },
      {
        name: 'Member Manager',
        description: 'Can manage members and view content',
        permissions: [
          Permission.CREATE_MEMBER,
          Permission.EDIT_MEMBER,
          Permission.DELETE_MEMBER,
          Permission.VIEW_MEMBER,
          Permission.VIEW_NEWS,
          Permission.VIEW_ANNOUNCEMENT,
          Permission.VIEW_EVENT,
          Permission.VIEW_ORGANIZATION,
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
          Permission.VIEW_EVENT,
          Permission.VIEW_ORGANIZATION,
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
          bodyHtml: '<p>The College of Information and Communication Technology successfully hosted its Annual Hackathon 2024...</p>',
          imageUrl: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          coverImage: {
            imageUrl: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
            alt: 'CICT Hackathon 2024',
          },
          status: NewsStatus.PUBLISHED,
          author: admin._id,
          tags: ['Hackathon', 'Innovation', 'Competition'],
          publishedAt: new Date('2024-03-15'),
        },
        {
          title: 'CICT Faculty Receives National Research Excellence Award',
          excerpt: 'Professor John Doe recognized for groundbreaking work in AI.',
          content: 'Professor John Doe from the Computer Science department has been awarded...',
          bodyHtml: '<p>Professor John Doe from the Computer Science department has been awarded...</p>',
          imageUrl: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
          coverImage: {
            imageUrl: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
            alt: 'Research excellence award',
          },
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
          bodyHtml: '<p>The midterm examinations for the Second Semester AY 2023-2024 will be held from April 15-19, 2024.</p>',
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
          bodyHtml: '<p>The student portal will be undergoing scheduled maintenance on Saturday, March 23, from 10:00 PM to 2:00 AM.</p>',
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

    // Create Organizations
    const orgCount = await Organization.countDocuments();
    if (orgCount === 0) {
      const orgData = [
        {
          id: 'ict-sf',
          name: 'ICT-SF',
          fullName: 'ICT Student Forum',
          description: 'The premier student organization for all ICT students.',
          longDescription: 'The ICT Student Forum serves as the umbrella organization for the College of ICT, representing the student body and organizing college-wide events.',
          logo: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg', // Placeholder
          banner: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          established: '2010',
          mission: 'To empower ICT students through holistic development and representation.',
          vision: 'To be the leading student organization fostering innovation and leadership.',
          values: ['Leadership', 'Service', 'Excellence'],
          achievements: ['Best Student Council 2023'],
          members: [
            {
              id: '1',
              name: 'John Doe',
              position: 'President',
              photo: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
              bio: 'A passionate leader dedicated to serving the student body.',
              joinedDate: '2022',
            }
          ],
          color: {
            primary: '#6e29f6',
            secondary: '#f629a8',
            accent: '#29f6d2',
          },
        },
        {
          id: 'css',
          name: 'CSS',
          fullName: 'Computer Science Society',
          description: 'The academic organization for Computer Science students.',
          longDescription: 'CSS promotes academic excellence and technological advancement in the field of Computer Science.',
          logo: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
          banner: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          established: '2012',
          mission: 'To advance computer science education and practice.',
          vision: 'A community of world-class computer scientists.',
          values: ['Innovation', 'Logic', 'Creativity'],
          achievements: ['National Coding Champions 2024'],
          members: [],
          color: {
            primary: '#2563eb',
            secondary: '#60a5fa',
            accent: '#fbbf24',
          },
        },
        {
          id: 'iss',
          name: 'ISS',
          fullName: 'Information Systems Society',
          description: 'Bridging technology and business.',
          longDescription: 'ISS focuses on the strategic application of technology in business environments.',
          logo: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
          banner: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          established: '2013',
          mission: 'To develop business-savvy technology professionals.',
          vision: 'Leaders in information systems management.',
          values: ['Integrity', 'Strategy', 'Synergy'],
          achievements: [],
          members: [],
          color: {
            primary: '#059669',
            secondary: '#34d399',
            accent: '#fcd34d',
          },
        },
        {
          id: 'best',
          name: 'BEST',
          fullName: 'Board of European Students of Technology',
          description: 'Connecting students across Europe (and beyond).',
          longDescription: 'BEST provides complementary education and international opportunities.',
          logo: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
          banner: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          established: '2015',
          mission: 'Developing students through international cooperation.',
          vision: 'Empowered diversity.',
          values: ['Fun', 'Friendship', 'Improvement'],
          achievements: [],
          members: [],
          color: {
            primary: '#7c3aed',
            secondary: '#a78bfa',
            accent: '#c4b5fd',
          },
        },
         {
          id: 'robotcu',
          name: 'RobotCU',
          fullName: 'Robotics Club University',
          description: 'Innovating the future through robotics.',
          longDescription: 'RobotCU is dedicated to the field of robotics and automation.',
          logo: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1756660320/cict4_qqksfh.jpg',
          banner: 'https://res.cloudinary.com/ddnxfpziq/image/upload/v1755790148/529718384_122100992648966778_7029427848362639164_n_geskab.jpg',
          established: '2016',
          mission: 'To build the future, one robot at a time.',
          vision: 'Pioneering robotics innovation.',
          values: ['Innovation', 'Precision', 'Teamwork'],
          achievements: ['RoboCup 2023 Finalists'],
          members: [],
          color: {
            primary: '#dc2626',
            secondary: '#ef4444',
            accent: '#fee2e2',
          },
        },
      ];

      await Organization.insertMany(orgData);
      logger.info('✅ Organizations seeded');
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
