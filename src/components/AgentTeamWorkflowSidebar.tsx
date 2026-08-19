/**
 * AgentTeamWorkflowSidebar
 *
 * 多 Agent 协作 Workflow 侧边栏视图。
 * 展示当前任务空间中各 Agent 的活动状态、整体进度及任务流转看板。
 * 可作为独立面板嵌入任意布局，通过 `onClose` prop 控制关闭。
 */
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberStatus = 'completed' | 'running' | 'waiting' | 'failed'
type TaskStatus = 'todo' | 'in_progress' | 'done'

interface TeamMember {
  id: string
  /** Icon letter(s) shown inside the avatar circle */
  initials: string
  /** Background gradient for the avatar */
  avatarBg: string
  /** Display name / role handle */
  role: string
  /** Short description shown below the role */
  description: string
  status: MemberStatus
  /** Human-readable elapsed time, e.g. "10 分钟前" */
  elapsed: string
}

interface Task {
  id: string
  label: string
  status: TaskStatus
  /** id of the task this one depends on (for drawing arrows) */
  dependsOn?: string
}

interface TeamSummary {
  teamName: string
  memberCount: number
  lastActiveLabel: string
  onlineCount: number
  completedCount: number
  failedCount: number
  inProgressCount: number
  progressPercent: number
  statusTags: string[]
}

export interface AgentTeamWorkflowSidebarProps {
  onClose?: () => void
  /** Optional extra class applied to the sidebar root element */
  className?: string
  /** Override the default mock summary data */
  summary?: TeamSummary
  /** Override the default mock members list */
  members?: TeamMember[]
  /** Override the default mock tasks */
  tasks?: Task[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SUMMARY: TeamSummary = {
  teamName: 'repo-analysis-team',
  memberCount: 5,
  lastActiveLabel: '刚刚活跃',
  onlineCount: 5,
  completedCount: 6,
  failedCount: 0,
  inProgressCount: 1,
  progressPercent: 90,
  statusTags: ['基本整体按时已完成', '已完成'],
}

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: 'm1',
    initials: 'GH',
    avatarBg: 'linear-gradient(135deg, #6EC56A, #41B5DC)',
    role: 'git-historian',
    description: 'historian · 分析 git 提交历史',
    status: 'completed',
    elapsed: '10 分钟前',
  },
  {
    id: 'm2',
    initials: 'FA',
    avatarBg: 'linear-gradient(135deg, #4FC2F4, #7C5CFF)',
    role: 'feature-analyst',
    description: 'engineer · 特性归类与提炼',
    status: 'completed',
    elapsed: '8 分钟前',
  },
  {
    id: 'm3',
    initials: 'CR',
    avatarBg: 'linear-gradient(135deg, #FFB088, #F4B740)',
    role: 'code-reviewer',
    description: 'reviewer · 代码质量审查',
    status: 'running',
    elapsed: '进行中',
  },
  {
    id: 'm4',
    initials: 'DS',
    avatarBg: 'linear-gradient(135deg, #E9A0E9, #FF7AB6)',
    role: 'doc-synthesizer',
    description: 'writer · 整合文档摘要',
    status: 'completed',
    elapsed: '5 分钟前',
  },
  {
    id: 'm5',
    initials: 'RP',
    avatarBg: 'linear-gradient(135deg, #A593FF, #4FC2F4)',
    role: 'report-publisher',
    description: 'publisher · 生成最终报告',
    status: 'waiting',
    elapsed: '等待中',
  },
]

const MOCK_TASKS: Task[] = [
  { id: 't1', label: '拉取最近两周提交', status: 'done' },
  { id: 't2', label: '提取 feature 分支变更', status: 'done', dependsOn: 't1' },
  { id: 't3', label: '代码质量扫描', status: 'in_progress', dependsOn: 't2' },
  { id: 't4', label: '生成改动摘要', status: 'todo', dependsOn: 't3' },
  { id: 't5', label: '输出最终报告', status: 'todo', dependsOn: 't4' },
  { id: 't6', label: '归档至文档库', status: 'done' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<MemberStatus, string> = {
  completed: 'bg-[#10B981]',
  running: 'bg-[#F4B740] animate-pulse',
  waiting: 'bg-[#94A8BC]',
  failed: 'bg-[#FF7A6B]',
}
const STATUS_LABEL: Record<MemberStatus, string> = {
  completed: '任务已完成',
  running: '任务进行中',
  waiting: '等待依赖',
  failed: '任务失败',
}

function MemberRow({ m }: { m: TeamMember }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F3F4F6] shadow-sm">
      {/* Avatar */}
      <div
        className="w-9 h-9 shrink-0 rounded-full grid place-items-center text-white text-[11px] font-bold select-none"
        style={{ background: m.avatarBg }}
      >
        {m.initials}
      </div>

      {/* Role info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#1F2937] truncate">{m.role}</div>
        <div className="text-[11px] text-[#6B7280] truncate">{m.description}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[m.status])} />
          <span className="text-[11px] text-[#6B7280]">{STATUS_LABEL[m.status]}</span>
        </div>
      </div>

      {/* Elapsed */}
      <div className="shrink-0 text-[11px] text-[#9CA3AF] whitespace-nowrap">{m.elapsed}</div>
    </div>
  )
}

// ── Task Board ────────────────────────────────────────────────────────────────

const BOARD_COLS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: '今日待办' },
  { key: 'in_progress', label: '进行中' },
  { key: 'done', label: '已完成' },
]

const TASK_COL_STYLE: Record<TaskStatus, { header: string; card: string }> = {
  todo: {
    header: 'text-[#6B7280] border-[#E5ECF2]',
    card: 'bg-white border border-[#E5ECF2] text-[#374151]',
  },
  in_progress: {
    header: 'text-[#F4B740] border-[#F4B740]',
    card: 'bg-white border border-[#FDE68A] text-[#374151]',
  },
  done: {
    header: 'text-[#10B981] border-[#10B981]',
    card: 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#065F46]',
  },
}

/** Simple SVG arrow connecting adjacent board columns */
function DashArrow() {
  return (
    <svg
      className="shrink-0 self-center"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <line x1="2" y1="10" x2="14" y2="10" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="3 2" />
      <polyline points="11,6 15,10 11,14" stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

function TaskBoard({ tasks }: { tasks: Task[] }) {
  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2.5">
        任务依赖 · 最近两周 git 提交历史分类
      </div>

      {/* Board columns with dash arrows between them */}
      <div className="flex gap-1 items-start overflow-x-auto pb-1">
        {BOARD_COLS.map((col, colIdx) => {
          const items = byStatus(col.key)
          const styles = TASK_COL_STYLE[col.key]
          return (
            <div key={col.key} className="flex items-start gap-1">
              {/* Column */}
              <div className="min-w-[92px] flex-1">
                {/* Column header */}
                <div
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wide mb-1.5 pb-1 border-b',
                    styles.header,
                  )}
                >
                  {col.label}
                </div>
                {/* Task cards */}
                <div className="flex flex-col gap-1.5">
                  {items.length === 0 ? (
                    <div className="text-[10px] text-[#D1D5DB] italic px-1">暂无任务</div>
                  ) : (
                    items.map((t) => (
                      <div
                        key={t.id}
                        className={cn('rounded-lg px-2 py-1.5 text-[11px] leading-tight shadow-sm', styles.card)}
                      >
                        {t.label}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Arrow between columns (not after last) */}
              {colIdx < BOARD_COLS.length - 1 && <DashArrow />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentTeamWorkflowSidebar({
  onClose,
  className,
  summary = MOCK_SUMMARY,
  members = MOCK_MEMBERS,
  tasks = MOCK_TASKS,
}: AgentTeamWorkflowSidebarProps) {
  const s = summary

  return (
    <aside
      className={cn(
        'flex flex-col h-full overflow-y-auto',
        'w-[clamp(280px,27vw,360px)]',
        'bg-[#F9FAFB] border-l border-[#E5ECF2]',
        'shadow-[-6px_0_24px_-8px_rgba(10,30,60,0.08)]',
        className,
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <h2
          className="font-display font-medium text-[20px] text-[#1F2937] leading-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          Agent Teams 活动
        </h2>
        <button
          onClick={onClose}
          className="w-7 h-7 grid place-items-center rounded-full text-[#9CA3AF] hover:text-[#374151] hover:bg-[#E5ECF2] transition"
          aria-label="关闭侧边栏"
        >
          {/* X icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-5 flex-1 min-h-0">
        {/* ── Summary Card ─────────────────────────────────────────────────── */}
        <div className="rounded-[14px] p-4 bg-white shadow-sm border border-[#E5ECF2]">
          {/* Team name & last active */}
          <div className="flex items-start justify-between mb-2.5">
            <div>
              <div className="text-[14px] font-semibold text-[#1F2937]">{s.teamName}</div>
              <div className="text-[11px] text-[#6B7280]">
                {s.memberCount} 名成员 · {s.lastActiveLabel}
              </div>
            </div>
            {/* Pulsing "live" dot */}
            <span className="mt-1 w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0" title="活跃中" />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3 text-[11.5px] font-semibold text-[#10B981]">
            <span>成员在线: {s.onlineCount}</span>
            <span className="text-[#D1D5DB]">|</span>
            <span>任务完成: {s.completedCount}</span>
            <span className="text-[#D1D5DB]">|</span>
            <span className={s.failedCount > 0 ? 'text-[#FF7A6B]' : ''}>
              失败: {s.failedCount}
            </span>
            <span className="text-[#D1D5DB]">|</span>
            <span className="text-[#F4B740]">进行中: {s.inProgressCount}</span>
          </div>

          {/* Progress bar */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10.5px] text-[#6B7280]">整体进度</span>
              <span className="text-[11px] font-bold text-[#10B981]">{s.progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#E5ECF2] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${s.progressPercent}%`,
                  background: 'linear-gradient(90deg, #34D399, #10B981)',
                }}
              />
            </div>
          </div>

          {/* Status tags */}
          <div className="flex flex-wrap gap-1.5">
            {s.statusTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── Members List ─────────────────────────────────────────────────── */}
        <div>
          <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">
            成员 · {members.length}
          </div>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </div>
        </div>

        {/* ── Task Board ───────────────────────────────────────────────────── */}
        <div className="rounded-[14px] p-4 bg-white shadow-sm border border-[#E5ECF2]">
          <TaskBoard tasks={tasks} />
        </div>
      </div>
    </aside>
  )
}
