import { sql, eq } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments, courseRatings, courses } from "~/db/schema";

// ─── Analytics Service ───
// Encapsulates all database query logic for the instructor analytics dashboard.
// Takes an instructor ID and time period, returns summary data.

export type TimePeriod = "7d" | "30d" | "12m" | "all";
export type TimeSeriesGranularity = "day" | "month";

export interface AnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  averageRating: number | null;
  ratingCount: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface CourseBreakdown {
  courseId: number;
  title: string;
  listPrice: number;
  revenue: number;
  salesCount: number;
  enrollmentCount: number;
  averageRating: number | null;
  ratingCount: number;
}

function getGranularity(period: TimePeriod): TimeSeriesGranularity {
  return period === "7d" || period === "30d" ? "day" : "month";
}

function getStartDate(period: TimePeriod): string | null {
  if (period === "all") return null;

  const now = new Date();
  switch (period) {
    case "7d":
      now.setDate(now.getDate() - 7);
      break;
    case "30d":
      now.setDate(now.getDate() - 30);
      break;
    case "12m":
      now.setMonth(now.getMonth() - 12);
      break;
  }
  return now.toISOString();
}

export function getAnalyticsSummary(opts: {
  instructorId: number;
  period: TimePeriod;
}): AnalyticsSummary {
  const { instructorId, period } = opts;
  const startDate = getStartDate(period);

  // Get all course IDs for this instructor
  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      totalRevenue: 0,
      totalEnrollments: 0,
      averageRating: null,
      ratingCount: 0,
    };
  }

  // Build the IN clause for course IDs
  const courseIdList = sql.join(
    courseIds.map((id) => sql`${id}`),
    sql`, `
  );

  // Total revenue
  const revenueResult = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(
      startDate
        ? sql`${purchases.courseId} IN (${courseIdList}) AND ${purchases.createdAt} >= ${startDate}`
        : sql`${purchases.courseId} IN (${courseIdList})`
    )
    .get();

  // Total enrollments
  const enrollmentResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      startDate
        ? sql`${enrollments.courseId} IN (${courseIdList}) AND ${enrollments.enrolledAt} >= ${startDate}`
        : sql`${enrollments.courseId} IN (${courseIdList})`
    )
    .get();

  // Average rating and count
  const ratingResult = db
    .select({
      avg: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(
      startDate
        ? sql`${courseRatings.courseId} IN (${courseIdList}) AND ${courseRatings.createdAt} >= ${startDate}`
        : sql`${courseRatings.courseId} IN (${courseIdList})`
    )
    .get();

  return {
    totalRevenue: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentResult?.count ?? 0,
    averageRating: ratingResult?.avg ?? null,
    ratingCount: ratingResult?.count ?? 0,
  };
}

export function getRevenueTimeSeries(opts: {
  instructorId: number;
  period: TimePeriod;
}): RevenueDataPoint[] {
  const { instructorId, period } = opts;

  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);
  if (courseIds.length === 0) return [];

  const courseIdList = sql.join(
    courseIds.map((id) => sql`${id}`),
    sql`, `
  );

  const granularity = getGranularity(period);
  const dateFormat = granularity === "day" ? "%Y-%m-%d" : "%Y-%m";

  let startDate = getStartDate(period);
  if (period === "all") {
    const earliest = db
      .select({ min: sql<string | null>`min(${purchases.createdAt})` })
      .from(purchases)
      .where(sql`${purchases.courseId} IN (${courseIdList})`)
      .get();
    if (!earliest?.min) return [];
    startDate = earliest.min;
  }

  const rows = db
    .select({
      bucket: sql<string>`strftime(${dateFormat}, ${purchases.createdAt})`,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(
      sql`${purchases.courseId} IN (${courseIdList}) AND ${purchases.createdAt} >= ${startDate}`
    )
    .groupBy(sql`strftime(${dateFormat}, ${purchases.createdAt})`)
    .all();

  const revenueByBucket = new Map(rows.map((r) => [r.bucket, r.revenue]));

  const buckets: string[] = [];
  const now = new Date();
  const start = new Date(startDate!);

  if (granularity === "day") {
    const cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    while (cursor <= end) {
      buckets.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cursor <= end) {
      buckets.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return buckets.map((bucket) => ({
    date: bucket,
    revenue: revenueByBucket.get(bucket) ?? 0,
  }));
}

export function getCourseBreakdown(opts: {
  instructorId: number;
  period: TimePeriod;
}): CourseBreakdown[] {
  const { instructorId, period } = opts;
  const startDate = getStartDate(period);

  const instructorCourses = db
    .select({ id: courses.id, title: courses.title, price: courses.price })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  return instructorCourses.map((course) => {
    const revenueResult = db
      .select({
        total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(purchases)
      .where(
        startDate
          ? sql`${purchases.courseId} = ${course.id} AND ${purchases.createdAt} >= ${startDate}`
          : sql`${purchases.courseId} = ${course.id}`
      )
      .get();

    const enrollmentResult = db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        startDate
          ? sql`${enrollments.courseId} = ${course.id} AND ${enrollments.enrolledAt} >= ${startDate}`
          : sql`${enrollments.courseId} = ${course.id}`
      )
      .get();

    const ratingResult = db
      .select({
        avg: sql<number | null>`avg(${courseRatings.rating})`,
        count: sql<number>`count(*)`,
      })
      .from(courseRatings)
      .where(
        startDate
          ? sql`${courseRatings.courseId} = ${course.id} AND ${courseRatings.createdAt} >= ${startDate}`
          : sql`${courseRatings.courseId} = ${course.id}`
      )
      .get();

    return {
      courseId: course.id,
      title: course.title,
      listPrice: course.price,
      revenue: revenueResult?.total ?? 0,
      salesCount: revenueResult?.count ?? 0,
      enrollmentCount: enrollmentResult?.count ?? 0,
      averageRating: ratingResult?.avg ?? null,
      ratingCount: ratingResult?.count ?? 0,
    };
  });
}
