const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
require("dotenv").config();

// Cấu hình AWS S3
const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

// Cấu hình Multer để upload file lên S3
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      let folder = "others";

      if (file.mimetype.startsWith("image/")) {
        folder = "images";
      } else if (file.mimetype.startsWith("audio/")) {
        folder = "lessons";
      }

      const filePath = `${folder}/${Date.now()}-${file.originalname}`;
      cb(null, `lessons/${Date.now()}-${file.originalname}`);
    },
  }),
});

const uploadFields = upload.fields([
  { name: "mp3", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

async function getPresignedUrl(mp3Key) {
  if (!mp3Key) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: mp3Key,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

const enrollmentController = {
  // Enroll in a course/topic
  async enrollTopic(req, res) {
    try {
      console.log("📌 Request body received in backend:", req.body);

      if (!req.body || !req.body.topicId) {
        console.log("❌ Missing topicId");
        return res
          .status(400)
          .json({ message: "Missing topicId in request body" });
      }

      const { topicId } = req.body;
      const userId = req.user.id;
      console.log("✅ User ID:", userId);

      // Get the topic with its image
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
      });

      if (!topic) {
        console.log("❌ Topic not found");
        return res.status(404).json({ message: "Topic not found" });
      }

      // Process the image URL
      if (topic.image && topic.image.startsWith("https://")) {
        const url = new URL(topic.image);
        const imageKey = decodeURIComponent(url.pathname.substring(1));
        topic.image = await getPresignedUrl(imageKey);
      }

      // Kiểm tra xem người dùng đã đăng ký chưa
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { topic_id: topicId, user_id: userId },
      });

      if (existingEnrollment) {
        console.log("❌ User already enrolled in this topic");
        return res.status(400).json({
          message: "Already enrolled in this topic",
          topic: topic,
        });
      }

      // Lấy bài học đầu tiên của topic
      const firstLesson = await prisma.lessonTopic.findFirst({
        where: { topic_id: topicId },
      });

      if (!firstLesson) {
        console.log("❌ No lessons found for this topic");
        return res
          .status(404)
          .json({ message: "No lessons found for this topic" });
      }

      // Tạo bản ghi enrollment
      const enrollment = await prisma.enrollment.create({
        data: {
          topic_id: topicId,
          user_id: userId,
          current: firstLesson.id,
          progress: 0,
        },
      });

      // Lấy tất cả bài học trong topic
      const topicLessons = await prisma.lessonTopic.findMany({
        where: { topic_id: topicId },
      });

      // Tạo lesson progress cho từng bài học
      await prisma.lessonProgress.createMany({
        data: topicLessons.map((lesson) => ({
          enrollment_id: enrollment.id,
          lesson_id: lesson.id,
          completed: false,
        })),
      });

      // Return both the enrollment and the topic with processed image
      res.status(201).json({
        enrollment: enrollment,
        topic: topic,
      });
    } catch (error) {
      console.error("Error in enrollTopic:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  // Get user's enrolled topics with progress
  async getUserEnrollments(req, res) {
    try {
      const userId = req.user.id;
      console.log("Fetching enrollments for user:", userId);

      // Xử lý topic_id từ params thay vì query
      const topic_id = req.params.topic_id
        ? parseInt(req.params.topic_id)
        : null;

      // Nếu có topic_id, kiểm tra topic có tồn tại không
      if (topic_id) {
        const topicExists = await prisma.topic.findUnique({
          where: { id: topic_id },
        });

        if (!topicExists) {
          return res.status(404).json({
            message: "Cannot find topic by ID",
          });
        }
      }

      let whereCondition = { user_id: userId };
      if (topic_id) {
        whereCondition.topic_id = topic_id;
      }

      console.log("Where condition:", whereCondition);

      const enrollments = await prisma.enrollment.findMany({
        where: whereCondition,
        include: {
          topic: {
            select: {
              topic_name: true,
              description: true,
              image: true,
              level: true,
            },
          },
          lessonProgress: {
            include: {
              lesson: true,
            },
          },
        },
      });

      console.log("Enrollments found:", enrollments.length);

      // Lọc các khóa học hợp lệ
      const validEnrollments = enrollments.filter((e) => e.topic !== null);
      console.log("Valid enrollments:", validEnrollments.length);

      // Process images for each enrollment's topic
      const processedEnrollments = await Promise.all(
        validEnrollments.map(async (enrollment) => {
          // Make a copy to avoid modifying the original object
          const processed = { ...enrollment };

          // Process the topic image if it exists
          if (
            processed.topic &&
            processed.topic.image &&
            processed.topic.image.startsWith("https://")
          ) {
            const url = new URL(processed.topic.image);
            const imageKey = decodeURIComponent(url.pathname.substring(1));
            processed.topic.image = await getPresignedUrl(imageKey);
          }

          return processed;
        })
      );

      res.json(processedEnrollments);
    } catch (error) {
      console.error("Error in getUserEnrollments:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }
  },
};

module.exports = enrollmentController;
