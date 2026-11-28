"use client";

import { useQueryAction } from "@/hooks/useQueryAction";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award01 as Award,
  BookOpen01 as BookOpen,
  File01 as FileSpreadsheet,
  HelpCircle,
  List as ListOrdered,
  Loading01 as Loader2,
  Plus,
  RefreshCcw01 as RefreshCw,
  Stars01 as Sparkles,
  Trash01 as Trash2,
  Upload01 as Upload,
  XClose as X,
} from "@untitledui/icons";
import { activateOnKey } from "@/lib/a11y";
import { useEscape } from "@/hooks/useEscape";
import { api } from "@/lib/api";
import type { Quiz, QuizQuestion, QuizType } from "@/features/types";

interface GeneratedQuestion {
  question: string;
  options?: string[];
  correctIndex?: number;
  modelAnswer?: string;
  explanation?: string;
  citation?: string;
}

interface PdfJsViewport {
  str: string;
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: PdfJsViewport[] }>;
      }>;
    }>;
  };
}

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  // Modal state for New Quiz
  const [isNewQuizModalOpen, setIsNewQuizModalOpen] = useState(false);
  useEscape(isNewQuizModalOpen, () => setIsNewQuizModalOpen(false));
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizContent, setNewQuizContent] = useState("");
  const [newQuizCount, setNewQuizCount] = useState(5);
  const [newQuizType, setNewQuizType] = useState<QuizType>("mcq");

  // File Upload Status
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [modalTab, setModalTab] = useState<"text" | "upload">("text");

  // Active Quiz State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Workspace Views: "interactive" | "review-sheet"
  const [activeView, setActiveView] = useState<"interactive" | "review-sheet">("interactive");
  const [reviewFilter, setReviewFilter] = useState<"all" | "mistakes">("all");

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await api.get<{ quizzes: Quiz[] }>("/api/quizzes");
      setQuizzes(res.quizzes || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  useQueryAction("open", quizzes.length > 0, (id) => {
    if (quizzes.some((q) => q.id === id)) setSelectedQuizId(id);
  });

  // Prefill new quiz modal when opened from Notes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("Quill_prefill_quiz");
    if (!raw) return;
    sessionStorage.removeItem("Quill_prefill_quiz");
    try {
      const parsed = JSON.parse(raw) as { title?: string; content?: string };
      queueMicrotask(() => {
        if (parsed.title) setNewQuizTitle(parsed.title);
        if (parsed.content) setNewQuizContent(parsed.content);
        setModalTab("text");
        setUploadError("");
        setIsNewQuizModalOpen(true);
      });
    } catch {
      // ignore malformed prefill
    }
  }, []);

  useEffect(() => {
    if (!selectedQuizId) {
      setQuiz(null);
      setQuestions([]);
      setSubmitError("");
      return;
    }

    let cancelled = false;
    const loadQuiz = async () => {
      setLoading(true);
      setError("");
      setSubmitError("");
      try {
        const res = await api.get<{ quiz: Quiz; questions: QuizQuestion[] }>(
          `/api/quizzes/${selectedQuizId}`
        );
        if (cancelled) return;
        setQuiz(res.quiz);
        setQuestions(res.questions || []);

        const loadedAnswers: Record<number, number> = {};
        const loadedTextAnswers: Record<number, string> = {};
        (res.questions || []).forEach((q, idx) => {
          if (q.user_answer_index !== null && q.user_answer_index !== undefined) {
            loadedAnswers[idx] = q.user_answer_index;
          }
          if (typeof q.user_answer_text === "string" && q.user_answer_text.length > 0) {
            loadedTextAnswers[idx] = q.user_answer_text;
          }
        });

        const isDone = res.quiz.score !== null && res.quiz.score !== undefined;
        setAnswers(loadedAnswers);
        setTextAnswers(loadedTextAnswers);
        setSubmitted(isDone);
        setActiveQuestionIndex(0);
        setReviewFilter("all");
        setActiveView(isDone ? "review-sheet" : "interactive");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load quiz");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadQuiz();
    return () => {
      cancelled = true;
    };
  }, [selectedQuizId]);

  const loadPdfJs = async (): Promise<PdfJsLib | null> => {
    if (typeof window === "undefined") return null;
    const win = window as unknown as { pdfjsLib?: PdfJsLib };
    if (win.pdfjsLib) return win.pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        if (win.pdfjsLib) {
          win.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
          resolve(win.pdfjsLib);
        } else {
          reject(new Error("PDF reader failed to initialize."));
        }
      };
      script.onerror = () =>
        reject(new Error("Failed to load PDF parsing library. Check internet connectivity."));
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    setUploadError("");

    try {
      let extractedText = "";

      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjsLib = await loadPdfJs();
        if (!pdfjsLib) throw new Error("Could not initialize PDF reader module.");

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          fullText += pageText + "\n\n";
        }
        extractedText = fullText;
      } else {
        extractedText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve((event.target?.result as string) || "");
          reader.onerror = () => reject(new Error("Failed to read text document."));
          reader.readAsText(file);
        });
      }

      if (!extractedText.trim()) {
        throw new Error("No readable text content could be extracted from this document.");
      }

      setNewQuizTitle(file.name.replace(/\.[^/.]+$/, ""));
      setNewQuizContent(extractedText);
      setModalTab("text");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error reading uploaded file.");
    } finally {
      setFileLoading(false);
      e.target.value = "";
    }
  };

  const handleGenerateQuiz = async () => {
    if (!newQuizTitle.trim() || !newQuizContent.trim()) {
      toast.error("Please provide both a title and notes text content.");
      return;
    }

    setLoading(true);
    setError("");
    setIsNewQuizModalOpen(false);

    try {
      const aiType = newQuizType === "short" ? "short_answer" : newQuizType;
      const aiRes = await api.post<{ questions: GeneratedQuestion[] }>("/api/ai/quiz", {
        notes: newQuizContent,
        count: newQuizCount,
        type: aiType,
      });

      if (!aiRes.questions || aiRes.questions.length === 0) {
        throw new Error("AI did not generate any quiz questions.");
      }

      const saveRes = await api.post<{ quiz: Quiz }>("/api/quizzes", {
        title: newQuizTitle,
        questions: aiRes.questions.map((q) => ({
          ...q,
          type: newQuizType,
        })),
      });

      setQuizzes((prev) => [saveRes.quiz, ...prev]);
      setSelectedQuizId(saveRes.quiz.id);

      setNewQuizTitle("");
      setNewQuizContent("");
      setNewQuizCount(5);
      setNewQuizType("mcq");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await api.delete(`/api/quizzes/${id}`);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      if (selectedQuizId === id) {
        setSelectedQuizId(null);
      }
    } catch {
      toast.error("Failed to delete quiz.");
    }
  };

  const handleSelectOption = (optIndex: number) => {
    if (submitted || submitting) return;
    setAnswers((prev) => ({ ...prev, [activeQuestionIndex]: optIndex }));
  };

  const handleTextAnswerChange = (value: string) => {
    if (submitted || submitting) return;
    setTextAnswers((prev) => ({ ...prev, [activeQuestionIndex]: value }));
  };

  const isQuestionAnswered = (q: QuizQuestion, idx: number) => {
    if ((q.type || "mcq") === "short") {
      return Boolean(textAnswers[idx]?.trim());
    }
    return answers[idx] !== undefined;
  };

  const answeredCount = questions.filter((q, idx) => isQuestionAnswered(q, idx)).length;
  const unansweredCount = questions.length - answeredCount;

  const submitQuizToServer = async () => {
    if (!selectedQuizId) return;
    setSubmitting(true);
    setSubmitError("");
    setError("");

    try {
      const submissionAnswers = questions.map((q, i) => {
        if ((q.type || "mcq") === "short") {
          return {
            question_id: q.id,
            user_answer_index: null,
            user_answer_text: textAnswers[i] ?? "",
          };
        }
        return {
          question_id: q.id,
          user_answer_index: answers[i] ?? -1,
          user_answer_text: null,
        };
      });

      const res = await api.patch<{
        quiz: Quiz;
        questions: QuizQuestion[];
      }>(`/api/quizzes/${selectedQuizId}/submit`, {
        answers: submissionAnswers,
      });

      setQuiz(res.quiz);
      setQuestions(res.questions || []);
      setSubmitted(true);
      setActiveQuestionIndex(0);
      setReviewFilter("all");
      setActiveView("review-sheet");
      setQuizzes((prev) =>
        prev.map((q) => (q.id === selectedQuizId ? { ...q, score: res.quiz.score } : q))
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Grading failed. Your answers were not scored—please retry.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (unansweredCount > 0) {
      if (
        !confirm(
          `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? "s" : ""}. Submit anyway?`
        )
      ) {
        return;
      }
    }
    await submitQuizToServer();
  };

  const handleRetake = async () => {
    if (!selectedQuizId || retaking) return;
    setRetaking(true);
    setError("");
    setSubmitError("");
    try {
      const res = await api.post<{ quiz: Quiz; questions: QuizQuestion[] }>(
        `/api/quizzes/${selectedQuizId}/retake`,
        {}
      );
      setQuiz(res.quiz);
      setQuestions(res.questions || []);
      setAnswers({});
      setTextAnswers({});
      setSubmitted(false);
      setActiveQuestionIndex(0);
      setReviewFilter("all");
      setActiveView("interactive");
      setQuizzes((prev) =>
        prev.map((q) => (q.id === selectedQuizId ? { ...q, score: null } : q))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset quiz.");
    } finally {
      setRetaking(false);
    }
  };

  const activeQuestion = questions[activeQuestionIndex];
  const mistakeQuestions = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => q.is_correct === false);
  const reviewItems =
    reviewFilter === "mistakes"
      ? mistakeQuestions
      : questions.map((q, idx) => ({ q, idx }));

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-6rem)] lg:h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 flex-shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Quizzes</h1>

        {questions.length > 0 && selectedQuizId && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetake}
              disabled={!submitted || retaking}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-[10px] hover:opacity-90 disabled:opacity-50 transition-standard cursor-pointer text-sm"
            >
              {retaking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Retake Quiz
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive animate-in fade-in duration-200 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="p-4 mb-4 bg-destructive/10 border border-destructive/30 rounded-[10px] text-sm text-destructive flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Grading failed (not scored): {submitError}</span>
          </div>
          <button
            type="button"
            onClick={submitQuizToServer}
            disabled={submitting}
            className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-[10px] hover:opacity-90 disabled:opacity-50 transition-standard cursor-pointer inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Retry Submit
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-1 min-h-0 lg:overflow-y-auto pb-6 pr-1">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-border rounded-[10px] p-5 space-y-4 shadow-sm lg:h-full flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 mb-2 border-b border-border pb-4">
              <h2 className="font-semibold text-foreground text-xs uppercase tracking-wider font-mono">
                Your Quizzes
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNewQuizTitle("");
                  setNewQuizContent("");
                  setModalTab("text");
                  setUploadError("");
                  setIsNewQuizModalOpen(true);
                }}
                className="text-xs font-semibold text-primary hover:text-foreground flex items-center gap-1 transition-standard cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                New Quiz
              </button>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {quizzes.length === 0 ? (
                <div className="border border-dashed border-border rounded-[10px] p-6 text-center text-xs text-muted-foreground font-sans italic">
                  No quizzes found. Create one to start studying.
                </div>
              ) : (
                quizzes.map((q) => {
                  const isSelected = selectedQuizId === q.id;
                  return (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuizId(q.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={activateOnKey}
                      className={`group border rounded-[10px] p-3 transition-standard cursor-pointer flex items-start gap-2.5 relative ${
                        isSelected
                          ? "bg-card border-primary/50 shadow-sm"
                          : "bg-transparent border-border hover:bg-muted/45"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <BookOpen
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              isSelected ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <h3 className="font-semibold text-xs text-foreground truncate pr-8">
                            {q.title}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {q.score !== null && q.score !== undefined
                            ? `Score: ${q.score}%`
                            : "Not completed"}
                        </p>
                      </div>

                      <div
                        className="absolute right-2 top-2 flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-standard"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Delete quiz ${q.title}`}
                          onClick={(e) => handleDeleteQuiz(q.id, e)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-[10px] transition-standard cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Workspace */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {/* Empty State */}
          {!selectedQuizId && !loading && (
            <div className="bg-card border border-border rounded-[10px] p-8 sm:p-12 text-center shadow-sm">
              <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Assessment Center</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Select a quiz from the left or create a new one to start studying.
              </p>

              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setNewQuizTitle("");
                    setNewQuizContent("");
                    setModalTab("text");
                    setUploadError("");
                    setIsNewQuizModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-[10px] text-xs transition-standard cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate New Quiz
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="h-[460px] border border-border rounded-[10px] bg-card flex flex-col items-center justify-center text-center p-8 shadow-sm">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <h2 className="text-lg font-bold text-foreground font-sans">
                {selectedQuizId && !questions.length ? "Loading Quiz..." : "Drafting Questions..."}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs font-sans italic mt-1.5 leading-relaxed">
                Please wait while we process the assessment...
              </p>
            </div>
          )}

          {/* Active Quiz */}
          {selectedQuizId && questions.length > 0 && !loading && (
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-border pb-2 gap-3">
                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-[10px] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveView("interactive")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-standard cursor-pointer ${
                      activeView === "interactive"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    Interactive Workspace
                  </button>

                  {submitted && (
                    <button
                      type="button"
                      onClick={() => setActiveView("review-sheet")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-standard cursor-pointer ${
                        activeView === "review-sheet"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Detailed Review Sheet
                    </button>
                  )}
                </div>

                <div className="text-xs font-semibold">
                  {submitted ? (
                    <span className="inline-block text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-[10px] uppercase tracking-wider font-mono">
                      SCORE: {quiz?.score}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Progress: {answeredCount} / {questions.length} answered
                    </span>
                  )}
                </div>
              </div>

              {/* View Rendering */}
              {!submitted || activeView === "interactive" ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  <div className="md:col-span-8 bg-card border border-border rounded-[10px] p-5 sm:p-6 shadow-sm space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-shrink-0 mb-4 gap-2">
                        <span className="text-xs font-bold text-primary tracking-wider uppercase font-mono">
                          QUESTION {activeQuestionIndex + 1} OF {questions.length}
                        </span>

                        {submitted && (
                          activeQuestion.is_correct ? (
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-[10px]">
                              ✓ Correct
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-destructive bg-destructive/10 px-2.5 py-0.5 rounded-[10px]">
                              ✗ Incorrect
                            </span>
                          )
                        )}
                      </div>

                      <h2 className="text-lg font-bold text-foreground font-sans leading-relaxed">
                        {activeQuestion.question}
                      </h2>
                    </div>

                    {/* Question Input: Short Answer vs MCQ/TF */}
                    {(activeQuestion.type || "mcq") === "short" ? (
                      <div className="space-y-3">
                        <label
                          htmlFor={`short-answer-${activeQuestion.id}`}
                          className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                        >
                          Your Answer
                        </label>
                        <textarea
                          id={`short-answer-${activeQuestion.id}`}
                          value={textAnswers[activeQuestionIndex] ?? ""}
                          onChange={(e) => handleTextAnswerChange(e.target.value)}
                          disabled={submitted || submitting}
                          rows={4}
                          placeholder="Write your short answer here..."
                          className="w-full px-3.5 py-2.5 bg-background border border-border rounded-[10px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-75"
                        />

                        {submitted && activeQuestion.feedback && (
                          <div className="bg-muted border border-border rounded-[10px] p-3.5 text-xs text-foreground leading-relaxed">
                            <strong className="text-primary block mb-1 uppercase tracking-wider">
                              AI Grader Feedback:
                            </strong>
                            {activeQuestion.feedback}
                          </div>
                        )}

                        {submitted && activeQuestion.model_answer && (
                          <div className="bg-primary/5 border border-primary/20 rounded-[10px] p-3.5 text-xs text-foreground leading-relaxed">
                            <strong className="text-primary block mb-1 uppercase tracking-wider">
                              Model Answer:
                            </strong>
                            {activeQuestion.model_answer}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {activeQuestion.options?.map((option, optIdx) => {
                          const isSelected = answers[activeQuestionIndex] === optIdx;
                          const isCorrect =
                            submitted && activeQuestion.correct_index === optIdx;
                          const optionLetter = String.fromCharCode(65 + optIdx);

                          let cardStyle =
                            "flex items-center gap-3.5 p-4 border border-border rounded-[10px] text-sm cursor-pointer transition-standard hover:bg-muted/50 hover:border-primary/50 text-foreground";
                          let letterBadgeStyle =
                            "w-7 h-7 rounded-full bg-muted text-muted-foreground font-semibold text-xs flex items-center justify-center flex-shrink-0 transition-standard";

                          if (submitted) {
                            if (isCorrect) {
                              cardStyle =
                                "flex items-center gap-3.5 p-4 border border-primary/40 bg-primary/10 text-foreground rounded-[10px] text-sm font-medium";
                              letterBadgeStyle =
                                "w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center flex-shrink-0";
                            } else if (isSelected) {
                              cardStyle =
                                "flex items-center gap-3.5 p-4 border border-destructive/30 bg-destructive/10 text-destructive rounded-[10px] text-sm font-medium";
                              letterBadgeStyle =
                                "w-7 h-7 rounded-full bg-destructive text-destructive-foreground font-bold text-xs flex items-center justify-center flex-shrink-0";
                            } else {
                              cardStyle =
                                "flex items-center gap-3.5 p-4 border border-border rounded-[10px] text-sm opacity-60 pointer-events-none text-muted-foreground";
                            }
                          } else if (isSelected) {
                            cardStyle =
                              "flex items-center gap-3.5 p-4 border border-primary bg-primary/10 text-foreground rounded-[10px] text-sm font-semibold shadow-sm";
                            letterBadgeStyle =
                              "w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center flex-shrink-0";
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(optIdx)}
                              disabled={submitted || submitting}
                              className={`${cardStyle} w-full text-left`}
                            >
                              <span className={letterBadgeStyle}>{optionLetter}</span>
                              <span className="font-sans">{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {submitted && (
                      <div className="space-y-3.5 border-t border-border pt-4">
                        {activeQuestion.explanation && (
                          <div className="bg-muted border border-border rounded-[10px] p-4 text-xs text-muted-foreground font-sans leading-relaxed">
                            <strong className="text-primary font-sans block mb-1 uppercase tracking-wider text-xs">
                              Explanation Key:
                            </strong>
                            {activeQuestion.explanation}
                          </div>
                        )}

                        {activeQuestion.citation && (
                          <div className="bg-muted border-l-2 border-primary p-3 text-xs text-muted-foreground font-sans italic rounded-r-[4px]">
                            <strong className="text-xs font-bold text-primary font-sans block not-italic uppercase mb-0.5">
                              Reference Source Quote:
                            </strong>
                            &ldquo;{activeQuestion.citation}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-4 mt-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeQuestionIndex === 0}
                        className="inline-flex items-center gap-1 px-3.5 py-2 border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-[10px] transition-standard disabled:opacity-50 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Previous
                      </button>

                      {activeQuestionIndex < questions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-[10px] transition-standard cursor-pointer"
                        >
                          Next <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        !submitted && (
                          <button
                            type="button"
                            onClick={handleSubmitQuiz}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-[10px] transition-standard shadow-sm cursor-pointer"
                          >
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {submitting ? "Grading..." : "Submit Exam"}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Question Grid */}
                  <div className="md:col-span-4 bg-card border border-border rounded-[10px] p-5 space-y-4 shadow-sm">
                    <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider font-mono">
                      Question Tracker
                    </h3>

                    <div className="grid grid-cols-5 gap-2">
                      {questions.map((q, idx) => {
                        const isCurrent = activeQuestionIndex === idx;
                        const isAnswered = isQuestionAnswered(q, idx);
                        const correct = Boolean(q.is_correct);

                        let dotStyle =
                          "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold font-sans cursor-pointer transition-standard border ";

                        if (submitted) {
                          dotStyle += correct
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-destructive/10 border-destructive text-destructive";
                        } else if (isCurrent) {
                          dotStyle += "bg-primary border-primary text-primary-foreground shadow-sm";
                        } else if (isAnswered) {
                          dotStyle += "bg-muted border-primary/40 text-foreground";
                        } else {
                          dotStyle += "bg-card border-border text-muted-foreground";
                        }

                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setActiveQuestionIndex(idx)}
                            aria-label={`Go to question ${idx + 1}`}
                            className={dotStyle}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {!submitted && unansweredCount > 0 && (
                      <div className="p-3 bg-muted border border-border text-foreground rounded-[10px] text-xs font-sans leading-normal">
                        <strong>
                          {unansweredCount} item{unansweredCount > 1 ? "s" : ""} left.
                        </strong>{" "}
                        Complete all responses.
                      </div>
                    )}

                    {!submitted && unansweredCount === 0 && (
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        disabled={submitting}
                        className="w-full py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-xs font-semibold rounded-[10px] transition-standard shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {submitting ? "Grading..." : "Submit Responses"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* REVIEW SHEET */
                <div className="space-y-6">
                  <div className="bg-card border border-border rounded-[10px] p-6 sm:p-8 shadow-sm text-center space-y-6">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-2">
                        <Award className="w-7 h-7" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground font-sans">
                        Assessment Summary
                      </h2>
                      <p className="text-sm text-muted-foreground font-sans italic">
                        {mistakeQuestions.length === 0
                          ? "Perfect score — no mistakes to review."
                          : `${mistakeQuestions.length} mistake${mistakeQuestions.length > 1 ? "s" : ""} to review below.`}
                      </p>
                    </div>

                    <div className="max-w-xs mx-auto bg-background border border-border rounded-[10px] p-5 text-center space-y-1 shadow-sm">
                      <div className="text-4xl font-extrabold text-primary">{quiz?.score}%</div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                        Score
                      </div>
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden mt-3.5">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${quiz?.score || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-border max-w-md mx-auto">
                      <button
                        type="button"
                        onClick={handleRetake}
                        disabled={retaking}
                        className="px-4 py-2 border border-primary hover:bg-primary/10 text-primary font-semibold rounded-[10px] text-xs transition-standard flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {retaking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Retake Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView("interactive")}
                        className="px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-[10px] text-xs transition-standard shadow-sm cursor-pointer"
                      >
                        Inspect Interactive
                      </button>
                    </div>
                  </div>

                  {/* Filter: All vs Mistakes */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-[10px]">
                      <button
                        type="button"
                        onClick={() => setReviewFilter("all")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-standard cursor-pointer ${
                          reviewFilter === "all"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Questions ({questions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewFilter("mistakes")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-standard cursor-pointer ${
                          reviewFilter === "mistakes"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Mistakes ({mistakeQuestions.length})
                      </button>
                    </div>
                  </div>

                  {reviewItems.length === 0 ? (
                    <div className="bg-card border border-border rounded-[10px] p-8 text-center text-sm text-muted-foreground">
                      No mistakes on this quiz.
                    </div>
                  ) : (
                    <div className="bg-card border border-border rounded-[10px] overflow-hidden divide-y divide-border shadow-sm">
                      {reviewItems.map(({ q, idx: qidx }) => {
                        const passed = Boolean(q.is_correct);
                        return (
                          <div key={q.id} className="p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between flex-shrink-0 gap-2">
                              <span className="bg-muted text-foreground text-xs px-2 py-0.5 rounded-[10px] font-mono font-bold">
                                QUESTION {qidx + 1}
                              </span>
                              <span
                                className={`text-xs font-bold px-3 py-0.5 rounded-full border ${
                                  passed
                                    ? "text-primary bg-primary/10 border-primary/20"
                                    : "text-destructive bg-destructive/10 border-destructive/20"
                                }`}
                              >
                                {passed ? "✓ Correct" : "✗ Incorrect"}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-foreground font-sans">
                              {q.question}
                            </h3>

                            {(q.type || "mcq") === "short" ? (
                              <div className="space-y-2.5 text-xs">
                                <div className="p-3 rounded-[10px] border border-border bg-background">
                                  <strong className="block text-muted-foreground uppercase mb-1">
                                    Your Answer:
                                  </strong>
                                  <span className="text-foreground">
                                    {q.user_answer_text || "No answer provided."}
                                  </span>
                                </div>
                                {q.model_answer && (
                                  <div className="p-3 rounded-[10px] border border-primary/25 bg-primary/5">
                                    <strong className="block text-primary uppercase mb-1">
                                      Model Answer:
                                    </strong>
                                    <span className="text-foreground">{q.model_answer}</span>
                                  </div>
                                )}
                                {q.feedback && (
                                  <div className="p-3 rounded-[10px] border border-border bg-muted">
                                    <strong className="block text-primary uppercase mb-1">
                                      Grader Feedback:
                                    </strong>
                                    <span className="text-foreground">{q.feedback}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              q.options && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {q.options.map((opt, oidx) => {
                                    const selectedByUs = q.user_answer_index === oidx;
                                    const correctOne = q.correct_index === oidx;
                                    let style =
                                      "text-xs p-2.5 border rounded-[10px] flex items-center gap-2 font-sans ";
                                    if (correctOne) {
                                      style +=
                                        "border-primary/40 bg-primary/10 text-foreground font-semibold";
                                    } else if (selectedByUs) {
                                      style +=
                                        "border-destructive/40 bg-destructive/10 text-destructive font-semibold";
                                    } else {
                                      style += "border-border text-muted-foreground opacity-70";
                                    }

                                    return (
                                      <div key={oidx} className={style}>
                                        <span className="font-semibold">
                                          {String.fromCharCode(65 + oidx)}.
                                        </span>
                                        <span>{opt}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                            )}

                            <div className="space-y-2.5">
                              {q.explanation && (
                                <div className="bg-muted border border-border rounded-[10px] p-4 text-xs text-muted-foreground font-sans leading-relaxed">
                                  <strong className="text-primary font-sans block mb-1 uppercase tracking-wider text-xs">
                                    Concept Explanation:
                                  </strong>
                                  {q.explanation}
                                </div>
                              )}
                              {q.citation && (
                                <div className="bg-muted border-l-2 border-primary p-3.5 text-xs text-muted-foreground font-sans italic rounded-r-[4px]">
                                  <strong className="text-xs font-bold text-primary font-sans block not-italic uppercase mb-0.5">
                                    Supporting Citation:
                                  </strong>
                                  &ldquo;{q.citation}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Quiz Modal */}
      {isNewQuizModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Generate New Quiz"
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
        >
          <div className="bg-card rounded-[12px] border border-border shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-2">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generate New Quiz
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsNewQuizModalOpen(false)}
                className="p-1 hover:bg-accent rounded-full text-muted-foreground transition-standard cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1 bg-muted/60 p-1 rounded-[10px]">
              <button
                type="button"
                onClick={() => setModalTab("text")}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-[10px] transition-standard cursor-pointer ${
                  modalTab === "text"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Write / Paste Text
              </button>
              <button
                type="button"
                onClick={() => setModalTab("upload")}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-[10px] transition-standard cursor-pointer ${
                  modalTab === "upload"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Upload File
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-[10px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {modalTab === "text" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="quiz-title-input"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider"
                  >
                    Quiz Title *
                  </label>
                  <input
                    id="quiz-title-input"
                    type="text"
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    placeholder="e.g. Photosynthesis Chapter 4"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="quiz-format-select"
                      className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider"
                    >
                      Format
                    </label>
                    <select
                      id="quiz-format-select"
                      value={newQuizType}
                      onChange={(e) => setNewQuizType(e.target.value as QuizType)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    >
                      <option value="mcq">MCQ (4 choices)</option>
                      <option value="tf">True / False</option>
                      <option value="short">Short Answer</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="quiz-count-select"
                      className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider"
                    >
                      Questions
                    </label>
                    <select
                      id="quiz-count-select"
                      value={newQuizCount}
                      onChange={(e) => setNewQuizCount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-card border border-border rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    >
                      <option value={3}>3 Items</option>
                      <option value={5}>5 Items</option>
                      <option value={10}>10 Items</option>
                      <option value={15}>15 Items</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="quiz-notes-textarea"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider"
                  >
                    Study Notes / Content *
                  </label>
                  <textarea
                    id="quiz-notes-textarea"
                    value={newQuizContent}
                    onChange={(e) => setNewQuizContent(e.target.value)}
                    className="w-full h-44 px-3 py-2 bg-card border border-border rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none text-foreground font-sans leading-relaxed"
                    placeholder="Paste details or notes to generate quiz from..."
                  />
                </div>
              </div>
            )}

            {modalTab === "upload" && (
              <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[10px] bg-card transition-standard hover:bg-background/50 text-center p-6 relative">
                {fileLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs font-sans text-muted-foreground italic animate-pulse">
                      Parsing document text...
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                    <p className="text-xs font-bold text-foreground">Select study document</p>
                    <p className="text-xs text-muted-foreground mt-1 font-sans max-w-xs leading-normal">
                      Drag and drop your file here, or click to browse. Supports{" "}
                      <strong className="text-primary">PDF, TXT, and Markdown (.md)</strong>.
                    </p>
                    <input
                      type="file"
                      aria-label="Upload study document"
                      accept=".pdf,.txt,.md"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-4">
              <button
                type="button"
                onClick={() => setIsNewQuizModalOpen(false)}
                className="px-4 py-2 border border-border hover:bg-muted text-foreground font-semibold rounded-[10px] text-xs transition-standard cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={modalTab !== "text" || !newQuizTitle.trim() || !newQuizContent.trim()}
                className="px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-semibold rounded-[10px] text-xs transition-standard shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Generate Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
