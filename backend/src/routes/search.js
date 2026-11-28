const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { searchQuerySchema } = require("../schemas/search");

const router = express.Router();
router.use(authMiddleware);

const PER_TYPE = 5;

// One entry per result type: where to look, which columns match, and where the result opens.
const SOURCES = [
  { type: "task", table: "tasks", title: "title", match: ["title", "subject", "description"], snippet: "subject", page: "/dashboard/tasks" },
  { type: "notice", table: "notices", title: "event_title", match: ["event_title", "notice_text"], snippet: "notice_text", page: "/dashboard/notices" },
  { type: "note", table: "notes", title: "title", match: ["title", "content"], snippet: "content", page: "/dashboard/notes" },
  { type: "deck", table: "flashcard_decks", title: "title", match: ["title"], page: "/dashboard/flashcards" },
  { type: "board", table: "whiteboards", title: "title", match: ["title"], page: "/dashboard/whiteboard" },
  { type: "quiz", table: "quizzes", title: "title", match: ["title"], page: "/dashboard/quiz" },
];

// A case-insensitive regex match with everything escaped. ilike cannot search literally,
// because the database API also reads * as a wildcard there.
const literalPattern = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function snippetFrom(text, q) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(q.toLowerCase());
  const start = Math.max(0, at - 30);
  const cut = flat.slice(start, start + 100);
  return `${start > 0 ? "…" : ""}${cut}${start + 100 < flat.length ? "…" : ""}`;
}

async function searchSource(source, studentId, q) {
  const columns = [...new Set(["id", source.title, source.snippet].filter(Boolean))].join(", ");
  // One query per column, so the search text is never spliced into a filter string.
  const found = await Promise.all(
    source.match.map(async (column) => {
      const { data, error } = await getClient()
        .from(source.table)
        .select(columns)
        .eq("student_id", studentId)
        .filter(column, "imatch", literalPattern(q))
        .limit(PER_TYPE);
      if (error) throw error;
      return data || [];
    })
  );
  const unique = new Map(found.flat().map((row) => [row.id, row]));

  return [...unique.values()].slice(0, PER_TYPE).map((row) => ({
    type: source.type,
    id: row.id,
    title: row[source.title] || String(row[source.snippet] || "Untitled").slice(0, 60),
    snippet: source.snippet ? snippetFrom(row[source.snippet], q) : "",
    href: `${source.page}?open=${row.id}`,
  }));
}

router.get("/", validate({ query: searchQuerySchema }), async (req, res, next) => {
  try {
    const { q } = req.query;
    const groups = await Promise.all(SOURCES.map((s) => searchSource(s, req.student.id, q)));
    res.json({ results: groups.flat() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
