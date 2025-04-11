const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

require("dotenv").config();

const ExerciseController = {

    //Lấy danh sách tất cả bài tập
    async getAllExercise(request, response) {
        try {
            const listEx = await prisma.exercise.findMany();
            response.status(200).json({ data: listEx });
        }
        catch (error) {
            response.status(500).json({ error: 'Fetch all exercises failed' })
        }

    },

    //Lấy bài tập theo Lesson ID
    async getExerciseByLessonId(request, response) {
        const { lesson_id } = request.params;
        //console.log(lesson_id)
        try {
            const exercises = await prisma.exercise.findMany({
                where: { lesson_id: lesson_id }
            })
            //console.log(exercises)
            response.status(200).json({ exercises })
        }
        catch (error) {
            response.status(500).json({ message: "Cannot get Exercise by lesson ID", error })
        }
    },

    //Tạo mới bài tập
    async createExercise(request, response) {
        const { lesson_id } = request.params;
        const { data } = request.body;

        try {
            const existEx = await prisma.lesson.findUnique({
                where: { id: lesson_id }
            });

            if (!existEx) {
                return response.status(400).json({ error: 'Bài học không tồn tại' });
            }
            const newExercises = await prisma.exercise.createMany({
                data: data.map(ex => ({
                    question: ex.question,
                    answer: ex.answer,
                    point: Number(ex.point),
                    lesson_id,
                }))
            });

            response.status(201).json({ message: "Tạo bài tập thành công", exercises: newExercises });
        } catch (error) {
            //console.error(error);
            response.status(500).json({ message: "Lỗi khi tạo bài tập", error });
        }
    },

    async editExercise(request, response) {
        const { ex_id } = request.params;
        const { question, answer, point } = request.body;

        try {
            const newEx = await prisma.exercise.update({
                where: {
                    id: ex_id
                },
                data: {
                    question: question,
                    answer: answer,
                    point: Number(point)
                }
            });
            response.status(200).json({ message: "Edit exercise successfully", data: newEx });
        }
        catch (e) {
            response.status(500).json({ message: "Cannot edit exercise", e });
        }
    },

    async deleteExercise(request, response) {
        const { ex_id } = request.params;

        try {
            await prisma.exercise.delete({
                where: {
                    id: ex_id
                }
            });
            response.status(200).json({ message: "Deleted exercise successfully" });
        }
        catch (e) {
            response.status(500).json({ message: "Cannot delete exercise", e });
        }
    }

}

module.exports = ExerciseController