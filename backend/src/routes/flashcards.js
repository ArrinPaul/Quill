const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const {
  deckIdParamSchema,
  cardInputSchema,
  createDeckSchema,
  updateCardStatusSchema,
} = require("../schemas/flashcards");
const { logActivity } = require("../services/activity");

const router = express.Router();
router.use(authMiddleware);

// --- Flashcard Decks & Cards ---

// Get all decks
router.get("/decks", async (req, res, next) => {
  try {
    const { data: decks, error } = await getClient()
      .from("flashcard_decks")
      .select("*, flashcards(*)")
      .eq("student_id", req.student.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ decks });
  } catch (error) {
    next(error);
  }
});

// Save a new deck with flashcards
router.post("/decks", validate({ body: createDeckSchema }), async (req, res, next) => {
  try {
    const { title, flashcards } = req.body;

    const supabase = getClient();

    // 1. Create Deck
    const { data: deck, error: deckError } = await supabase
      .from("flashcard_decks")
      .insert({ student_id: req.student.id, title })
      .select()
      .single();

    if (deckError) throw deckError;

    // 2. Create Flashcards
    const cardsToInsert = flashcards.map(card => ({
      deck_id: deck.id,
      front: card.front,
      back: card.back,
      citation: card.citation || null,
      status: card.status || 'unseen'
    }));

    const { data: savedCards, error: cardsError } = await supabase
      .from("flashcards")
      .insert(cardsToInsert)
      .select();

    if (cardsError) {
      // Roll back so a failed save doesn't leave an empty deck behind
      await supabase.from("flashcard_decks").delete().eq("id", deck.id);
      throw cardsError;
    }

    await logActivity(req.student.id, "deck_created", deck.title, deck.id);

    res.status(201).json({ deck, flashcards: savedCards });
  } catch (error) {
    next(error);
  }
});

// Delete a deck and its flashcards
router.delete("/decks/:deckId", validate({ params: deckIdParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("flashcard_decks")
      .delete()
      .eq("id", req.params.deckId)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "Deck not found" });
    res.json({ message: "Deck deleted" });
  } catch (error) {
    next(error);
  }
});

// Add a manual card to an existing deck
router.post("/decks/:deckId/cards", validate({ params: deckIdParamSchema, body: cardInputSchema }), async (req, res, next) => {
  try {
    const { front, back, citation } = req.body;

    const supabase = getClient();
    const { data: deck, error: deckError } = await supabase
      .from("flashcard_decks")
      .select("id")
      .eq("id", req.params.deckId)
      .eq("student_id", req.student.id)
      .single();

    if (deckError || !deck) {
      return res.status(404).json({ message: "Deck not found" });
    }

    const { data: card, error } = await supabase
      .from("flashcards")
      .insert({
        deck_id: deck.id,
        front,
        back,
        citation: citation || null,
        status: "unseen",
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ card });
  } catch (error) {
    next(error);
  }
});

// Edit an existing flashcard
router.put("/:id", validate({ params: idParamSchema, body: cardInputSchema }), async (req, res, next) => {
  try {
    const { front, back, citation } = req.body;

    const supabase = getClient();
    const { data: existing, error: fetchError } = await supabase
      .from("flashcards")
      .select("id, flashcard_decks!inner(student_id)")
      .eq("id", req.params.id)
      .eq("flashcard_decks.student_id", req.student.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    const { data: card, error } = await supabase
      .from("flashcards")
      .update({
        front,
        back,
        citation: citation || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ card });
  } catch (error) {
    next(error);
  }
});

// Delete a flashcard
router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const supabase = getClient();
    const { data: existing, error: fetchError } = await supabase
      .from("flashcards")
      .select("id, flashcard_decks!inner(student_id)")
      .eq("id", req.params.id)
      .eq("flashcard_decks.student_id", req.student.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    const { data, error } = await supabase
      .from("flashcards")
      .delete()
      .eq("id", req.params.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "Flashcard not found" });
    res.json({ message: "Flashcard deleted" });
  } catch (error) {
    next(error);
  }
});

// Update flashcard status & SM-2 spaced repetition schedule
router.patch("/:id/status", validate({ params: idParamSchema, body: updateCardStatusSchema }), async (req, res, next) => {
  try {
    const { status } = req.body;

    const supabase = getClient();
    const { data: existing, error: fetchError } = await supabase
      .from("flashcards")
      .select("*, flashcard_decks!inner(student_id)")
      .eq("id", req.params.id)
      .eq("flashcard_decks.student_id", req.student.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    // SM-2 simplified calculation: mastered -> quality 5, review -> quality 2, unseen -> reset
    let repetitions = existing.repetitions || 0;
    let intervalDays = existing.interval_days || 0;
    let easeFactor = Number(existing.ease_factor || 2.5);

    if (status === "mastered") {
      repetitions += 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 6;
      else intervalDays = Math.round(intervalDays * easeFactor);
      easeFactor = Math.max(1.3, easeFactor + 0.1);
    } else if (status === "review") {
      repetitions = 0;
      intervalDays = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
      repetitions = 0;
      intervalDays = 0;
    }

    const nextReviewAt = new Date(Date.now() + intervalDays * 86400000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: card, error } = await supabase
      .from("flashcards")
      .update({
        status,
        repetitions,
        interval_days: intervalDays,
        ease_factor: easeFactor,
        next_review_at: nextReviewAt,
        updated_at: nowIso,
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      // Fallback if SM-2 columns haven't been migrated in DB yet
      const { data: fallbackCard, error: fallbackError } = await supabase
        .from("flashcards")
        .update({ status, updated_at: nowIso })
        .eq("id", req.params.id)
        .select()
        .single();
      if (fallbackError) throw fallbackError;
      return res.json({ card: fallbackCard });
    }

    res.json({ card });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
