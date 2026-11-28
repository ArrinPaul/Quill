export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type TaskImportance = "low" | "normal" | "high";

export type TaskRepeat = "none" | "weekly";

export type TaskFilter = "today" | "upcoming" | "in_progress" | "completed" | "all";

export interface Task {
  id: string;
  student_id: string;
  title: string;
  subject: string;
  description: string | null;
  deadline: string;
  reminder_time: string | null;
  add_to_calendar: boolean;
  importance?: TaskImportance;
  status: TaskStatus;
  repeat?: TaskRepeat;
  repeat_parent?: string | null;
  n8n_triggered: boolean;
  created_at: string;
}

export interface Notice {
  id: string;
  student_id: string;
  notice_text: string;
  ai_summary: string | null;
  event_date: string | null;
  event_title: string | null;
  broadcast_status: "pending" | "sent" | "failed";
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  subject: string;
  total_classes: number;
  attended_classes: number;
  threshold: number;
  updated_at: string;
}

export type ActivityType =
  | "task_created"
  | "task_completed"
  | "notice_added"
  | "quiz_completed"
  | "deck_created"
  | "board_created";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  entity_id: string | null;
  created_at: string;
}

export type QuizType = "mcq" | "tf" | "short";

export interface QuizQuestion {
  id: string;
  quiz_id?: string;
  type?: QuizType;
  question: string;
  options: string[] | null;
  correct_index?: number | null;
  model_answer?: string | null;
  user_answer_index?: number | null;
  user_answer_text?: string | null;
  is_correct?: boolean | null;
  feedback?: string | null;
  explanation?: string | null;
  citation?: string | null;
}

export interface Quiz {
  id: string;
  title: string;
  score: number | null;
  total_questions?: number;
  created_at?: string;
}

export interface DashboardStats {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  upcomingDeadlines: Task[];
  todayTasks: Task[];
  attendance: Attendance[];
  aiTip: string;
}

export interface AiConversation {
  id: string;
  student_id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  version: number;
  updated_at: string;
  created_at: string;
}

export interface Note extends NoteSummary {
  student_id: string;
  content: string;
}

export type NoteAiAction = "summarize" | "expand" | "tasks";

export interface NoteSuggestedTask {
  title: string;
  subject?: string;
  dueDate?: string;
}

export type GroupRole = "owner" | "admin" | "member";

export interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  role: GroupRole;
  member_count: number;
  realtime_key?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  branch: string;
  year: number;
  role: GroupRole;
  joined_at: string;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  created_at: string;
}

export type GroupReportTargetType =
  | "member"
  | "message"
  | "note"
  | "deck"
  | "board"
  | "quiz"
  | "other";

export type GroupReportStatus = "open" | "resolved" | "dismissed";

export interface GroupReport {
  id: string;
  reporter_id: string;
  group_id: string;
  target_type: GroupReportTargetType;
  target_id: string;
  reason: string;
  status: GroupReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface GroupBan {
  id: string;
  group_id: string;
  student_id: string;
  banned_by: string;
  reason: string | null;
  created_at: string;
  student: {
    id: string;
    name: string;
    branch: string;
    year: number;
  } | null;
}

export interface GroupAuditEntry {
  id: string;
  group_id: string;
  actor_id: string | null;
  action: string;
  target: string | null;
  created_at: string;
}

export interface BlockedStudent {
  id: string;
  blocked_id: string;
  created_at: string;
  student: {
    id: string;
    name: string;
    branch: string;
    year: number;
  } | null;
}
