import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { MessageSquare, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function linkify(text: string) {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

function formatTimestamp(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);

  if (Math.abs(seconds) < 60) {
    return "just now";
  }

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return relativeTimeFormatter.format(
        Math.round(seconds / secondsInUnit),
        unit
      );
    }
  }

  return relativeTimeFormatter.format(seconds, "second");
}

export type LessonCommentItem = {
  id: number;
  userId: number;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  authorName: string;
  authorRole: UserRole;
};

function RoleBadge({ role }: { role: UserRole }) {
  if (role === UserRole.Admin) {
    return (
      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
        Admin
      </span>
    );
  }
  if (role === UserRole.Instructor) {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        Instructor
      </span>
    );
  }
  return null;
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  isDeleting,
}: {
  comment: LessonCommentItem;
  canDelete: boolean;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const isDeleted = !!comment.deletedAt;
  const isHighlighted =
    !isDeleted &&
    (comment.authorRole === UserRole.Instructor ||
      comment.authorRole === UserRole.Admin);

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        !isDeleted &&
          comment.authorRole === UserRole.Instructor &&
          "bg-blue-50/50 dark:bg-blue-950/20",
        !isDeleted &&
          comment.authorRole === UserRole.Admin &&
          "bg-purple-50/50 dark:bg-purple-950/20"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.authorName}</span>
          {isHighlighted && <RoleBadge role={comment.authorRole} />}
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
        {!isDeleted && canDelete && (
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onDelete(comment.id)}
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
            aria-label="Delete comment"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {isDeleted ? (
        <p className="text-sm text-muted-foreground italic">[deleted]</p>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{linkify(comment.body)}</p>
      )}
    </div>
  );
}

export function LessonComments({
  lessonId,
  comments,
  currentUserId,
  currentUserRole,
  courseInstructorId,
}: {
  lessonId: number;
  comments: LessonCommentItem[];
  currentUserId: number;
  currentUserRole: UserRole;
  courseInstructorId: number;
}) {
  const createFetcher = useFetcher({ key: `lesson-comment-create-${lessonId}` });
  const deleteFetcher = useFetcher({ key: `lesson-comment-delete-${lessonId}` });
  const formRef = useRef<HTMLFormElement>(null);

  const isSubmitting = createFetcher.state !== "idle";

  useEffect(() => {
    if (createFetcher.state === "idle" && createFetcher.data?.success) {
      formRef.current?.reset();
    }
  }, [createFetcher.state, createFetcher.data]);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      if (!deleteFetcher.data.success) {
        toast.error("Failed to delete comment");
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = String(formData.get("body") ?? "");
    if (!body.trim()) return;

    createFetcher.submit(
      JSON.stringify({ intent: "create", lessonId, body }),
      {
        method: "post",
        action: "/api/lesson-comments",
        encType: "application/json",
      }
    );
  }

  function handleDelete(commentId: number) {
    if (!confirm("Delete this comment?")) return;
    deleteFetcher.submit(JSON.stringify({ intent: "delete", commentId }), {
      method: "post",
      action: "/api/lesson-comments",
      encType: "application/json",
    });
  }

  function canDelete(comment: LessonCommentItem) {
    if (currentUserRole === UserRole.Admin) return true;
    if (comment.userId === currentUserId) return true;
    if (
      currentUserRole === UserRole.Instructor &&
      courseInstructorId === currentUserId
    ) {
      return true;
    }
    return false;
  }

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Discussion</h2>
        </div>

        <div className="mb-6 space-y-3">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              canDelete={canDelete(comment)}
              onDelete={handleDelete}
              isDeleting={deleteFetcher.state !== "idle"}
            />
          ))}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            name="body"
            placeholder="Add to the discussion..."
            maxLength={2000}
            rows={3}
            required
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Posting..." : "Post Comment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
