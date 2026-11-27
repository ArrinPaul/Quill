const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// --- Flashcard Decks & Cards ---

// Get all decks
router.get("/decks", async (req, res) => {
  try {
    const { data: decks, error } = await getClient()
      .from("flashcard_decks")
      .select("*, flashcards(*)")
      .eq("student_id", req.student.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ decks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save a new deck with flashcards
router.post("/decks", async (req, res) => {
  try {
    const { title, flashcards } = req.body;
    if (!title || !flashcards || !Array.isArray(flashcards)) {
      return res.status(400).json({ message: "Deck title and flashcards array are required" });
    }

    const isText = (v) => typeof v === "string" && v.trim() !== "";
    if (!isText(title) || flashcards.length === 0 || !flashcards.every((c) => c && isText(c.front) && isText(c.back))) {
      return res.status(400).json({ message: "A title and at least one card with a front and back are required" });
    }

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

    res.status(201).json({ deck, flashcards: savedCards });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a deck and its flashcards
router.delete("/decks/:deckId", async (req, res) => {
  try {
    const { error } = await getClient()
      .from("flashcard_decks")
      .delete()
      .eq("id", req.params.deckId)
      .eq("student_id", req.student.id);

    if (error) throw error;
    res.json({ message: "Deck deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a manual card to an existing deck
router.post("/decks/:deckId/cards", async (req, res) => {
  try {
    const { front, back, citation } = req.body;
    if (typeof front !== "string" || typeof back !== "string" || !front.trim() || !back.trim()) {
      return res.status(400).json({ message: "Front and back are required" });
    }

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
        front: front.trim(),
        back: back.trim(),
        citation: citation ? citation.trim() : null,
        status: "unseen",
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ card });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Edit an existing flashcard
router.put("/:id", async (req, res) => {
  try {
    const { front, back, citation } = req.body;
    if (typeof front !== "string" || typeof back !== "string" || !front.trim() || !back.trim()) {
      return res.status(400).json({ message: "Front and back are required" });
    }

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
        front: front.trim(),
        back: back.trim(),
        citation: citation ? citation.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ card });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a flashcard
router.delete("/:id", async (req, res) => {
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

    const { error } = await supabase.from("flashcards").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ message: "Flashcard deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update flashcard status & SM-2 spaced repetition schedule
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["unseen", "review", "mastered"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

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
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
