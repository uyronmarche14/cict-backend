import { Response } from 'express';
import FAQContent from '../models/FAQContent';
import { AuthRequest } from '../middleware/auth';
import { IFAQEntry, IFAQTopic } from '../types';

const FAQ_CONTENT_KEY = 'landing';

const DEFAULT_FAQ_CONTENT = {
  key: FAQ_CONTENT_KEY,
  title: 'Frequently Asked Questions',
  subtitle: 'Find answers to common questions about CICT',
  topics: [
    { id: 'admission', label: 'Admission & Enrollment' },
    { id: 'programs', label: 'Programs & Courses' },
    { id: 'campus', label: 'Campus Life' },
    { id: 'resources', label: 'Student Resources' },
    { id: 'career', label: 'Career Services' },
    { id: 'support', label: 'Academic Support' },
  ] satisfies IFAQTopic[],
  questions: [
    {
      category: 'admission',
      question: 'What are the admission requirements for CICT?',
      answer:
        'CICT requires a high school diploma or equivalent, passing the entrance examination, and submission of required documents including transcript of records and certificate of good moral character.',
    },
    {
      category: 'admission',
      question: 'When is the enrollment period?',
      answer:
        'Enrollment periods are typically June-July for the first semester, November-December for the second semester, and April-May for summer classes. Check our official announcements for exact dates.',
    },
    {
      category: 'programs',
      question: 'What programs does CICT offer?',
      answer:
        'CICT offers Bachelor of Science in Information Technology, Bachelor of Science in Computer Science, Bachelor of Science in Information Systems, and various diploma and certificate programs.',
    },
    {
      category: 'programs',
      question: 'What are the specializations available?',
      answer:
        'Students can specialize in areas such as Software Engineering, Network Administration, Database Management, Cybersecurity, Mobile Development, and Artificial Intelligence.',
    },
    {
      category: 'campus',
      question: 'What facilities are available on campus?',
      answer:
        'Our campus features modern computer laboratories, a digital library, collaborative workspaces, student lounges, cafeteria, and high-speed internet throughout the campus.',
    },
    {
      category: 'campus',
      question: 'Are there student organizations?',
      answer:
        'Yes! CICT has various student organizations including the CICT Student Council, programming clubs, cybersecurity groups, and special interest organizations for different tech fields.',
    },
    {
      category: 'resources',
      question: 'What learning resources are available?',
      answer:
        'Students have access to online learning platforms, software licenses, development tools, e-books, research databases, and 24/7 technical support for all campus systems.',
    },
    {
      category: 'resources',
      question: 'Is there Wi-Fi on campus?',
      answer:
        'Yes, CICT provides free high-speed Wi-Fi throughout the campus including classrooms, library, cafeteria, and outdoor areas. Students get dedicated login credentials upon enrollment.',
    },
    {
      category: 'career',
      question: 'What career opportunities are available after graduation?',
      answer:
        'Graduates pursue careers as Software Developers, System Analysts, Network Engineers, Cybersecurity Specialists, Database Administrators, IT Consultants, and Digital Innovation Leaders.',
    },
    {
      category: 'career',
      question: 'Does CICT offer job placement assistance?',
      answer:
        'Yes! Our Career Services Office provides job placement assistance, resume workshops, interview preparation, industry partnerships, and regular job fairs with top tech companies.',
    },
  ] satisfies IFAQEntry[],
};

const buildFAQPayload = (body: Record<string, unknown>) => ({
  title: typeof body.title === 'string' ? body.title.trim() : DEFAULT_FAQ_CONTENT.title,
  subtitle:
    typeof body.subtitle === 'string' ? body.subtitle.trim() : DEFAULT_FAQ_CONTENT.subtitle,
  topics: Array.isArray(body.topics)
    ? body.topics.map((topic) => ({
        id: typeof topic?.id === 'string' ? topic.id.trim() : '',
        label: typeof topic?.label === 'string' ? topic.label.trim() : '',
      }))
    : DEFAULT_FAQ_CONTENT.topics,
  questions: Array.isArray(body.questions)
    ? body.questions.map((question) => ({
        category: typeof question?.category === 'string' ? question.category.trim() : '',
        question: typeof question?.question === 'string' ? question.question.trim() : '',
        answer: typeof question?.answer === 'string' ? question.answer.trim() : '',
      }))
    : DEFAULT_FAQ_CONTENT.questions,
});

export const getFAQContent = async (_req: AuthRequest, res: Response): Promise<void> => {
  const faqContent = await FAQContent.findOne({ key: FAQ_CONTENT_KEY }).lean();

  res.status(200).json({
    success: true,
    data: faqContent ?? DEFAULT_FAQ_CONTENT,
  });
};

export const upsertFAQContent = async (req: AuthRequest, res: Response): Promise<void> => {
  const payload = buildFAQPayload(req.body);
  const faqContent = await FAQContent.findOneAndUpdate(
    { key: FAQ_CONTENT_KEY },
    {
      $set: payload,
      $setOnInsert: { key: FAQ_CONTENT_KEY },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    message: 'FAQ content updated successfully',
    data: faqContent,
  });
};
