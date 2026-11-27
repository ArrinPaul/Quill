const Groq = require("groq-sdk");

let groq = null;
try {
  const key = process.env.GROQ_API_KEY;
  if (key && key !== "placeholder") {
    groq = new Groq({ apiKey: key });
  }
} catch (err) {
  console.warn("Failed to initialize Groq SDK:", err.message);
}

// Check if Groq client is active
function isGroqAvailable() {
  return groq !== null;
}

// Raised when the AI provider is missing or fails, so callers never present made-up output as real.
class AIError extends Error {
  constructor(message = "The AI service is unavailable right now. Please try again later.") {
    super(message);
    this.status = 503;
  }
}

async function complete(params) {
  if (!isGroqAvailable()) throw new AIError("AI is not configured on the server.");
  try {
    const res = await groq.chat.completions.create({ model: "groq/compound", ...params });
    const text = res.choices[0]?.message?.content;
    if (!text) throw new Error("Empty AI response");
    return text;
  } catch (err) {
    console.error("Groq request failed:", err.message);
    throw new AIError();
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  } catch {
    throw new AIError("The AI returned an unreadable response. Please try again.");
  }
}

// Returns null when no summary could be made; the notice is still worth saving.
async function summarizeNotice(text) {
  try {
    return await complete({
      messages: [
        { role: "system", content: "Summarize college notices in exactly 3 concise bullet points. Be specific about dates." },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });
  } catch {
    return null;
  }
}

async function getStudyTip() {
  const tips = [
    "Take regular breaks using the Pomodoro technique — 25 minutes of focused study, then 5 minutes off.",
    "Review your notes within 24 hours of taking them to improve retention by up to 60%.",
    "Teach what you've learned to someone else — it's the best way to solidify understanding.",
    "Get 7-8 hours of sleep before an exam. Your brain consolidates memories during sleep.",
    "Start with the hardest task when your energy is highest, usually in the morning.",
    "Use active recall instead of re-reading — test yourself on the material.",
    "Break large assignments into smaller tasks with their own mini-deadlines.",
    "Study in different locations to create multiple memory associations.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

async function attendanceAlert(subject, total, attended, threshold = 75) {
  if (total === 0) {
    return { percentage: "100.0", message: `${subject}: No classes held yet. You are at 100% attendance.`, isAtRisk: false };
  }
  const pct = ((attended / total) * 100).toFixed(1);
  const plural = (n) => (n === 1 ? "class" : "classes");
  if (Number(pct) >= threshold) {
    const canSkip = threshold > 0 ? Math.max(0, Math.floor((attended * 100) / threshold - total)) : 0;
    return { percentage: pct, message: `${subject}: ${pct}%. You can skip ${canSkip} more ${plural(canSkip)}.`, isAtRisk: false };
  }
  if (threshold >= 100) {
    return { percentage: pct, message: `${subject}: ⚠️ ${pct}%. A ${threshold}% target can no longer be reached.`, isAtRisk: true };
  }
  const needed = Math.ceil((threshold * total - 100 * attended) / (100 - threshold));
  return { percentage: pct, message: `${subject}: ⚠️ ${pct}%. Need ${needed} more ${plural(needed)} to reach ${threshold}%.`, isAtRisk: true };
}

async function chatResponse(messages) {
  return complete({
    messages: [
      { role: "system", content: "You are a helpful AI study assistant named Uki. You assist college students with their homework, study planning, exam preparation, and notices clarification. Keep responses helpful, structured, and friendly." },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 800,
  });
}

// Prevent 413 Request Entity Too Large by truncating huge documents
const MAX_CHARS = 14000;
const truncate = (notes) =>
  notes.length > MAX_CHARS ? notes.substring(0, MAX_CHARS) + "\n\n...[content truncated for AI length limits]" : notes;

async function generateFlashcards(notes) {
  const text = await complete({
    messages: [
      { role: "system", content: `You are a flashcard generator for students. Convert the given notes into flashcards.
Return ONLY a JSON array of objects with:
- "front": question/concept prompt
- "back": answer/explanation
- "citation": a direct, brief quote from the notes supporting this flashcard.
Create 8-12 flashcards covering the key concepts.
Do not include any markdown format, backticks, or text outside the JSON array.
Format: [{"front": "question", "back": "answer", "citation": "quote from notes"}, ...]` },
      { role: "user", content: `Create flashcards from these notes:\n\n${truncate(notes)}` },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return parseJson(text);
}

async function generateQuiz(notes, count = 10, type = "mcq") {
  let promptContent = "";
  if (type === "tf") {
    promptContent = `You are a quiz generator. Create True/False questions from the given notes.
Return ONLY a JSON array of objects with:
- "question": the question text
- "options": exactly ["True", "False"]
- "correctIndex": index of correct answer (0 for True, 1 for False)
- "explanation": concise explanation of why the answer is correct
- "citation": direct quote from the notes supporting the answer

Create exactly ${count} questions.
Do not include any markdown format, backticks, or text outside the JSON array.
Format: [{"question": "...", "options": ["True", "False"], "correctIndex": 0, "explanation": "...", "citation": "..."}, ...]`;
  } else if (type === "short_answer") {
    promptContent = `You are a quiz generator. Create open-ended short answer questions from the given notes.
Return ONLY a JSON array of objects with:
- "question": the question text
- "modelAnswer": a concise, exemplary model response (1-2 sentences)
- "explanation": key criteria or concepts that must be mentioned to get full credit
- "citation": direct quote or reference from the notes supporting the concept

Create exactly ${count} questions.
Do not include any markdown format, backticks, or text outside the JSON array.
Format: [{"question": "...", "modelAnswer": "...", "explanation": "...", "citation": "..."}, ...]`;
  } else {
    promptContent = `You are a quiz generator. Create multiple choice questions from the given notes.
Return ONLY a JSON array of objects with:
- "question": the question text
- "options": array of exactly 4 answer options
- "correctIndex": index of correct answer (0, 1, 2, or 3)
- "explanation": concise explanation of why the correct option is correct
- "citation": direct quote from the notes supporting the answer

Create exactly ${count} questions.
Do not include any markdown format, backticks, or text outside the JSON array.
Format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "...", "citation": "..."}, ...]`;
  }

  const text = await complete({
    messages: [
      { role: "system", content: promptContent },
      { role: "user", content: `Create a ${type} quiz from these notes:\n\n${truncate(notes)}` },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return parseJson(text);
}

async function gradeShortAnswer(question, modelAnswer, userAnswer) {
  const text = await complete({
    messages: [
      { role: "system", content: `You are an academic grader evaluating student short-answer responses against a question and a reference model answer.
Evaluate the response objectively.
Return ONLY a JSON object with:
- "score": number from 0 to 100
- "feedback": a concise (1-2 sentences) evaluation of what was correct and what key points were missed
- "isCorrect": boolean (true if score is 70 or above, false otherwise)
Do not include any markdown, backticks, or explanation text outside the JSON object.` },
      { role: "user", content: `Question: ${question}\nModel Answer: ${modelAnswer}\nStudent Answer: ${userAnswer}` },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });
  return parseJson(text);
}

async function executeSmartTool(tool, content, options = {}) {
  let systemPrompt = "";
  let userPrompt = "";

  switch (tool) {
    case 'summarize-notes':
      systemPrompt = `You are an expert academic note summarizer. Create a highly structured, comprehensive summary of the provided text.
Your response must strictly follow this structure:
### 📌 Executive Summary
(1-2 sentences capturing the core essence)

### 🔑 Key Concepts
- **Concept 1:** Brief definition.
- **Concept 2:** Brief definition.

### ðŸ“ Detailed Breakdown
(Use nested bullet points and bold text to organize the main ideas and supporting details logically)

### 💡 Crucial Takeaways
(2-3 critical points the student MUST remember for an exam)

Rules:
- DO NOT hallucinate external information. Stick ONLY to the provided text.
- Use clean, professional Markdown formatting.`;
      userPrompt = `Summarize these notes:\n\n${content}`;
      break;

    case 'study-schedule': {
      const examDate = options.examDate || 'next week';
      const studyHours = options.studyHours || 4;
      systemPrompt = `You are a strategic academic planner. Generate a highly optimized, realistic study schedule.
Available study hours per day: ${studyHours}.
Target Exam Date: ${examDate}.

Format your response exactly as follows:
### 📅 Overall Strategy
(Brief overview of how the time is distributed, prioritizing difficult topics)

### ðŸ—“ï¸ Daily Breakdown
**Day 1 (Date):**
- 🕒 [Time Block 1] (e.g., 2 hours): Topic A - Deep Work
- ☕ [Break] (e.g., 15 mins): Active rest
- 🕒 [Time Block 2]: Topic B - Practice

(Continue for the required days)

### 🔄 Revision & Testing Strategy
(How to incorporate active recall and spaced repetition before the exam)

Rules:
- Be realistic about human attention spans (incorporate Pomodoro/breaks).
- DO NOT hallucinate subject matter; base the schedule strictly on the provided topics.`;
      userPrompt = content
        ? `Create a study schedule for these subjects/topics:\n\n${content}`
        : 'Create a study schedule using the provided exam date and daily study hours.';
      break;
    }

    case 'concept-map':
      systemPrompt = `You are an expert at breaking down complex academic topics into hierarchical concept maps.
Represent the relational structure of the provided content using a Mermaid.js flowchart.

Strict Format:
You must return ONLY the standard Markdown code block labeled "mermaid".
DO NOT output any conversational text, titles, or explanations outside the code block.

CRITICAL MERMAID SYNTAX RULE:
You MUST wrap EVERY SINGLE node label in double quotes to prevent parsing errors with special characters like parentheses.
Example: A["Main Topic"] --> B("Subtopic (Details)") is WRONG.
Correct: A["Main Topic"] --> B["Subtopic (Details)"]

Example:
\`\`\`mermaid
flowchart TD
    A["Main Topic"] --> B["Subtopic 1"]
    A --> C["Subtopic 2"]
    B --> D["Detail 1"]
    B --> E["Detail 2 (Note)"]
    C --> F["Detail A"]
\`\`\`

Rules:
- Map ONLY the concepts explicitly mentioned in the text. DO NOT hallucinate.
- Use valid Mermaid.js syntax. ALWAYS use double quotes for node text: nodeID["Node Text"]
- Keep the node text concise.`;
      userPrompt = `Create a concept map for:\n\n${content}`;
      break;

    case 'explain-concept':
      systemPrompt = `You are an exceptional, empathetic tutor who excels at making complex topics intuitive.
Explain the requested concept using the Feynman Technique.

Follow this strict structure:
### 📖 The Simple Definition
(Explain it in 2 sentences as if speaking to a high schooler. No jargon.)

### 🧩 The Analogy
(Provide a vivid, relatable real-world analogy that perfectly maps to the concept.)

### ⚙️ How It Works (The Mechanics)
(Step-by-step breakdown using bullet points. Bold the key terms.)

### 🌍 Real-World Applications
- **Application 1:** (Brief description)
- **Application 2:** (Brief description)

### ⚠️ Common Traps & Misconceptions
- **Myth:** [Myth] -> **Reality:** [Truth]

Rules:
- Be accurate but highly accessible.
- Ensure the analogy mathematically or logically holds up to the actual concept.`;
      userPrompt = `Explain this concept simply:\n\n${content}`;
      break;

    case 'attendance-risk':
      systemPrompt = `You are a strict but supportive academic advisor calculating attendance risk.
Analyze the provided attendance records based on a standard 75% requirement.

Format your response using this precise layout:
### 📊 Attendance Overview
(Provide a Markdown table summarizing: Subject | Current % | Status)

### 🚨 Critical Risks (Below 75%)
- **[Subject Name]:** [Advice on how many classes to attend to recover]

### 🟢 Safe Zone (Above 75%)
- **[Subject Name]:** [Advice on how many classes can safely be missed]

### 🎯 Action Plan
(Bullet points with realistic, actionable advice for recovery and maintaining good standing)

Rules:
- If raw numbers are provided, calculate mathematically accurately.
- Use emojis (🚨, ⚠️, 🟢) to visually indicate risk levels.
- Do NOT hallucinate data not provided.`;
      userPrompt = `Analyze these attendance records:\n\n${content}`;
      break;

    case 'notice-summarizer':
      systemPrompt = `You are an administrative assistant AI trained to extract critical information from dense college circulars.

Extract and format the information exactly as follows:
### 📢 Notice TL;DR
(One bold sentence summarizing the exact purpose of the notice)

### 🗓️ Critical Dates & Deadlines
- **[Date/Time]:** [Event/Deadline description]

### 👥 Who is Affected?
(e.g., "All 3rd-year CSE students", "Faculty only")

### 📌 Required Actions
1. Step 1 (if any)
2. Step 2 (if any)

### ℹ️ Additional Details
(Any other relevant context, formatted as brief bullet points)

Rules:
- Extract ONLY what is stated in the raw text.
- DO NOT invent dates, links, or requirements (NO hallucination).
- If a section (like Dates) is missing in the text, explicitly write "None specified."`;
      userPrompt = `Summarize this notice:\n\n${content}`;
      break;
    
    default:
      throw Object.assign(new Error("Unknown tool"), { status: 400 });
  }

  return complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
}

/**
 * Extracts a structured academic event from a raw Telegram message
 * @param {string} text - The raw telegram message
 * @returns {Promise<{title: string, event_date: string, priority: string, category: string} | null>}
 */
async function extractGroupEvent(text) {
  if (!isGroqAvailable()) {
    // Fallback mock
    return {
      title: "Extracted: " + text.substring(0, 20),
      event_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
      priority: "Medium",
      category: "Other"
    };
  }

  const systemPrompt = `You are an AI assistant that extracts academic events from teacher announcements.
If the message contains an announcement about a test, exam, assignment, placement, fee, or deadline, extract the event.
If it is just casual chat and does NOT contain an event, return null.

Return ONLY a valid JSON object with the following schema, or null (literally the word null without quotes) if no event is found:
{
  "title": "A concise title (max 50 chars)",
  "event_date": "YYYY-MM-DD" (guess the date based on today's date if they say 'tomorrow' or 'next monday'. Assume today is ${new Date().toISOString().split('T')[0]}),
  "priority": "High" | "Medium" | "Low",
  "category": "Exam" | "Assignment" | "Attendance" | "Fee" | "Placement" | "Other"
}
Do NOT wrap the JSON in Markdown backticks (e.g., \`\`\`json). Return raw JSON.`;

  try {
    const res = await groq.chat.completions.create({
      model: "groq/compound",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      temperature: 0.2,
      max_tokens: 512,
    });

    const content = (res.choices[0]?.message?.content || "").trim();
    if (content === "null" || content === "") return null;
    
    return JSON.parse(content);
  } catch (err) {
    console.error("Group event extraction error:", err);
    return null;
  }
}

module.exports = {
  summarizeNotice,
  getStudyTip,
  attendanceAlert,
  chatResponse,
  generateFlashcards,
  generateQuiz,
  gradeShortAnswer,
  executeSmartTool,
  extractGroupEvent
};

