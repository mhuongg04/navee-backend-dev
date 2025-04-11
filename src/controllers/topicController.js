const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
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
            cb(null, filePath);
        }
    })
});

const uploadFields = upload.fields([
    { name: "mp3", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "mp3_prac", maxCount: 1 }
]);

const deleteS3File = async (bucket, filePath) => {
    try {
        const deleteParams = {
            Bucket: bucket,
            Key: filePath
        };

        await s3.send(new DeleteObjectCommand(deleteParams));
        //console.log(`Đã xóa file: ${filePath}`);
    } catch (error) {
        console.error("Lỗi khi xóa file:", error);
    }
}

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
            //console.log(error);
            response.status(500).json({ error: "Fetch all topics failed" });
        }
    },

    //Tìm khóa học theo level
    async getTopicByLevel(request, response) {
        const { level } = request.query;
        //console.log(level);
        try {
            const filteredTopics = await prisma.topic.findMany({
                where: {
                    level: level,
                }
            });
            const listTopic = await Promise.all(
                filteredTopics.map(async (topic) => {
                    if (topic.image && topic.image.startsWith("https://")) {
                        const url = new URL(topic.image);
                        const imageKey = decodeURIComponent(url.pathname.substring(1));
                        topic.image = await getPresignedUrl(imageKey);
                    }
                    return topic;
                })
            );
            response.send({ data: listTopic }).status(200);
        }
        catch (error) {
            // console.log(error);
            response.status(500).json({ error: "Fetch topics by Level failed" })
        }
    },

    //Tìm topic theo ID
    async getTopicById(request, response) {
        const { topic_id } = request.params;

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
            //console.log(my_topic, my_topic_final)

            response.status(200).json({ data: my_topic_final });
        }

        catch (error) {
            //console.error("Không thể tìm topic", error);
            response.status(500).json({ message: "Cannot find topic by ID", error });
        }
    },

    //Tìm khóa học theo tên
    async getTopicByName(request, response) {
        const { topicName } = request.query;
        //console.log(topicName);

        try {
            const filteredTopics = await prisma.topic.findMany({
                where: {
                    topic_name: {
                        contains: topicName,
                        mode: 'insensitive'
                    }
                }
            });
            const listTopic = await Promise.all(
                filteredTopics.map(async (topic) => {
                    if (topic.image && topic.image.startsWith("https://")) {
                        const url = new URL(topic.image);
                        const imageKey = decodeURIComponent(url.pathname.substring(1));
                        topic.image = await getPresignedUrl(imageKey);
                    }
                    return topic;
                })
            );

            response.status(200).json({ message: "Found topics by name successfully", data: listTopic });
        }
        catch (error) {
            response.status(500).json({ message: "Cound't find topics by name" });
        }
    },

    //Tạo mới khóa học
    async createTopic(request, response) {

        uploadFields(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            const imageUrl = request.files["image"] ? request.files["image"][0].location : null;
            const { topic_name, description, level } = request.body;

            console.log(topic_name, description, imageUrl, level)
            try {
                const new_topic = await prisma.topic.create({
                    data: { topic_name, description, image: imageUrl, level }
                });

                response.status(200).json({ data: new_topic });
            }
            catch (error) {
                //console.error("Không thể tạo mới khóa học", error);
                response.status(500).json({ message: "Cannot create new topic", error });
            }
        });
    },

    //Sửa khóa học
    async editTopic(request, response) {

        uploadFields(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            const { topic_id } = request.params;
            const { topic_name, description, level } = request.body
            const imageUrl = request.files["image"] ? request.files["image"][0].location : null;


            //console.log("Thông tin khóa học cần sửa: ", topic_id, topic_name, description, level, imageUrl)
            try {
                const curTopic = await prisma.topic.findUnique({
                    where: {
                        id: topic_id
                    }
                })

                //console.log(curTopic)

                if (imageUrl && curTopic.image && /^https?:\/\/.+/.test(curTopic.image)) {
                    const imagePath = curTopic.image.split(".amazonaws.com/")[1];
                    await deleteS3File(process.env.S3_BUCKET_NAME, imagePath);
                }

                const updateTopic = await prisma.topic.update({
                    where: {
                        id: topic_id
                    },
                    data: {
                        topic_name: topic_name,
                        description: description,
                        image: imageUrl ?? curTopic.image,
                        level: level
                    }
                });

                response.status(200).json({ message: "Updated topic successfully", data: updateTopic })
            }
            catch (error) {
                response.status(500).json({ message: "Updated topic failed", error })
            }
        });

    },

    //Xóa khóa học
    async deleteTopic(request, response) {
        const { topic_id } = request.params;

        try {
            //console.log("Cần xóa khóa học: ", topic_id)
            const topicDelete = await prisma.topic.findUnique({
                where: {
                    id: topic_id
                }
            });
            //console.log("Cần xóa khóa học: ", topicDelete)
            if (!topicDelete) {
                return response.status(404).json({ message: "Topic không tồn tại" });
            }

            //console.log("Image url", topicDelete.image);
            if (topicDelete.image && /^https?:\/\/.+/.test(topicDelete.image)) {
                const imagePath = topicDelete.image.split(".amazonaws.com/")[1];
                await deleteS3File(process.env.S3_BUCKET_NAME, imagePath);
            }

            await prisma.topic.delete({
                where: {
                    id: topic_id
                }
            })
            response.status(200).json({ message: "Deleted topic successfully" })
        }
        catch (error) {
            response.status(500).json({ message: "Deleted topic failed!!" })
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
            //console.error("Lỗi khi lấy dữ liệu lesson:", error);
            response.status(500).json({ error: "Không thể lấy dữ liệu bài học" });
        }
    },


    //Tạo mới khóa học
    async createLesson(request, response) {
        uploadFields(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            const { topic_id, title, description, part, des_prac } = request.body;
            const mp3Url = request.files["mp3"] ? request.files["mp3"][0].location : null;
            const mp3PracUrl = request.files["mp3_prac"] ? request.files["mp3_prac"][0].location : null;
            const imageUrl = request.files["image"] ? request.files["image"][0].location : null;

            try {
                const newLesson = await prisma.lesson.create({
                    data: { title, description, image: imageUrl, mp3: mp3Url, part: parseInt(part), mp3_prac: mp3PracUrl, des_prac }
                });

                const newLessonTopic = await prisma.lessonTopic.create({
                    data: { topic_id, lesson_id: newLesson.id }
                });

                response.status(201).json({ message: "Lesson created successfully", lesson: newLesson, lessonTopic: newLessonTopic });
            } catch (error) {
                response.status(500).json({ message: "Error creating lesson", error });
            }
        });
    },

    //Sửa bài học
    async editLesson(request, response) {

        uploadFields(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            const { lesson_id } = request.params;
            const { title, description, part, des_prac } = request.body
            const mp3Url = request.files["mp3"] ? request.files["mp3"][0].location : null;
            const mp3PracUrl = request.files["mp3_prac"] ? request.files["mp3_prac"][0].location : null;
            const imageUrl = request.files["image"] ? request.files["image"][0].location : null;

            // console.log("Sửa khóa học", lesson_id, title, description, part, des_prac);
            // console.log("url: ", mp3Url, mp3PracUrl, imageUrl);

            try {
                const curLesson = await prisma.lesson.findUnique({
                    where: {
                        id: lesson_id
                    }
                })

                //console.log(curLesson)

                if (imageUrl && curLesson.image && /^https?:\/\/.+/.test(curLesson.image)) {
                    const imagePath = curLesson.image.split(".amazonaws.com/")[1];
                    await deleteS3File(process.env.S3_BUCKET_NAME, imagePath);
                }
                if (mp3Url && curLesson.mp3 && /^https?:\/\/.+/.test(curLesson.mp3)) {
                    const mp3Path = curLesson.mp3.split(".amazonaws.com/")[1];
                    await deleteS3File(process.env.S3_BUCKET_NAME, mp3Path);
                }
                if (mp3PracUrl && curLesson.mp3_prac && /^https?:\/\/.+/.test(curLesson.mp3_prac)) {
                    const mp3PracPath = curLesson.mp3_prac.split(".amazonaws.com/")[1];
                    await deleteS3File(process.env.S3_BUCKET_NAME, mp3PracPath);
                }

                const updateLesson = await prisma.lesson.update({
                    where: {
                        id: lesson_id
                    },
                    data: {
                        title: title,
                        description: description,
                        image: imageUrl ?? curLesson.image,
                        part: parseInt(part),
                        des_prac: des_prac,
                        mp3: mp3PracUrl ?? curLesson.mp3,
                        mp3_prac: mp3PracUrl ?? curLesson.mp3_prac
                    }
                });

                response.status(200).json({ message: "Updated lesson successfully", data: updateLesson })
            }
            catch (error) {
                response.status(500).json({ message: "Updated lesson failed", error })
            }
        });

    },

    //Xóa bài học
    async deleteLesson(request, response) {
        const { lesson_id } = request.params;

        try {
            //console.log(lesson_id)
            const lessonDelete = await prisma.lesson.findUnique({
                where: {
                    id: lesson_id
                }
            });

            //console.log(lessonDelete)

            const lessonTopicExists = await prisma.lessonTopic.findFirst({
                where: { lesson_id: lesson_id }
            });

            if (lessonTopicExists) {
                await prisma.lessonTopic.deleteMany({
                    where: { lesson_id: lesson_id }
                });
            }

            const lessonEx = await prisma.exercise.findFirst({
                where: {
                    lesson_id: lesson_id
                }
            })

            if (lessonEx) {
                await prisma.exercise.deleteMany({
                    where: { lesson_id: lesson_id }
                });
            }

            if (!lessonDelete) {
                return response.status(404).json({ message: "Lesson không tồn tại" });
            }

            if (lessonDelete.image && /^https?:\/\/.+/.test(lessonDelete.image)) {
                const imagePath = lessonDelete.image.split(".amazonaws.com/")[1];
                await deleteS3File(process.env.S3_BUCKET_NAME, imagePath);
            }

            if (lessonDelete.mp3 && /^https?:\/\/.+/.test(lessonDelete.mp3)) {
                const mp3Path = lessonDelete.mp3.split(".amazonaws.com/")[1];
                await deleteS3File(process.env.S3_BUCKET_NAME, mp3Path);
            }

            if (lessonDelete.mp3_prac && /^https?:\/\/.+/.test(lessonDelete.mp3_prac)) {
                const mp3PracPath = lessonDelete.mp3_prac.split(".amazonaws.com/")[1];
                await deleteS3File(process.env.S3_BUCKET_NAME, mp3PracPath);
            }

            //console.log(lessonDelete.id)
            await prisma.lesson.delete({
                where: { id: lessonDelete.id }
            })
            //console.log("Xóa thành công")
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
            //console.error("Không thể lấy dữ liệu", error)
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
            let mp3KeyPrac = lesson.mp3_prac;
            if (mp3Key.startsWith("https://")) {
                const url1 = new URL(mp3Key);
                mp3Key = decodeURIComponent(url1.pathname.substring(1));
            }

            if (mp3KeyPrac.startsWith("https://")) {
                const url2 = new URL(mp3KeyPrac);
                mp3KeyPrac = decodeURIComponent(url2.pathname.substring(1));
            }

            const signedMp3Url = await getPresignedUrl(mp3Key);
            const signMp3PracUrl = await getPresignedUrl(mp3KeyPrac);

            let imageKey = lesson.image;
            if (imageKey && imageKey.startsWith("https://")) {
                const url = new URL(imageKey);
                imageKey = decodeURIComponent(url.pathname.substring(1));
            }
            const signedImageUrl = imageKey ? await getPresignedUrl(imageKey) : null;

            response.status(200).json({ ...lesson, image: signedImageUrl, mp3: signedMp3Url, mp3_prac: signMp3PracUrl })
        } catch (error) {
            //console.error("Không thể tìm bài học", error);
            response.status(500).json({ message: "Cannot fetch lesson by lesson ID", error });
        }
    },

    async getLessonNameById(request, response) {
        const { lesson_id } = request.params;
        try {
            const myLesson = await prisma.lesson.findUnique({
                where: {
                    id: lesson_id
                }
            })
            response.status(200).json({ message: "Fetch lesson name by ID successfully", data: myLesson.title })
        }
        catch (e) {
            response.status(500).json({ message: "Cannot fetch lesson's name by ID", e })
        }
    },


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