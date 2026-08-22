import { eq, and, inArray, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import { courses, purchases, enrollments, courseRatings } from "~/db/schema";

// ─── Analytics Service ───
// Computes revenue-focused analytics for an instructor's courses over a time period.
// Uses positional parameters (project convention).

export type AnalyticsPeriod = "7d" | "30d" | "12m" | "all";

export interface AnalyticsSummary {
  totalRevenueCents: number;
  totalEnrollments: number;
  averageRating: number | null;
  ratingCount: number;
}

export interface InstructorAnalytics {
  summary: AnalyticsSummary;
}

/**
 * Returns the ISO timestamp marking the start of the given period, or null for "all"
 * (no lower bound — the earliest data point is whatever the instructor's first purchase is).
 */
function getPeriodStartDate(period: AnalyticsPeriod): string | null {
  const now = new Date();

  switch (period) {
    case "7d":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "30d":
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    case "12m":
      now.setMonth(now.getMonth() - 12);
      return now.toISOString();
    case "all":
      return null;
  }
}

function getCourseIdsForInstructor(instructorId: number): number[] {
  const rows = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  return rows.map((row) => row.id);
}

function getSummary(
  courseIds: number[],
  periodStart: string | null
): AnalyticsSummary {
  if (courseIds.length === 0) {
    return {
      totalRevenueCents: 0,
      totalEnrollments: 0,
      averageRating: null,
      ratingCount: 0,
    };
  }

  const revenueResult = db
    .select({ total: sql<number | null>`sum(${purchases.pricePaid})` })
    .from(purchases)
    .where(
      periodStart
        ? and(
            inArray(purchases.courseId, courseIds),
            gte(purchases.createdAt, periodStart)
          )
        : inArray(purchases.courseId, courseIds)
    )
    .get();

  const enrollmentResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      periodStart
        ? and(
            inArray(enrollments.courseId, courseIds),
            gte(enrollments.enrolledAt, periodStart)
          )
        : inArray(enrollments.courseId, courseIds)
    )
    .get();

  const ratingResult = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(
      periodStart
        ? and(
            inArray(courseRatings.courseId, courseIds),
            gte(courseRatings.createdAt, periodStart)
          )
        : inArray(courseRatings.courseId, courseIds)
    )
    .get();

  return {
    totalRevenueCents: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentResult?.count ?? 0,
    averageRating: ratingResult?.average
      ? Math.round(ratingResult.average * 10) / 10
      : null,
    ratingCount: ratingResult?.count ?? 0,
  };
}

export function getInstructorAnalytics(
  instructorId: number,
  period: AnalyticsPeriod
): InstructorAnalytics {
  const courseIds = getCourseIdsForInstructor(instructorId);
  const periodStart = getPeriodStartDate(period);

  return {
    summary: getSummary(courseIds, periodStart),
  };
}
