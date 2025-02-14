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
            let folder = "others";

            if (file.mimetype.startsWith("image/")) {
                folder = "images";
            } else if (file.mimetype.startsWith("audio/")) {
                folder = "lessons";
            }

            const filePath = `${folder}/${Date.now()}-${file.originalname}`;
            cb(null, `lessons/${Date.now()}-${file.originalname}`);
        }
    })
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


const TopicController = {

    //Tìm tất cả khóa học
    async getAllTopic(request, response) {
        try {
            const topics = await prisma.topic.findMany();

            const listTopic = await Promise.all(
                topics.map(async (topic) => {
                    if (topic.image && topic.image.startsWith("https://")) {
                        const url = new URL(topic.image);
                        const imageKey = decodeURIComponent(url.pathname.substring(1));
                        topic.image = await getPresignedUrl(imageKey);
                    }
                    return topic;
                })
            );
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

    //Tìm topic theo ID
    async getTopicById(request, response) {
        const { topic_id } = request.params;

        console.log(topic_id)

        try {
            const my_topic = await prisma.topic.findUnique({
                where: { id: topic_id }
            });

            let imageKey = my_topic.image;
            if (imageKey && imageKey.startsWith("https://")) {
                const url = new URL(imageKey);
                imageKey = decodeURIComponent(url.pathname.substring(1));
            }

            const signedImageUrl = imageKey ? await getPresignedUrl(imageKey) : null;

            const my_topic_final = { ...my_topic, image: signedImageUrl }
            console.log(my_topic, my_topic_final)

            response.status(200).json({ data: my_topic_final });
        }

        catch (error) {
            console.error("Không thể tìm topic", error);
            response.status(500).json({ message: "Cannot find topic by ID", error });
        }
    },

    //Tạo mới khóa học
    async createTopic(request, response) {

        uploadFields(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            const imageUrl = request.files["image"] ? request.files["image"][0].location : null;
            const { topic_name, description, image, level } = request.body;

            try {
                const new_topic = await prisma.topic.create({
                    data: { topic_name, description, image: imageUrl, level }
                });

                response.status(200).json({ data: new_topic });
            }
            catch (error) {
                console.error("Không thể tạo mới khóa học", error);
                response.status(500).json({ message: "Cannot create new topic", error });
            }
        });
    },

    //Xóa khóa học
    async deleteTopic(request, response) {
        const { topic_id } = request.params;

        try {

        }
        catch (error) {

        }
    },

    //Tìm khóa học theo ID
    async getLessonByTopicId(request, response) {
        const { topic_id } = request.params;

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
        uploadFields(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            const { topic_id, title, description, part } = request.body;
            const mp3Url = request.files["mp3"] ? request.files["mp3"][0].location : null;
            const imageUrl = request.files["image"] ? request.files["image"][0].location : null;

            try {
                const newLesson = await prisma.lesson.create({
                    data: { title, description, image: imageUrl, mp3: mp3Url, part: parseInt(part) }
                });

                const newLessonTopic = await prisma.lessonTopic.create({
                    data: { topic_id, lesson_id: newLesson.id }
                });

                response.status(201).json({ message: "Lesson created successfully", lesson: newLesson, lessonTopic: newLessonTopic });
            } catch (error) {
                response.status(500).json({ message: "Error creating lesson", error: error.message });
            }
        });
    },

    //Xóa bài học
    async deleteLesson(request, response) {
        const { lesson_id } = request.params;

        try {
            await prisma.lesson.delete({
                where: { id: lesson_id }
            })
            await prisma.lessonTopic.delete({
                where: { lesson_id: lesson_id }
            })
            response.status(200).json({ message: "Deleting Lesson successful" })
        }
        catch (error) {
            response.status(404).json({ message: "Cannot delete lesson" })
        }
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

    // Mở một bài học
    async getLesson(request, response) {
        const { lesson_id } = request.params;

        try {
            let lesson = await prisma.lesson.findUnique({
                where: { id: lesson_id }
            });

            if (!lesson) {
                return response.status(404).json({ error: "Không tìm thấy bài học" });
            }

            let mp3Key = lesson.mp3;
            if (mp3Key.startsWith("https://")) {
                const url = new URL(mp3Key);
                mp3Key = decodeURIComponent(url.pathname.substring(1));
            }

            const signedMp3Url = await getPresignedUrl(mp3Key);

            let imageKey = lesson.image;
            if (imageKey && imageKey.startsWith("https://")) {
                const url = new URL(imageKey);
                imageKey = decodeURIComponent(url.pathname.substring(1));
            }
            const signedImageUrl = imageKey ? await getPresignedUrl(imageKey) : null;

            response.status(200).json({ ...lesson, image: signedImageUrl, mp3: signedMp3Url })
        } catch (error) {
            console.error("Không thể tìm bài học", error);
            response.status(500).json({ message: "Cannot fetch lesson by lesson ID", error });
        }
    },

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