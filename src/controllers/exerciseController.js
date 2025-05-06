const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

require("dotenv").config();

const ExerciseController = {
  async getAllExercise(request, response) {
    try {
      const listEx = await prisma.exercise.findMany();
      response.status(200).json({ data: listEx });
    } catch (error) {
      response.status(500).json({ error: 'Fetch all exercises failed' });
    }
  },

  async getExerciseByLessonId(request, response) {
    const { lesson_id } = request.params;
    try {
      const exercises = await prisma.exercise.findMany({
        where: { lesson_id: lesson_id }
      });
      response.status(200).json({ exercises });
    } catch (error) {
      response.status(500).json({ message: "Cannot get Exercise by lesson ID", error });
    }
  },

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
    } catch (error) {
      response.status(500).json({ message: "Cannot edit exercise", error });
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
    } catch (error) {
      response.status(500).json({ message: "Cannot delete exercise", error });
    }
  },

  async submitExercise(request, response) {
    try {
      const { exerciseId, answer } = request.body;
      const userId = request.user.id;

      const exercise = await prisma.exercise.findUnique({
        where: { id: exerciseId },
        include: {
          lesson: {
            include: {
              LessonTopic: true
            }
          }
        }
      });

      if (!exercise) {
        return response.status(404).json({ message: 'Không tìm thấy bài tập' });
      }

      if (!exercise.lesson.LessonTopic || exercise.lesson.LessonTopic.length === 0) {
        return response.status(500).json({ message: 'Không tìm thấy thông tin bài học trong topic' });
      }

      const score = answer === exercise.answer ? exercise.point : 0;
      const isCompleted = score === exercise.point;

      const exerciseResult = await prisma.exerciseResult.upsert({
        where: {
          user_id_exercise_id: {
            user_id: userId,
            exercise_id: exerciseId
          }
        },
        update: {
          score: score,
          completed: isCompleted
        },
        create: {
          user_id: userId,
          exercise_id: exerciseId,
          score: score,
          completed: isCompleted
        }
      });

      let updatedUserPoints = 0;

      if (isCompleted) {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            earnpoints: {
              increment: exercise.point
            }
          },
          select: {
            earnpoints: true
          }
        });

        updatedUserPoints = updatedUser.earnpoints;

        const lessonTopicId = exercise.lesson.LessonTopic[0].id;

        const enrollment = await prisma.enrollment.findFirst({
          where: {
            user_id: userId,
            topic_id: exercise.lesson.LessonTopic[0].topic_id
          },
          include: {
            lessonProgress: true
          }
        });

        if (enrollment) {
          const allExercisesCompleted = await checkLessonCompletion(userId, exercise.lesson_id);

          if (allExercisesCompleted) {
            const lessonProgress = await prisma.lessonProgress.findUnique({
              where: {
                enrollment_id_lesson_id: {
                  enrollment_id: enrollment.id,
                  lesson_id: lessonTopicId
                }
              }
            });

            if (lessonProgress) {
              await prisma.lessonProgress.update({
                where: {
                  enrollment_id_lesson_id: {
                    enrollment_id: enrollment.id,
                    lesson_id: lessonTopicId
                  }
                },
                data: { completed: true }
              });
            } else {
              await prisma.lessonProgress.create({
                data: {
                  enrollment_id: enrollment.id,
                  lesson_id: lessonTopicId,
                  completed: true
                }
              });
            }

            await updateTopicProgress(enrollment.id);
          }
        }
      }

      response.json({
        exerciseResult,
        earnedPoints: isCompleted ? exercise.point : 0,
        updatedUserPoints,
        message: isCompleted ? "Hoàn thành bài tập!" : "Câu trả lời chưa chính xác"
      });
    } catch (error) {
      response.status(500).json({ message: "Lỗi khi nộp bài tập", error: error.toString() });
    }
  },

  async getUserExerciseResults(request, response) {
    try {
      const { lessonId } = request.params;
      const userId = request.user.id;

      const results = await prisma.exerciseResult.findMany({
        where: {
          user_id: userId,
          exercise: {
            lesson_id: lessonId
          }
        },
        include: {
          exercise: true
        }
      });

      response.json({ results });
    } catch (error) {
      response.status(500).json({ message: "Lỗi khi lấy kết quả bài tập", error });
    }
  }
};

// Helper functions

async function checkLessonCompletion(userId, lessonId) {
  const exercises = await prisma.exercise.findMany({
    where: { lesson_id: lessonId }
  });

  if (exercises.length === 0) return false;

  for (const exercise of exercises) {
    const result = await prisma.exerciseResult.findUnique({
      where: {
        user_id_exercise_id: {
          user_id: userId,
          exercise_id: exercise.id
        }
      }
    });

    if (!result || !result.completed) return false;
  }

  return true;
}

async function updateTopicProgress(enrollmentId) {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        lessonProgress: true
      }
    });

    if (!enrollment) return;

    const totalLessons = enrollment.lessonProgress.length;
    const completedLessons = enrollment.lessonProgress.filter(lp => lp.completed).length;

    const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: progress,
        completed: progress === 100
      }
    });
  } catch (error) {
    console.error('Error in updateTopicProgress:', error);
  }
}

module.exports = ExerciseController;
