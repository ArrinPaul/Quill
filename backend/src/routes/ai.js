const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  attendanceAlertSchema,
  chatSchema,
  notesSchema,
  quizGenerateSchema,
  gradeShortAnswerSchema,
  toolParamsSchema,
  toolBodySchema,
} = require("../schemas/ai");
const {
  getStudyTip,
  attendanceAlert,
  chatResponse,
  generateFlashcards,
  generateQuiz,
  gradeShortAnswer,
  executeSmartTool
} = require("../services/groq");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

function uploadDocument(req, res, next) {
  upload.single("document")(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? "File is too large (10MB maximum)." : "Upload failed." });
  });
}

router.post("/parse-document", authMiddleware, uploadDocument, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No document provided" });
    }

    const file = req.file;
    const extension = file.originalname.split('.').pop().toLowerCase();
    
    let text = "";
    
    if (extension === 'pdf') {
      try {
        if (typeof globalThis.DOMMatrix === "undefined") {
          globalThis.DOMMatrix = class DOMMatrix {};
        }
        const pdfParse = require("pdf-parse");
        if (typeof pdfParse === 'function') {
          const pdfData = await pdfParse(file.buffer);
          text = pdfData.text;
        } else if (pdfParse && pdfParse.PDFParse) {
          const parser = new pdfParse.PDFParse({ data: file.buffer });
          const result = await parser.getText();
          await parser.destroy();
          text = result.text;
        } else {
          throw new Error("PDF parser module interface unrecognized");
        }
      } catch (pdfErr) {
        console.error("PDF parse inner error:", pdfErr);
        throw pdfErr;
      }
    } else if (['txt', 'md', 'csv', 'json'].includes(extension)) {
      text = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ message: "Unsupported file type. Please upload a PDF or text file." });
    }
    
    res.json({ text });
  } catch (error) {
    console.error("Document parse error:", error);
    res.status(422).json({ message: "Failed to parse document. The file may be damaged." });
  }
});


router.get("/tip", async (req, res) => {
  try {
    const tip = await getStudyTip();
    res.json({ tip });
  } catch (error) {
    res.json({ tip: "Take regular breaks while studying!" });
  }
});

router.post("/attendance-alert", authMiddleware, validate({ body: attendanceAlertSchema }), async (req, res, next) => {
  try {
    const { subject, total, attended, threshold } = req.body;
    const result = await attendanceAlert(subject, total, attended, threshold);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/chat", authMiddleware, validate({ body: chatSchema }), async (req, res, next) => {
  try {
    const { messages } = req.body;
    const reply = await chatResponse(messages);
    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

router.post("/flashcards", authMiddleware, validate({ body: notesSchema }), async (req, res, next) => {
  try {
    const { notes } = req.body;
    const flashcards = await generateFlashcards(notes);
    res.json({ flashcards });
  } catch (error) {
    next(error);
  }
});

router.post("/quiz", authMiddleware, validate({ body: quizGenerateSchema }), async (req, res, next) => {
  try {
    const { notes, count, type } = req.body;
    const questions = await generateQuiz(notes, count, type || "mcq");
    res.json({ questions });
  } catch (error) {
    next(error);
  }
});

router.post("/grade-short-answer", authMiddleware, validate({ body: gradeShortAnswerSchema }), async (req, res, next) => {
  try {
    const { question, modelAnswer, userAnswer } = req.body;
    const result = await gradeShortAnswer(question, modelAnswer, userAnswer);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/tool/:toolSlug", authMiddleware, validate({ params: toolParamsSchema, body: toolBodySchema }), async (req, res, next) => {
  try {
    const { toolSlug } = req.params;
    const { content, options } = req.body;
    if (!content && toolSlug !== 'study-schedule') {
      return res.status(400).json({ message: "content: Content input is required" });
    }
    const result = await executeSmartTool(toolSlug, content, options);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
