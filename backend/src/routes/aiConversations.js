const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { aiQuota, refundAiQuota } = require("../middleware/aiQuota");
const { idParamSchema } = require("../schemas/common");
const {
  createConversationSchema,
  renameConversationSchema,
  sendConversationMessageSchema,
} = require("../schemas/ai");
const { streamChatResponse, AIError } = require("../services/groq");

const router = express.Router();

router.use(authMiddleware);

async function getOwnedConversation(conversationId, studentId) {
  const { data, error } = await getClient()
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function requireOwnedConversation(req, res, next) {
  try {
    const conversation = await getOwnedConversation(req.params.id, req.student.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    req.conversation = conversation;
    return next();
  } catch (err) {
    return next(err);
  }
}

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("ai_conversations")
      .select("*")
      .eq("student_id", req.student.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ conversations: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post("/", validate({ body: createConversationSchema }), async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const title = req.body.title || "New chat";
    const { data, error } = await getClient()
      .from("ai_conversations")
      .insert({
        student_id: req.student.id,
        title,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ conversation: data });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/:id",
  validate({ params: idParamSchema, body: renameConversationSchema }),
  async (req, res, next) => {
    try {
      const { data, error } = await getClient()
        .from("ai_conversations")
        .update({
          title: req.body.title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("student_id", req.student.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json({ conversation: data });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("ai_conversations")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.json({ message: "Conversation deleted" });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id/messages",
  validate({ params: idParamSchema }),
  requireOwnedConversation,
  async (req, res, next) => {
    try {
      const { data, error } = await getClient()
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", req.conversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      res.json({ messages: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/messages",
  aiLimiter,
  validate({ params: idParamSchema, body: sendConversationMessageSchema }),
  requireOwnedConversation,
  aiQuota,
  async (req, res, next) => {
    const supabase = getClient();
    const conversationId = req.conversation.id;
    const { content } = req.body;
    const abortController = new AbortController();
    let clientAborted = false;
    let streamFinished = false;
    let sseStarted = false;
    let delivered = false;

    const writeEvent = (payload) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    const refundIfCharged = async () => {
      if (req.aiQuotaCharged && req.student?.id) {
        req.aiQuotaCharged = false;
        await refundAiQuota(req.student.id);
      }
    };

    try {
      const now = new Date().toISOString();
      // A retry of a failed send must not store the same question twice.
      const { data: lastRows, error: lastError } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastError) throw lastError;

      let userMessage = lastRows?.[0];
      if (userMessage?.role !== "user" || userMessage.content !== content) {
        const { data, error: insertUserError } = await supabase
          .from("ai_messages")
          .insert({ conversation_id: conversationId, role: "user", content })
          .select("*")
          .single();

        if (insertUserError) throw insertUserError;
        userMessage = data;
      }

      const { error: updateConvError } = await supabase
        .from("ai_conversations")
        .update({ updated_at: userMessage?.created_at || now })
        .eq("id", conversationId)
        .eq("student_id", req.student.id);

      if (updateConvError) throw updateConvError;

      const { data: recentMessages, error: historyError } = await supabase
        .from("ai_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (historyError) throw historyError;

      const history = (recentMessages || [])
        .slice()
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      sseStarted = true;

      // res, not req: the request stream has already closed once its body was read.
      res.on("close", () => {
        if (!streamFinished) {
          clientAborted = true;
          abortController.abort();
        }
      });

      const fullReply = await streamChatResponse(
        history,
        (delta) => {
          if (!clientAborted) {
            delivered = true;
            writeEvent({ delta });
          }
        },
        { signal: abortController.signal }
      );

      if (clientAborted) {
        // Stopping after text arrived still counts, or Stop would make the limit free.
        if (!delivered) await refundIfCharged();
        streamFinished = true;
        if (!res.writableEnded) res.end();
        return;
      }

      const replyTime = new Date().toISOString();
      const { data: savedAssistant, error: insertAssistantError } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullReply,
        })
        .select("id, created_at")
        .single();

      if (insertAssistantError) throw insertAssistantError;

      await supabase
        .from("ai_conversations")
        .update({ updated_at: savedAssistant?.created_at || replyTime })
        .eq("id", conversationId)
        .eq("student_id", req.student.id);

      streamFinished = true;
      writeEvent({ done: true, messageId: savedAssistant.id });
      res.end();
    } catch (err) {
      streamFinished = true;
      if (!(clientAborted && delivered)) await refundIfCharged();

      if (!sseStarted) {
        return next(err);
      }

      if (!clientAborted && !res.writableEnded) {
        console.error("AI chat reply failed:", err?.message || err);
        writeEvent({
          error:
            err instanceof AIError
              ? err.message
              : "The AI service is unavailable right now. Please try again later.",
        });
      }
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
);

module.exports = router;
