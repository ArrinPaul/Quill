const crypto = require("crypto");
const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { publicLimiter } = require("../middleware/rateLimit");
const { z, uuidSchema, idParamSchema } = require("../schemas/common");

const TABLES = { note: "notes", deck: "flashcard_decks" };
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const resourceSchema = z.object({
  resource_type: z.enum(["note", "deck"]),
  resource_id: uuidSchema,
});

async function ownedResource(type, id, studentId, columns = "id") {
  const { data, error } = await getClient()
    .from(TABLES[type])
    .select(columns)
    .eq("id", id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const links = express.Router();
links.use(authMiddleware);

const activeLinks = (ownerId, { resource_type, resource_id }) =>
  getClient()
    .from("share_links")
    .select("id, created_at")
    .eq("owner_id", ownerId)
    .eq("resource_type", resource_type)
    .eq("resource_id", resource_id)
    .is("revoked_at", null);

// Is this item shared? The token itself is never stored, so it cannot be shown again.
links.get("/", validate({ query: resourceSchema }), async (req, res, next) => {
  try {
    const { data, error } = await activeLinks(req.student.id, req.query).limit(1);
    if (error) throw error;
    res.json({ link: data?.[0] ?? null });
  } catch (error) {
    next(error);
  }
});

links.post("/", validate({ body: resourceSchema }), async (req, res, next) => {
  try {
    const { resource_type, resource_id } = req.body;
    if (!(await ownedResource(resource_type, resource_id, req.student.id))) {
      return res.status(404).json({ message: "Not found" });
    }
    const supabase = getClient();
    // A new link replaces the old one, so there is only ever one to keep track of.
    const { error: revokeError } = await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("owner_id", req.student.id)
      .eq("resource_type", resource_type)
      .eq("resource_id", resource_id)
      .is("revoked_at", null);
    if (revokeError) throw revokeError;

    const token = crypto.randomBytes(32).toString("base64url");
    const { data, error } = await supabase
      .from("share_links")
      .insert({ owner_id: req.student.id, resource_type, resource_id, token_hash: hashToken(token) })
      .select("id, created_at")
      .single();
    if (error) throw error;
    res.status(201).json({ link: data, token });
  } catch (error) {
    next(error);
  }
});

links.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("owner_id", req.student.id)
      .is("revoked_at", null)
      .select("id");
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ message: "Link not found" });
    res.json({ message: "Link turned off" });
  } catch (error) {
    next(error);
  }
});

// No login: the long random token is the permission. Only the title and content leave.
const publicShare = express.Router();

publicShare.get("/:token", publicLimiter, async (req, res, next) => {
  try {
    const gone = () => res.status(404).json({ message: "This link is not available." });
    const supabase = getClient();
    const { data: link, error } = await supabase
      .from("share_links")
      .select("owner_id, resource_type, resource_id")
      .eq("token_hash", hashToken(req.params.token))
      .is("revoked_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!link) return gone();

    const columns = link.resource_type === "note" ? "title, content" : "title";
    const resource = await ownedResource(link.resource_type, link.resource_id, link.owner_id, columns);
    if (!resource) return gone();

    res.set("Cache-Control", "no-store");
    if (link.resource_type === "note") {
      return res.json({ type: "note", title: resource.title, content: resource.content });
    }
    const { data: cards, error: cardError } = await supabase
      .from("flashcards")
      .select("front, back")
      .eq("deck_id", link.resource_id)
      .order("created_at", { ascending: true });
    if (cardError) throw cardError;
    res.json({ type: "deck", title: resource.title, cards: cards || [] });
  } catch (error) {
    next(error);
  }
});

module.exports = { links, publicShare };
