import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { ratings } from "~/db/schema";

// ─── Rating Service ───
// Handles course star ratings (1-5), one per user per course, upsert semantics.
// Uses positional parameters (project convention).

export function getUserRatingForCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.courseId, courseId)))
    .get();
}

export function upsertRating(userId: number, courseId: number, score: number) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error("Rating score must be an integer between 1 and 5");
  }

  const existing = getUserRatingForCourse(userId, courseId);

  if (existing) {
    return db
      .update(ratings)
      .set({ score, updatedAt: new Date().toISOString() })
      .where(eq(ratings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(ratings)
    .values({ userId, courseId, score })
    .returning()
    .get();
}

export function getAverageRatingForCourse(courseId: number) {
  const result = db
    .select({
      average: sql<number | null>`avg(${ratings.score})`,
      count: sql<number>`count(*)`,
    })
    .from(ratings)
    .where(eq(ratings.courseId, courseId))
    .get();

  return {
    average: result?.average ?? null,
    count: result?.count ?? 0,
  };
}

export function getAverageRatingsForCourses(courseIds: number[]) {
  const resultMap = new Map<
    number,
    { average: number | null; count: number }
  >();
  if (courseIds.length === 0) return resultMap;

  const rows = db
    .select({
      courseId: ratings.courseId,
      average: sql<number | null>`avg(${ratings.score})`,
      count: sql<number>`count(*)`,
    })
    .from(ratings)
    .where(inArray(ratings.courseId, courseIds))
    .groupBy(ratings.courseId)
    .all();

  for (const row of rows) {
    resultMap.set(row.courseId, { average: row.average, count: row.count });
  }

  return resultMap;
}
