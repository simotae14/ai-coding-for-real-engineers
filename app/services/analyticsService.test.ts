import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import { getInstructorAnalytics } from "./analyticsService";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getInstructorAnalytics summary", () => {
    it("sums revenue from purchases within the period", () => {
      testDb.insert(schema.purchases).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          createdAt: daysAgo(1),
        },
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 2000,
          createdAt: daysAgo(3),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "7d");
      expect(result.summary.totalRevenueCents).toBe(3000);
    });

    it("excludes purchases outside the period", () => {
      testDb.insert(schema.purchases).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          createdAt: daysAgo(1),
        },
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          createdAt: daysAgo(60),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "30d");
      expect(result.summary.totalRevenueCents).toBe(1000);
    });

    it("counts enrollments within the period", () => {
      testDb.insert(schema.enrollments).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(2),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "7d");
      expect(result.summary.totalEnrollments).toBe(1);
    });

    it("excludes enrollments outside the period", () => {
      testDb.insert(schema.enrollments).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(45),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "30d");
      expect(result.summary.totalEnrollments).toBe(0);
    });

    it("computes average rating and rating count within the period", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb.insert(schema.courseRatings).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
          createdAt: daysAgo(1),
        },
        {
          userId: student2.id,
          courseId: base.course.id,
          rating: 3,
          createdAt: daysAgo(2),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "7d");
      expect(result.summary.averageRating).toBe(4);
      expect(result.summary.ratingCount).toBe(2);
    });

    it("excludes ratings outside the period", () => {
      testDb.insert(schema.courseRatings).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
          createdAt: daysAgo(400),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "12m");
      expect(result.summary.averageRating).toBeNull();
      expect(result.summary.ratingCount).toBe(0);
    });

    it("includes all-time data regardless of date when period is 'all'", () => {
      testDb.insert(schema.purchases).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4000,
          createdAt: monthsAgo(24),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "all");
      expect(result.summary.totalRevenueCents).toBe(4000);
    });

    it("includes data exactly at the period boundary", () => {
      testDb.insert(schema.purchases).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1500,
          createdAt: daysAgo(7),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "7d");
      expect(result.summary.totalRevenueCents).toBe(1500);
    });

    it("returns zeroed summary for an instructor with no courses", () => {
      const instructorNoCourses = testDb
        .insert(schema.users)
        .values({
          name: "No Courses Instructor",
          email: "nocourses@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const result = getInstructorAnalytics(instructorNoCourses.id, "30d");
      expect(result.summary.totalRevenueCents).toBe(0);
      expect(result.summary.totalEnrollments).toBe(0);
      expect(result.summary.averageRating).toBeNull();
      expect(result.summary.ratingCount).toBe(0);
    });

    it("returns zeroed summary for a course with no purchases or ratings", () => {
      const result = getInstructorAnalytics(base.instructor.id, "30d");
      expect(result.summary.totalRevenueCents).toBe(0);
      expect(result.summary.totalEnrollments).toBe(0);
      expect(result.summary.averageRating).toBeNull();
      expect(result.summary.ratingCount).toBe(0);
    });

    it("only includes data for courses owned by the specified instructor", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other-instructor@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Owned by a different instructor",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb.insert(schema.purchases).values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          createdAt: daysAgo(1),
        },
        {
          userId: base.user.id,
          courseId: otherCourse.id,
          pricePaid: 9999,
          createdAt: daysAgo(1),
        },
      ]).run();

      const result = getInstructorAnalytics(base.instructor.id, "30d");
      expect(result.summary.totalRevenueCents).toBe(1000);

      const otherResult = getInstructorAnalytics(otherInstructor.id, "30d");
      expect(otherResult.summary.totalRevenueCents).toBe(9999);
    });
  });
});
