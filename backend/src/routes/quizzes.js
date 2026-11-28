const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const { createQuizSchema, submitQuizSchema } = require("../schemas/quizzes");
const { logActivity } = require("../services/activity");
const { gradeShortAnswer } = require("../services/groq");
const { getDailyLimit, refundAiQuota } = require("../middleware/aiQuota");

const router = express.Router();
router.use(authMiddleware);

function sanitizeQuestionsForClient(quiz, questions) {
  const isSubmitted = quiz.score !== null && quiz.score !== undefined;
  if (isSubmitted) return questions;
  return questions.map(({ correct_index: _ci, model_answer: _ma, ...rest }) => rest);
}

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

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .eq("student_id", req.student.id)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const { data: questions, error: qError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("created_at", { ascending: true });

    if (qError) throw qError;

    res.json({ quiz, questions: sanitizeQuestionsForClient(quiz, questions || []) });
  } catch (error) {
    next(error);
  }
});

// POST /api/quizzes - Save a newly generated quiz
router.post("/", validate({ body: createQuizSchema }), async (req, res, next) => {
  try {
    const { title, questions } = req.body;
    const supabase = getClient();

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        student_id: req.student.id,
        title,
        score: null,
        total_questions: questions.length,
      })
      .select()
      .single();

    if (quizError) throw quizError;

    const questionsToInsert = questions.map((q) => {
      const type = q.type || "mcq";
      return {
        quiz_id: quiz.id,
        type,
        question: q.question,
        options: type === "short" ? null : q.options || null,
        correct_index: type === "short" ? null : q.correctIndex ?? null,
        model_answer: type === "short" ? (q.modelAnswer || q.model_answer || null) : null,
        explanation: q.explanation ?? null,
        citation: q.citation || null,
        user_answer_index: null,
        user_answer_text: null,
        is_correct: null,
        feedback: null,
      };
    });

    const { data: savedQuestions, error: qError } = await supabase
      .from("quiz_questions")
      .insert(questionsToInsert)
      .select();

    if (qError) {
      await supabase.from("quizzes").delete().eq("id", quiz.id);
      throw qError;
    }

    res.status(201).json({
      quiz,
      questions: sanitizeQuestionsForClient(quiz, savedQuestions || []),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/quizzes/:id/submit - Server-side grading & score computation
router.patch("/:id/submit", validate({ params: idParamSchema, body: submitQuizSchema }), async (req, res, next) => {
  let charged = 0;
  const refundCharges = async () => {
    for (; charged > 0; charged -= 1) await refundAiQuota(req.student.id);
  };
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const supabase = getClient();

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .eq("student_id", req.student.id)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ message: "Quiz not found or unauthorized" });
    }
    // The answers are shown after submitting, so a new attempt has to go through retake.
    if (quiz.score !== null && quiz.score !== undefined) {
      return res.status(409).json({ message: "Quiz already submitted. Use retake to try again." });
    }

    const { data: questions, error: qError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("created_at", { ascending: true });

    if (qError) throw qError;

    const allQuestions = questions || [];
    const answersById = new Map();
    for (const ans of answers) {
      answersById.set(ans.question_id, ans);
    }

    const aiGraded = allQuestions.filter((q) => {
      if ((q.type || "mcq") !== "short") return false;
      const ans = answersById.get(q.id);
      return typeof ans?.user_answer_text === "string" && ans.user_answer_text.trim().length > 0;
    });

    // Each short answer is its own model call, so each one counts against the daily limit.
    while (charged < aiGraded.length) {
      const { data: allowed, error: quotaError } = await supabase.rpc("bump_ai_usage", {
        p_student: req.student.id,
        p_limit: getDailyLimit(),
      });
      if (quotaError) throw quotaError;
      if (!allowed) {
        await refundCharges();
        return res.status(429).json({ message: "Daily AI limit reached" });
      }
      charged += 1;
    }

    // Grade every question in memory first; if AI grading fails, nothing is persisted.
    let correctCount = 0;
    const gradedUpdates = [];

    for (const q of allQuestions) {
      const type = q.type || "mcq";
      const ans = answersById.get(q.id);

      if (type === "short") {
        const userText = typeof ans?.user_answer_text === "string" ? ans.user_answer_text.trim() : "";
        if (!userText) {
          gradedUpdates.push({
            id: q.id,
            patch: {
              user_answer_index: null,
              user_answer_text: null,
              is_correct: false,
              feedback: "No answer provided.",
            },
          });
        } else {
          const grade = await gradeShortAnswer(q.question, q.model_answer || "", userText);
          const isCorrect = Boolean(grade.isCorrect);
          if (isCorrect) correctCount += 1;
          gradedUpdates.push({
            id: q.id,
            patch: {
              user_answer_index: null,
              user_answer_text: userText,
              is_correct: isCorrect,
              feedback: grade.feedback,
            },
          });
        }
      } else {
        const rawIdx = ans?.user_answer_index;
        const userIdx = typeof rawIdx === "number" && rawIdx >= 0 ? rawIdx : null;
        const isCorrect = userIdx !== null && userIdx === q.correct_index;
        if (isCorrect) correctCount += 1;
        gradedUpdates.push({
          id: q.id,
          patch: {
            user_answer_index: userIdx,
            user_answer_text: null,
            is_correct: isCorrect,
            feedback: null,
          },
        });
      }
    }

    const finalScore = allQuestions.length > 0 ? Math.round((correctCount / allQuestions.length) * 100) : 0;

    for (const item of gradedUpdates) {
      const { error: upError } = await supabase
        .from("quiz_questions")
        .update(item.patch)
        .eq("id", item.id)
        .eq("quiz_id", id);
      if (upError) throw upError;
    }

    const { data: updatedQuiz, error: scoreError } = await supabase
      .from("quizzes")
      .update({ score: finalScore })
      .eq("id", id)
      .eq("student_id", req.student.id)
      .select()
      .single();

    if (scoreError) throw scoreError;

    const { data: updatedQuestions, error: fetchError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    await logActivity(req.student.id, "quiz_completed", updatedQuiz.title, updatedQuiz.id);

    res.json({
      message: "Quiz submitted successfully",
      quiz: updatedQuiz,
      questions: updatedQuestions || [],
    });
  } catch (error) {
    await refundCharges();
    next(error);
  }
});

// POST /api/quizzes/:id/retake - Reset answers and score so the student can retake
router.post("/:id/retake", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getClient();

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .update({ score: null })
      .eq("id", id)
      .eq("student_id", req.student.id)
      .select()
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const { error: resetError } = await supabase
      .from("quiz_questions")
      .update({
        user_answer_index: null,
        user_answer_text: null,
        is_correct: null,
        feedback: null,
      })
      .eq("quiz_id", id);

    if (resetError) throw resetError;

    const { data: questions, error: qError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("created_at", { ascending: true });

    if (qError) throw qError;

    res.json({
      quiz,
      questions: sanitizeQuestionsForClient(quiz, questions || []),
    });
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
