const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const { createQuizSchema, submitQuizSchema } = require("../schemas/quizzes");

const router = express.Router();
router.use(authMiddleware);

// GET /api/quizzes - List all quizzes for the student
router.get("/", async (req, res, next) => {
  try {
    const { data: quizzes, error } = await getClient()
      .from("quizzes")
      .select("*")
      .eq("student_id", req.student.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ quizzes });
  } catch (error) {
    next(error);
  }
});

// GET /api/quizzes/:id - Get a specific quiz with its questions
router.get("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getClient();

    // Verify ownership
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .eq("student_id", req.student.id)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Fetch questions
    const { data: questions, error: qError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("created_at", { ascending: true });

    if (qError) throw qError;

    res.json({ quiz, questions });
  } catch (error) {
    next(error);
  }
});

// POST /api/quizzes - Save a newly generated quiz
router.post("/", validate({ body: createQuizSchema }), async (req, res, next) => {
  try {
    const { title, questions } = req.body;

    const supabase = getClient();

    // 1. Create the quiz entry
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        student_id: req.student.id,
        title,
        total_questions: questions.length
      })
      .select()
      .single();

    if (quizError) throw quizError;

    // 2. Insert all questions
    const questionsToInsert = questions.map((q) => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_index: q.correctIndex,
      explanation: q.explanation,
      citation: q.citation || null
    }));

    const { data: savedQuestions, error: qError } = await supabase
      .from("quiz_questions")
      .insert(questionsToInsert)
      .select();

    if (qError) {
      // Rollback quiz if question insertion fails
      await supabase.from("quizzes").delete().eq("id", quiz.id);
      throw qError;
    }

    res.status(201).json({ quiz, questions: savedQuestions });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/quizzes/:id/submit - Submit final score and answers
router.patch("/:id/submit", validate({ params: idParamSchema, body: submitQuizSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score, answers } = req.body;
    // answers should be an array of objects: { question_id: UUID, user_answer_index: INT, is_correct: BOOLEAN }

    const supabase = getClient();

    // 1. Update Quiz score
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .update({ score })
      .eq("id", id)
      .eq("student_id", req.student.id)
      .select()
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ message: "Quiz not found or unauthorized" });
    }

    // 2. Update each question's user answer
    for (const ans of answers) {
      await supabase
        .from("quiz_questions")
        .update({
          user_answer_index: ans.user_answer_index,
          is_correct: ans.is_correct
        })
        .eq("id", ans.question_id)
        .eq("quiz_id", id);
    }

    res.json({ message: "Quiz submitted successfully", quiz });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/quizzes/:id - Delete a quiz
router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await getClient()
      .from("quizzes")
      .delete()
      .eq("id", id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "Quiz not found" });
    res.json({ message: "Quiz deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
