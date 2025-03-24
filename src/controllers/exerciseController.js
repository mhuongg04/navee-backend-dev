const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

require("dotenv").config();

const ExerciseController = {
  // Existing methods
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
    console.log(lesson_id);
    try {
      const exercises = await prisma.exercise.findMany({
        where: { lesson_id: lesson_id }
      });
      console.log(exercises);
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
      console.log("Lesson ID: ", lesson_id);
      console.log("Data: ", data);
      
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
  },

  // New method for submitting exercise answers
  async submitExercise(request, response) {
    try {
      const { exerciseId, answer } = request.body;
      const userId = request.user.id;

      console.log(`Processing exercise submission: User ${userId}, Exercise ${exerciseId}, Answer: ${answer}`);

      // Get exercise details
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

      // Check if the lesson has a LessonTopic entry
      if (!exercise.lesson.LessonTopic || exercise.lesson.LessonTopic.length === 0) {
        return response.status(500).json({ message: 'Không tìm thấy thông tin bài học trong topic' });
      }

      // Calculate score based on answer correctness
      const score = answer === exercise.answer ? exercise.point : 0;
      const isCompleted = score === exercise.point;

      // Update or create exercise result
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

      // If exercise is completed with full points
      if (isCompleted) {
        // Update user's earn points
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

        // Get the LessonTopic ID
        const lessonTopicId = exercise.lesson.LessonTopic[0].id;
        
        // Find enrollment for this user and topic
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
          console.log(`Found enrollment ID: ${enrollment.id}`);
          
          // Check if all exercises in the lesson are completed
          const allExercisesCompleted = await checkLessonCompletion(userId, exercise.lesson_id);
          console.log(`All exercises completed for lesson: ${allExercisesCompleted}`);

          if (allExercisesCompleted) {
            // Find the LessonProgress entry
            const lessonProgress = await prisma.lessonProgress.findUnique({
              where: {
                enrollment_id_lesson_id: {
                  enrollment_id: enrollment.id,
                  lesson_id: lessonTopicId
                }
              }
            });

            if (lessonProgress) {
              // Update lesson progress
              await prisma.lessonProgress.update({
                where: {
                  enrollment_id_lesson_id: {
                    enrollment_id: enrollment.id,
                    lesson_id: lessonTopicId
                  }
                },
                data: { completed: true }
              });
              console.log(`Updated LessonProgress ID: ${lessonProgress.id} to completed`);
            } else {
              // Create a new LessonProgress if it doesn't exist
              await prisma.lessonProgress.create({
                data: {
                  enrollment_id: enrollment.id,
                  lesson_id: lessonTopicId,
                  completed: true
                }
              });
              console.log(`Created new LessonProgress for enrollment: ${enrollment.id}, lesson: ${lessonTopicId}`);
            }

            // Update overall topic progress
            await updateTopicProgress(enrollment.id);
            console.log(`Updated topic progress for enrollment: ${enrollment.id}`);
          }
        } else {
          console.log(`No enrollment found for user: ${userId}, topic: ${exercise.lesson.LessonTopic[0].topic_id}`);
        }
      }

      response.json({
        exerciseResult,
        earnedPoints: isCompleted ? exercise.point : 0,
        updatedUserPoints,
        message: isCompleted ? "Hoàn thành bài tập!" : "Câu trả lời chưa chính xác"
      });
    } catch (error) {
      console.error('Error in submitExercise:', error);
      response.status(500).json({ message: "Lỗi khi nộp bài tập", error: error.toString() });
    }
  },

  // Get user's exercise results for a lesson
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
      console.error(error);
      response.status(500).json({ message: "Lỗi khi lấy kết quả bài tập", error });
    }
  }
};

// Helper function to check if all exercises in a lesson are completed
async function checkLessonCompletion(userId, lessonId) {
  // Lấy tất cả bài tập của bài học
  const exercises = await prisma.exercise.findMany({
    where: { lesson_id: lessonId }
  });
  
  if (exercises.length === 0) {
    console.log(`No exercises found for lesson: ${lessonId}`);
    return false;
  }
  
  // Kiểm tra từng bài tập xem đã hoàn thành chưa
  for (const exercise of exercises) {
    const result = await prisma.exerciseResult.findUnique({
      where: {
        user_id_exercise_id: {
          user_id: userId,
          exercise_id: exercise.id
        }
      }
    });
    
    // Nếu có bất kỳ bài tập nào chưa hoàn thành, trả về false
    if (!result || !result.completed) {
      console.log(`Exercise ${exercise.id} not completed`);
      return false;
    }
  }
  
  // Tất cả bài tập đều đã hoàn thành
  console.log(`All exercises completed for lesson: ${lessonId}`);
  return true;
}

// Helper function to update topic progress
async function updateTopicProgress(enrollmentId) {
  try {
    // Lấy enrollment bao gồm tất cả lessonProgress
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        lessonProgress: true
      }
    });

    if (!enrollment) {
      console.log(`Enrollment not found: ${enrollmentId}`);
      return;
    }

    // Tính toán tiến độ
    const totalLessons = enrollment.lessonProgress.length;
    const completedLessons = enrollment.lessonProgress.filter(lp => lp.completed).length;
    
    console.log(`Progress calculation: ${completedLessons}/${totalLessons} lessons completed`);
    
    // Tính phần trăm hoàn thành
    const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    // Cập nhật trạng thái enrollment
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress: progress,
        completed: progress === 100
      }
    });
    
    console.log(`Updated enrollment ${enrollmentId} progress to ${progress}%`);
  } catch (error) {
    console.error('Error in updateTopicProgress:', error);
  }
}

module.exports = ExerciseController;