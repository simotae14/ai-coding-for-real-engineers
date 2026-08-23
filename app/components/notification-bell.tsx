import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";

interface Notification {
  id: number;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const markReadFetcher = useFetcher();
  const markAllReadFetcher = useFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markReadFetcher.submit(
        { notificationId: notification.id },
        {
          method: "post",
          action: "/api/notifications/mark-read",
          encType: "application/json",
        }
      );
    }
    setIsOpen(false);
    navigate(notification.linkUrl);
  }

  function handleMarkAllAsRead() {
    markAllReadFetcher.submit(
      {},
      { method: "post", action: "/api/notifications/mark-all-read" }
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        title="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-full top-0 z-50 ml-2 w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "block w-full border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent",
                    !notification.isRead && "bg-accent/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!notification.isRead && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-sm",
                          !notification.isRead
                            ? "font-semibold"
                            : "font-medium text-muted-foreground"
                        )}
                      >
                        {notification.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {notification.message}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {timeAgo(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
