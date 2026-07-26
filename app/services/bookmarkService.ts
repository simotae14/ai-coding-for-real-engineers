import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

// ─── Bookmark Service ───
// Handles per-student lesson bookmarks. Private to each student, persist
// until manually removed.

export function toggleBookmark(opts: { userId: number; lessonId: number }) {
  const { userId, lessonId } = opts;

  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks).where(eq(lessonBookmarks.id, existing.id)).run();
    return { bookmarked: false };
  }

  db.insert(lessonBookmarks).values({ userId, lessonId }).run();
  return { bookmarked: true };
}

export function isLessonBookmarked(opts: { userId: number; lessonId: number }) {
  const { userId, lessonId } = opts;

  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  return !!existing;
}

export function getBookmarkedLessonIds(opts: {
  userId: number;
  courseId: number;
}) {
  const { userId, courseId } = opts;

  const rows = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .innerJoin(lessons, eq(lessonBookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(eq(lessonBookmarks.userId, userId), eq(modules.courseId, courseId))
    )
    .all();

  return rows.map((r) => r.lessonId);
}
