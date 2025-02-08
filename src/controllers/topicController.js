const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const { S3Client } = require("@aws-sdk/client-s3");
const { fromEnv } = require("@aws-sdk/credential-provider-env");
const multer = require("multer");
const multerS3 = require("multer-s3");
require("dotenv").config();

// Cấu hình AWS S3
const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
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
            const filePath = `lessons/${Date.now()}-${file.originalname}`;
            console.log("🟢 File Path:", filePath);
            cb(null, `lessons/${Date.now()}-${file.originalname}`);
        }
    })
}).single("mp3");

const TopicController = {

    //Tìm tất cả khóa học
    async getAllTopic(request, response) {
        try {
            const listTopic = await prisma.topic.findMany();
            response.status(200).send({ data: listTopic });
        }
        catch (error) {
            console.log(error);
            response.status(500).json({ error: "Fetch all topics failed" });
        }
    },

    //Tìm khóa học theo level
    async getTopicByLevel(request, response) {
        const { level } = request.body;
        try {
            const filteredTopics = await prisma.topic.findMany({
                where: {
                    level: level,
                }
            });
            response.send({ data: filteredTopics }).status(200);
        }
        catch (error) {
            console.log(error);
            response.status(500).json({ error: "Fetch topics by Level failed" })
        }
    },

    //Tạo mới khóa học
    async createTopic(request, response) {
        const { topic_name, description, image, level } = request.body;

        try {
            const new_topic = await prisma.topic.create({
                data: { topic_name, description, image, level }
            });

            response.status(200).json({ data: new_topic });
        }
        catch (error) {
            console.error("Không thể tạo mới khóa học", error);
            response.status(500).json({ message: "Cannot create new topic", error });
        }
    },

    //Tìm khóa học theo ID
    async getLessonByTopicId(request, response) {
        const { topic_id } = request.body;

        try {
            const topicLessons = await prisma.lessonTopic.findMany({
                where: { topic_id: topic_id },
                include: { lesson: true }
            });

            if (!topicLessons || topicLessons.length === 0) {
                return response.status(404).json({ error: "Không tìm thấy bài học nào cho topic này" });
            }

            response.status(200).json({ data: topicLessons.map(item => item.lesson) });
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu lesson:", error);
            response.status(500).json({ error: "Không thể lấy dữ liệu bài học" });
        }
    },


    //Tạo mới khóa học
    async createLesson(request, response) {
        upload(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            console.log(request.file)
            console.log(request.body)

            const { topic_id, title, description, image, part } = request.body;
            const mp3Url = request.file ? request.file.location : null;

            console.log(mp3Url)


            console.log(topic_id, title, description, image, part, mp3Url);

            try {
                const newLesson = await prisma.lesson.create({
                    data: { title, description, image, mp3: mp3Url, part: parseInt(part) }
                });

                console.log(newLesson.id)
                const newLessonTopic = await prisma.lessonTopic.create({
                    data: { topic_id, lesson_id: newLesson.id }
                });

                response.status(201).json({ message: "Lesson created successfully", lesson: newLesson, lessonTopic: newLessonTopic });
            } catch (error) {
                response.status(500).json({ message: "Error creating lesson", error: error.message });
            }
        });
    },


    //Tìm danh sách tất cả bài học
    async getAllLesson(request, response) {
        try {
            const lessons = await prisma.lesson.findMany();

            response.send({ data: lessons }).status(200);
        }

        catch (error) {
            console.error("Không thể lấy dữ liệu", error)
            response.status(500).json({ message: "Cannot fetch all lessons", error });
        }
    },

    //Mở một bài học
    // async getLesson(request, response) {
    //     const { lesson_id } = request.body
    //     try {
    //         let lesson = await prisma.lesson.findUnique({
    //             where: { id: lesson_id }
    //         });

    //         lesson.mp3 = createGetPresignedUrl(lesson.mp3)
    //     }
    //     catch (error) {
    //         console.error("Không thể tìm bài học", error);
    //         response.status(500).json({ message: "Cannot fetch lesson by lesson ID", error })
    //     }
    // },

    //Chỉnh sửa bài học


    //Đăng ký khóa học
    async enrollTopic(request, response) {
        const user_id = request.locals.user.id;
        const topic_id = request.body;
        try {
            const topic_enrollment = await prisma.topic.findUnique({
                where: {
                    topic_id: topic_id,
                    user_id: user_id
                }
            })
            if (topic_enrollment) {

            }
            const new_enrollment = prisma.topic.create({
                data: {
                    user_id,
                    topic_id,
                }
            });

            response.status(201).json({
                id: new_enrollment.id,
                user_id: new_enrollment.user_id,
                topic_id: topic_id
            })

        }
        catch (error) {
            response.status(400).json({ error: 'Enrolling failed' })
        }
    },

    //Tìm khóa học đã đăng ký
    async getEnrolledTopics(request, response) {
        const user_id = request.local.user.id;
        try {
            const enrolledTopics = await prisma.enrollment.findMany({
                where: {
                    user_id: user_id
                }
            })

            response.send({ data: enrolledTopics }).status(200);
        }
        catch (error) {
            response.status(500).json({ error: 'Fetch enrolled topics failed' })
        }
    }
}

module.exports = TopicController