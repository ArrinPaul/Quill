"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Announcement01 as Megaphone, BarChart01 as BarChart3, ChevronLeftDouble as ChevronsLeft, ChevronRightDouble as ChevronsRight, FaceSmile as Bot, GraduationHat01 as GraduationCap, HelpCircle, LayersTwo01 as Layers, LayoutGrid01 as LayoutDashboard, List as ListTodo, LogOut01 as LogOut, PenTool01 as PenTool, Settings01 as Settings, Stars01 as Sparkles } from "@untitledui/icons";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  hideCollapseButton?: boolean;
}

export function Sidebar({ isCollapsed, onToggle, onNavigate, hideCollapseButton = false }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/ai", icon: Bot, label: "AI Assistant" },
  ];

  const toolItems = [
    { href: "/dashboard/tasks", icon: ListTodo, label: "Tasks" },
    { href: "/dashboard/notices", icon: Megaphone, label: "Notices" },
    { href: "/dashboard/attendance", icon: BarChart3, label: "Attendance" },
    { href: "/dashboard/flashcards", icon: Layers, label: "Flashcards" },
    { href: "/dashboard/quiz", icon: HelpCircle, label: "MCQ Quiz" },
    { href: "/dashboard/tools", icon: Sparkles, label: "Smart Tools" },
    { href: "/dashboard/whiteboard", icon: PenTool, label: "Whiteboard" },
  ];

  const systemItems = [
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  ];


  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-gradient-to-b from-primary to-primary/90 text-white transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className={cn("flex items-center h-16 border-b border-white/10 px-4", isCollapsed ? "justify-center" : "justify-between")}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group" title="Quill Dashboard">
          <img src="/logo-quill.png" alt="Quill Logo" className="w-8 h-8 object-contain transition-transform group-hover:scale-105" />
          {!isCollapsed && <span className="text-base font-bold text-white tracking-tight">Quill</span>}
        </Link>
        {!isCollapsed && !hideCollapseButton && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            id={`tour-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 py-2 rounded-[10px] text-sm font-medium transition-all duration-150",
              isCollapsed ? "justify-center px-0" : "px-3",
              isActive(item.href)
                ? "bg-white/20 text-white shadow-sm"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        ))}

        <div className="pt-3 pb-1.5 px-1">
          {isCollapsed ? (
            <div className="border-t border-white/10 my-1 mx-2" />
          ) : (
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Tools</p>
          )}
        </div>

        {toolItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            id={`tour-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 py-2 rounded-[10px] text-sm font-medium transition-all duration-150",
              isCollapsed ? "justify-center px-0" : "px-3",
              isActive(item.href)
                ? "bg-white/20 text-white shadow-sm"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        ))}

        <div className="pt-3 pb-1.5 px-1">
          {isCollapsed ? (
            <div className="border-t border-white/10 my-1 mx-2" />
          ) : (
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">System</p>
          )}
        </div>

        {systemItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 py-2 rounded-[10px] text-sm font-medium transition-all duration-150",
              isCollapsed ? "justify-center px-0" : "px-3",
              isActive(item.href)
                ? "bg-white/20 text-white shadow-sm"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-2 space-y-1">
        {user && (
          isCollapsed ? (
            <div
              className="flex justify-center py-2"
              title={`${user.name || "User"} (${user.email || ""})`}
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
                {user.name ? user.name[0] : "U"}
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
            </div>
          )
        )}

        <ThemeToggle
          showLabel={!isCollapsed}
          className={cn(
            "w-full py-2 text-white/70 hover:bg-white/10 hover:text-white",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
        />

        <button
          type="button"
          onClick={logout}
          aria-label="Logout"
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 w-full py-2 rounded-[10px] text-sm font-medium transition-all duration-150 text-white/70 hover:bg-white/10 hover:text-white",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>

        {!hideCollapseButton && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-3 w-full py-2 rounded-[10px] text-sm font-medium transition-all duration-150 text-white/70 hover:bg-white/10 hover:text-white",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4.5 h-4.5" />
            ) : (
              <>
                <ChevronsLeft className="w-4.5 h-4.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
