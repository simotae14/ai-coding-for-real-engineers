import { eq, asc } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users, UserRole } from "~/db/schema";

// ─── Lesson Comment Service ───
// Handles flat (non-threaded) comments on lessons, with soft delete.
// Uses positional parameters (project convention).

export function getCommentsForLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      body: lessonComments.body,
      createdAt: lessonComments.createdAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(asc(lessonComments.createdAt))
    .all();
}

export function createComment(lessonId: number, userId: number, body: string) {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > 2000) {
    throw new Error("Comment must be 2000 characters or fewer");
  }

  return db
    .insert(lessonComments)
    .values({ lessonId, userId, body: trimmed })
    .returning()
    .get();
}

export function getCommentById(id: number) {
  return db.select().from(lessonComments).where(eq(lessonComments.id, id)).get();
}

export function softDeleteComment(id: number) {
  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, id))
    .returning()
    .get();
}

export function canDeleteComment(
  comment: { userId: number },
  currentUserId: number,
  currentUserRole: UserRole,
  courseInstructorId: number
) {
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