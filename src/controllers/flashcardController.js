const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { sign } = require("jsonwebtoken");

require("dotenv").config();

const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
});

const upload = multer({
    storage: multerS3({
        s3,
        bucket: process.env.S3_BUCKET_NAME,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            cb(null, `vocabs/${Date.now()}-${file.originalname}`);
        }
    })
});

async function getPresignedUrl(mp3Key) {
    if (!mp3Key) return null;

    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: mp3Key,
    });

    return getSignedUrl(s3, command, { expiresIn: 3600 });
}

const deleteS3File = async (bucket, filePath) => {
    try {
        const deleteParams = {
            Bucket: bucket,
            Key: filePath
        };

        await s3.send(new DeleteObjectCommand(deleteParams));
        console.log(`Đã xóa file: ${filePath}`);
    } catch (error) {
        console.error("Lỗi khi xóa file:", error);
    }
}

const FlashcardController = {

    //Lấy danh sách tất cả từ vựng
    async getAllVocab(request, response) {
        try {
            const listVocab = await prisma.vocab.findMany();
            response.status(200).send({ data: listVocab })
        }
        catch (error) {
            response.status(404).json({ message: "Cannot fetch all vocab data", error });
        }
    },

    //Lấy từ vựng theo lesson ID
    async getVocabByLessonId(request, response) {
        const { lesson_id } = request.params
        try {
            const listVocab = await prisma.vocab.findMany({
                where: {
                    lesson_id: lesson_id
                }
            });

            const updatedVocab = await Promise.all(
                listVocab.map(async (item) => {
                    let mp3Key = item.mp3;

                    if (mp3Key.startsWith("https://")) {
                        let url = new URL(mp3Key);
                        mp3Key = decodeURIComponent(url.pathname.substring(1));
                    }

                    const presignedUrl = await getPresignedUrl(mp3Key); // Đợi URL được tạo

                    return {
                        ...item,
                        mp3: presignedUrl
                    };
                })
            );

            response.status(200).json({ data: updatedVocab });
        }
        catch (error) {
            response.status(404).json({ message: "Cannot fetch vocab by lesson ID", error })
        }
    },

    //Tạo mới từ vựng
    async createVocab(request, response) {
        upload.any()(request, response, async (error) => {
            if (error) {
                return response.status(500).json({ message: "Upload failed", error: error.message });
            }

            try {
                const { lesson_id, topic_id, vocabs } = request.body;

                const vocabList = JSON.parse(vocabs);
                if (!Array.isArray(vocabList)) {
                    return response.status(400).json({ message: "Invalid vocab format" });
                }

                const uploadedFiles = request.files || {};

                const vocabData = vocabList.map((vocab, index) => {
                    const mp3File = uploadedFiles.find(file => file.fieldname === `mp3_${index}`);

                    return {
                        category: vocab.category,
                        english: vocab.english,
                        vietnamese: vocab.vietnamese,
                        description: vocab.description,
                        lesson_id: lesson_id,
                        topic_id: topic_id,
                        mp3: mp3File ? mp3File.location : null,
                    };
                });

                const createdVocabs = await prisma.vocab.createMany({
                    data: vocabData.map((vocab) => ({
                        category: vocab.category,
                        english: vocab.english,
                        vietnamese: vocab.vietnamese,
                        description: vocab.description,
                        lesson_id: vocab.lesson_id,
                        topic_id: vocab.topic_id,
                        mp3: vocab.mp3
                    }))
                });

                response.status(201).json({ message: "Vocab created successfully", vocabs: createdVocabs });
            } catch (error) {
                response.status(500).json({ message: "Error creating vocab", error: error.message });
            }
        });
    },

    //Chỉnh sửa từ vựng
    async editVocab(request, response) {

        upload.any()(request, response, async (error) => {

            if (error) {
                return response.status(500).json({ message: "Edit vocab failed", error: error.message });
            }

            const { vocab_id } = request.params;
            const { english, vietnamese, description } = request.body
            const mp3Url = request.files["mp3"] ? request.files["mp3"][0].location : null;


            //console.log("Thông tin khóa học cần sửa: ", topic_id, topic_name, description, level, imageUrl)
            try {
                const curVocab = await prisma.vocab.findUnique({
                    where: {
                        id: vocab_id
                    }
                })

                console.log(curVocab)

                if (mp3Url && curVocab.mp3 && /^https?:\/\/.+/.test(curVocab.mp3)) {
                    const mp3Path = curVocab.mp3.split(".amazonaws.com/")[1];
                    await deleteS3File(process.env.S3_BUCKET_NAME, mp3Path);
                }

                const updateVocab = await prisma.vocab.update({
                    where: {
                        id: vocab_id
                    },
                    data: {
                        english: english,
                        vietnamese: vietnamese,
                        description: description,
                        mp3: mp3Url ?? curVocab.mp3
                    }
                });

                response.status(200).json({ message: "Edited vocab successfully", data: updateVocab })
            }
            catch (error) {
                response.status(500).json({ message: "Edited vocab failed", error })
            }
        });

    },

    //Xóa từ vựng
    async deleteVocab(request, response) {
        const { vocab_id } = request.params;

        try {
            //console.log("Cần xóa từ vựng id: ", vocab_id)
            const vocabDelete = await prisma.vocab.findUnique({
                where: {
                    id: vocab_id
                }
            });
            //console.log("Cần xóa từ vựng: ", vocabDelete)
            if (!vocabDelete) {
                return response.status(404).json({ message: "Vocab doesn't exist" });
            }

            //console.log("Image url", topicDelete.image);
            if (vocabDelete.mp3 && /^https?:\/\/.+/.test(vocabDelete.mp3)) {
                const mp3Path = vocabDelete.mp3.split(".amazonaws.com/")[1];
                await deleteS3File(process.env.S3_BUCKET_NAME, mp3Path);
            }

            const fcVocabToDelete = await prisma.fcVocab.findMany({
                where: {
                    vocab_id: vocab_id
                }
            });

            for (const vocab of fcVocabToDelete) {
                await prisma.fcVocab.delete({
                    where: {
                        id: vocab.id
                    }
                });
            }

            await prisma.vocab.delete({
                where: {
                    id: vocab_id
                }
            });

            response.status(200).json({ message: "Deleted vocab successfully" })
        }
        catch (error) {
            //console.error(error);
            response.status(500).json({ message: "Deleted vocab failed!!" })
        }
    },

    //Lấy danh sách tất cả Flashcard
    async getAllFlashcard(request, response) {

        try {
            const listFc = await prisma.flashcard.findMany({
                where: {
                    user_id: null
                }
            });

            response.status(200).json({ data: listFc });
        }
        catch (error) {
            response.status(404).json({ message: "Cannot fetch data from flashcard", error });
        }
    },

    //Lấy danh sách Flashcard của tôi
    async getMyFlashcard(request, response) {
        const userId = response.locals.user.id;

        try {
            const listMyFc = await prisma.flashcard.findMany({
                where: {
                    user_id: userId
                }
            });

            response.status(200).json({ data: listMyFc });
        }

        catch (error) {
            response.status(404).json({ message: "Cannot fetch data from My flashcard", error })
        }
    },

    //Lấy dữ liệu trong flashcard
    async getFlashcardData(request, response) {
        const { flashcardId } = request.params;

        try {
            const flashcardData = await prisma.fcVocab.findMany({
                where: { fc_id: flashcardId },
                include: { vocab: true }
            });

            const vocab_data = await Promise.all(
                flashcardData.map(async (item) => {
                    let mp3Key = item.vocab.mp3;

                    if (mp3Key.startsWith("https://")) {
                        let url = new URL(mp3Key);
                        mp3Key = decodeURIComponent(url.pathname.substring(1));
                    }

                    const presignedUrl = await getPresignedUrl(mp3Key); // Đợi URL được tạo

                    return {
                        ...item.vocab,
                        mp3: presignedUrl
                    };
                })
            );

            response.status(200).json({ data: vocab_data });
        }
        catch (error) {
            response.status(500).json({ message: "Cannot fetch data of Flashcard", error });
        }
    },

    //User tạo flashcard
    async createMyFlashcard(request, response) {
        const userId = response.locals.user.id;
        const { title, vocabs } = request.body;

        try {
            const new_fc = await prisma.flashcard.create({
                data: {
                    title: title,
                    user_id: userId
                }
            });

            await prisma.fcVocab.createMany({
                data: vocabs.map((vocab) => ({
                    fc_id: new_fc.id,
                    vocab_id: vocab
                }))
            });

            response.status(201).json({ message: "Flashcard created", flashcard: new_fc });
        } catch (error) {
            //console.error("Lỗi khi tạo flashcard:", error);
            response.status(500).json({ message: "Lỗi server", error: error.message });
        }
    },

    //Admin tạo flashcard
    async adminCreateFlashcard(request, response) {
        const { title, vocabs } = request.body;

        try {
            const new_fc = await prisma.flashcard.create({
                data: {
                    title: title,
                }
            });

            await prisma.fcVocab.createMany({
                data: vocabs.map((vocab) => ({
                    fc_id: new_fc.id,
                    vocab_id: vocab
                }))
            });

            return response.status(201).json({ message: "Flashcard created", flashcard: new_fc });
        } catch (error) {
            //console.error("Lỗi khi tạo flashcard:", error);
            return response.status(500).json({ message: "Lỗi server", error: error.message });
        }
    },

    //User thêm từ vựng vào flashcard
    async addVocabToFlashcard(request, response) {
        const { fc_id, vocab_id } = request.body;

        try {
            const existingVocab = await prisma.fcVocab.findFirst({
                where: {
                    fc_id: fc_id,
                    vocab_id: vocab_id
                }
            })

            if (existingVocab) {
                return response.status(400).json({ error: "Vocab already existed in flashcard" })
            }

            const data = await prisma.fcVocab.create({
                data: {
                    fc_id: fc_id,
                    vocab_id: vocab_id
                }
            });

            response.status(201).json({ message: "Added vocab to flashcard successfully", data: data })
        }

        catch (error) {
            response.status(500).json({ message: "Cannot add vocab to flashcard", error })
        }
    },

    //Sửa flashcard
    async editFlashcard(request, response) {
        const { flashcard_id } = request.params;
        const { title, data } = request.body;

        // console.log(flashcard_id)
        // console.log("Title", title);
        // console.log(data.data);

        try {
            const currentVocabs = await prisma.fcVocab.findMany({
                where: { fc_id: flashcard_id }
            });

            //console.log(currentVocabs);

            const vocabIdsToRemove = currentVocabs.filter(curVocab => !data.data.some(vocab => vocab === curVocab.vocab_id)).map(vocab => vocab.vocab_id);
            //console.log(vocabIdsToRemove);
            if (vocabIdsToRemove.length > 0) {
                await prisma.fcVocab.deleteMany({
                    where: {
                        fc_id: flashcard_id,
                        vocab_id: { in: vocabIdsToRemove }
                    }
                });
            }

            await Promise.all(
                data.data.map(async (vocabId) => {
                    console.log(vocabId);
                    const curVocab = await prisma.fcVocab.findUnique({
                        where: {
                            vocab_id: vocabId,
                            fc_id: flashcard_id

                        }
                    });

                    console.log("CurVocab:", curVocab);

                    if (!curVocab) {
                        await prisma.fcVocab.create({
                            data: {
                                vocab_id: vocabId,
                                fc_id: flashcard_id
                            }
                        });
                    }
                })
            );

            await prisma.flashcard.update({
                where: { id: flashcard_id },
                data: { title: title }
            });

            response.status(200).json({ message: "Flashcard updated successfully!" });

        } catch (error) {
            response.status(500).json({ message: "Cannot edit flashcard", error });
        }
    },

    //Xóa flashcard
    async deleteFlashcard(request, response) {
        const { fc_id } = request.params;

        try {
            await prisma.fcVocab.deleteMany({
                where: {
                    fc_id: fc_id
                }
            });

            await prisma.flashcard.delete({
                where: {
                    id: fc_id
                }
            });

            response.status(200).json({ message: "Deleted flashcard successfully!" });
        }

        catch (error) {
            response.status(500).json({ message: "Cannot delete Flashcard!" });
        }
    },
}

module.exports = FlashcardController