const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TestController = {
  // Lấy tất cả bài kiểm tra dựa trên topic/unit ID
  async getTestsByUnit(request, response) {
    const { unit_id } = request.params;
    // Lấy userId từ request.user
    const userId = request.user ? request.user.id : null;
    
    console.log(`Fetching tests for unit ${unit_id}, user ${userId || 'anonymous'}`);
    
    try {
      const tests = await prisma.test.findMany({
        where: {
          units: {
            hasSome: [unit_id]
          }
        },
        include: {
          exercises: {
            select: {
              id: true,
              question: true,
              exercise_type: true,
              options: true,
              point: true
            }
          },
          // Thêm phần này để lấy kết quả bài kiểm tra của người dùng
          testResults: userId ? {
            where: { user_id: userId }
          } : undefined
        }
      });
      
      // Xử lý dữ liệu để thêm thông tin isCompleted và score
      const testsWithUserInfo = tests.map(test => {
        // Tính tổng điểm tối đa của bài kiểm tra
        const totalScore = test.exercises.reduce((sum, ex) => sum + ex.point, 0);
        
        // Kiểm tra xem người dùng đã hoàn thành bài kiểm tra chưa
        const isCompleted = userId && test.testResults && test.testResults.length > 0;
        
        // Lấy điểm số nếu đã hoàn thành
        const score = isCompleted ? test.testResults[0].total_score : undefined;
        
        return {
          ...test,
          isCompleted,
          score,
          totalScore,
          // Không trả về testResults trong response
          testResults: undefined
        };
      });
      
      response.status(200).json({ data: testsWithUserInfo });
    } catch (error) {
      console.error('Error fetching tests:', error);
      response.status(500).json({ error: 'Fetch tests by unit failed', details: error.message });
    }
  },

  // Lấy bài kiểm tra theo ID
  async getTestById(request, response) {
    const { test_id } = request.params;
    try {
      const test = await prisma.test.findUnique({
        where: { id: test_id },
        include: {
          exercises: {
            select: {
              id: true,
              question: true,
              exercise_type: true,
              options: true,
              point: true
            }
          }
        }
      });
      
      if (!test) {
        return response.status(404).json({ error: 'Bài kiểm tra không tồn tại' });
      }
      
      response.status(200).json({ data: test });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: 'Fetch test by ID failed' });
    }
  },

  // Tạo bài kiểm tra mới liên kết với các unit
  async createTest(request, response) {
    const { title, description, units } = request.body;
    
    try {
      // Kiểm tra xem tất cả unit ID có tồn tại không
      for (const unitId of units) {
        const topic = await prisma.topic.findUnique({
          where: { id: unitId }
        });
        
        if (!topic) {
          return response.status(404).json({ 
            error: 'Unit không tồn tại', 
            unitId 
          });
        }
      }
      
      const newTest = await prisma.test.create({
        data: {
          title,
          description,
          units
        }
      });
      
      response.status(201).json({ message: 'Tạo bài kiểm tra thành công', test: newTest });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: 'Create test failed' });
    }
  },

  // Thêm câu hỏi vào bài kiểm tra
  async addExercisesToTest(request, response) {
    const { test_id } = request.params;
    const { exercises } = request.body;
    
    try {
      const test = await prisma.test.findUnique({
        where: { id: test_id }
      });
      
      if (!test) {
        return response.status(404).json({ error: 'Bài kiểm tra không tồn tại' });
      }
      
      // Tạo nhiều câu hỏi cùng lúc
      const createdExercises = [];
      for (const ex of exercises) {
        // Kiểm tra exercise_type hợp lệ
        const validExerciseTypes = ['fillInBlank', 'multipleChoice'];
        if (!validExerciseTypes.includes(ex.exercise_type)) {
          return response.status(400).json({ 
            error: 'Invalid exercise type. Must be either fillInBlank or multipleChoice',
            questionText: ex.question 
          });
        }
        
        // Đảm bảo có options nếu là multipleChoice
        if (ex.exercise_type === 'multipleChoice' && (!ex.options || ex.options.length < 2)) {
          return response.status(400).json({ 
            error: 'Multiple choice questions must have at least 2 options',
            questionText: ex.question 
          });
        }

        const newExercise = await prisma.exercise.create({
          data: {
            question: ex.question,
            answer: ex.answer,
            point: Number(ex.point || 1),
            exercise_type: ex.exercise_type,
            options: ex.options || [],
            test_id
          }
        });
        
        createdExercises.push(newExercise);
      }
      
      response.status(201).json({ 
        message: 'Thêm câu hỏi thành công', 
        exercises: createdExercises 
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: 'Add exercises to test failed' });
    }
  },

  // Học viên nộp bài kiểm tra
  async submitTest(request, response) {
    const { test_id } = request.params;
    const { answers } = request.body;
    
    // Chỉ sử dụng request.user
    if (!request.user || !request.user.id) {
      return response.status(401).json({ message: "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại." });
    }
    
    const userId = request.user.id;
    
    console.log(`Submitting test ${test_id} for user ${userId}`);
    console.log(`Answers received:`, JSON.stringify(answers));
    
    try {
      // Lấy thông tin bài kiểm tra
      const test = await prisma.test.findUnique({
        where: { id: test_id },
        include: { exercises: true }
      });
      
      if (!test) {
        return response.status(404).json({ error: 'Bài kiểm tra không tồn tại' });
      }
      
      console.log(`Test found with ${test.exercises.length} exercises`);
      
      // Kiểm tra xem các exercise trong answers có thuộc về test này không
      const exerciseIds = test.exercises.map(ex => ex.id);
      console.log(`Test exercises IDs: ${exerciseIds.join(', ')}`);
      
      // Kiểm tra xem có exercise nào trong answers không thuộc bài test này
      const invalidExercises = answers.filter(a => !exerciseIds.includes(a.exerciseId));
      if (invalidExercises.length > 0) {
        console.log(`Invalid exercises found:`, JSON.stringify(invalidExercises));
        return response.status(400).json({ 
          error: 'Một số câu hỏi không thuộc bài kiểm tra này',
          invalidExercises: invalidExercises.map(a => a.exerciseId)
        });
      }
      
      // Tính điểm
      let totalScore = 0;
      const detailedResults = [];
      
      for (const answer of answers) {
        const exercise = test.exercises.find(ex => ex.id === answer.exerciseId);
        
        if (exercise) {
          const isCorrect = String(exercise.answer).trim() === String(answer.answer).trim();
          const pointsEarned = isCorrect ? exercise.point : 0;
          totalScore += pointsEarned;
          
          detailedResults.push({
            exerciseId: exercise.id,
            question: exercise.question,
            userAnswer: answer.answer,
            correctAnswer: exercise.answer,
            isCorrect,
            pointsEarned,
            maxPoints: exercise.point
          });
        }
      }
      
      // Lưu kết quả bài kiểm tra
      console.log(`Saving test result: userId=${userId}, test_id=${test_id}, totalScore=${totalScore}`);
      
      const testResult = await prisma.testResult.upsert({
        where: {
          user_id_test_id: {
            user_id: userId,
            test_id
          }
        },
        update: {
          total_score: totalScore,
          completed: true
        },
        create: {
          user_id: userId,
          test_id,
          total_score: totalScore,
          completed: true
        }
      });
      
      // Chỉ cập nhật điểm nếu chưa làm bài này trước đó
      const existingResult = await prisma.testResult.findFirst({
        where: {
          user_id: userId,
          test_id,
          created_at: {
            lt: new Date()
          }
        }
      });
      
      if (!existingResult) {
        // Cập nhật điểm tích lũy cho người dùng
        await prisma.user.update({
          where: { id: userId },
          data: {
            earnpoints: {
              increment: totalScore
            }
          }
        });
      }
      
      response.status(200).json({ 
        message: 'Nộp bài kiểm tra thành công',
        result: testResult,
        earnedPoints: totalScore,
        detailedResults
      });
    } catch (error) {
      console.error('Error submitting test:', error);
      response.status(500).json({ error: 'Submit test failed', details: error.message });
    }
  },

  // Lấy kết quả bài kiểm tra của người dùng
  async getTestResult(request, response) {
    const { test_id } = request.params;
    
    // Lấy userId từ req.user thay vì response.locals.user
    if (!request.user || !request.user.id) {
      return response.status(401).json({ error: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.' });
    }
    
    const userId = request.user.id;
    console.log(`Fetching test result for user ${userId}, test ${test_id}`);
    
    try {
      const testResult = await prisma.testResult.findUnique({
        where: {
          user_id_test_id: {
            user_id: userId,
            test_id
          }
        },
        include: {
          test: {
            include: {
              exercises: true
            }
          }
        }
      });
      
      if (!testResult) {
        return response.status(404).json({ error: 'Bạn chưa làm bài kiểm tra này' });
      }
      
      response.status(200).json({ data: testResult });
    } catch (error) {
      console.error('Error fetching test result:', error);
      response.status(500).json({ error: 'Không thể lấy kết quả bài kiểm tra', details: error.message });
    }
  },
  
  // Lấy tất cả các bài kiểm tra mà người dùng có thể làm (dựa trên khóa học đã đăng ký)
  async getAvailableTestsForUser(request, response) {
    if (!request.user || !request.user.id) {
      return response.status(401).json({ error: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.' });
    }
    
    const userId = request.user.id;
    console.log(`Fetching available tests for user ${userId}`);
    
    try {
      // Lấy các khóa học đã đăng ký
      const enrollments = await prisma.enrollment.findMany({
        where: { user_id: userId },
        include: { topic: true }
      });
      
      if (!enrollments.length) {
        return response.status(200).json({ data: [] });
      }
      
      // Lấy các topic ID
      const topicIds = enrollments.map(enrollment => enrollment.topic_id);
      
      // Tìm các bài kiểm tra phù hợp với các unit này
      const tests = await prisma.test.findMany({
        where: {
          units: {
            hasSome: topicIds
          }
        },
        include: {
          testResults: {
            where: { user_id: userId }
          }
        }
      });
      
      // Đánh dấu bài kiểm tra đã hoàn thành
      const testsWithStatus = tests.map(test => ({
        ...test,
        completed: test.testResults.length > 0,
        score: test.testResults.length > 0 ? test.testResults[0].total_score : null
      }));
      
      response.status(200).json({ data: testsWithStatus });
    } catch (error) {
      console.error('Error fetching available tests:', error);
      response.status(500).json({ error: 'Không thể lấy danh sách bài kiểm tra', details: error.message });
    }
  }
};

module.exports = TestController; 