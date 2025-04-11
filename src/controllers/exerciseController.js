const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

require("dotenv").config();

const ExerciseController = {
    async getAllExercise(request, response) {
        try {
            const listEx = await prisma.exercise.findMany();
            response.status(200).json({ data: listEx });
        }
        catch (error) {
            response.status(500).json({ error: 'Fetch all exercises failed' })
        }

    },

    async getExerciseByLessonId(request, response) {
        const { lesson_id } = request.params;
        console.log(lesson_id)
        try {
            const exercises = await prisma.exercise.findMany({
                where: { lesson_id: lesson_id }
            })
            console.log(exercises)
            response.status(200).json({ exercises })
        }
        catch (error) {
            response.status(500).json({ message: "Cannot get Exercise by lesson ID", error })
        }
    },

    async createExercise(request, response) {
        const { lesson_id } = request.params;
        const { data } = request.body;

        try {
            // Kiểm tra xem bài học có tồn tại không
            const existEx = await prisma.lesson.findUnique({
                where: { id: lesson_id }
            });

            if (!existEx) {
                return response.status(400).json({ error: 'Bài học không tồn tại' });
            }

            console.log("Lesson ID: ", lesson_id);
            console.log("Data: ", data);

            // Thêm nhiều bài tập mới
            const newExercises = await prisma.exercise.createMany({
                data: data.map(ex => ({
                    question: ex.question,
                    answer: ex.answer,
                    point: Number(ex.point),
                    lesson_id,
                }))
            });

            response.status(200).json({ message: "Tạo bài tập thành công", exercises: newExercises });
        } catch (error) {
            console.error(error);
            response.status(500).json({ message: "Lỗi khi tạo bài tập", error });
        }
    }

}

module.exports = ExerciseController