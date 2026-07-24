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
import {
  getUserRatingForCourse,
  upsertRating,
  getAverageRatingForCourse,
  getAverageRatingsForCourses,
} from "./ratingService";

function createSecondStudent() {
  return testDb
    .insert(schema.users)
    .values({
      name: "Second Student",
      email: "second-student@example.com",
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("upsertRating", () => {
    it("inserts a new rating when none exists", () => {
      const rating = upsertRating(base.user.id, base.course.id, 4);

      expect(rating).toBeDefined();
      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
      expect(rating.score).toBe(4);
    });

    it("updates the existing rating instead of creating a duplicate", () => {
      upsertRating(base.user.id, base.course.id, 3);
      upsertRating(base.user.id, base.course.id, 5);

      const matching = testDb
        .select()
        .from(schema.ratings)
        .all()
        .filter(
          (r) => r.userId === base.user.id && r.courseId === base.course.id
        );

      expect(matching).toHaveLength(1);
      expect(matching[0].score).toBe(5);
    });

    it("preserves the original createdAt when updating an existing rating", () => {
      const original = upsertRating(base.user.id, base.course.id, 3);
      const updated = upsertRating(base.user.id, base.course.id, 5);

      expect(updated.id).toBe(original.id);
      expect(updated.createdAt).toBe(original.createdAt);
    });

    it("throws for scores outside the 1-5 range or non-integers", () => {
      expect(() => upsertRating(base.user.id, base.course.id, 0)).toThrow();
      expect(() => upsertRating(base.user.id, base.course.id, 6)).toThrow();
      expect(() => upsertRating(base.user.id, base.course.id, -1)).toThrow();
      expect(() => upsertRating(base.user.id, base.course.id, 3.5)).toThrow();
    });

    it("allows two different users to rate the same course independently", () => {
      const second = createSecondStudent();

      upsertRating(base.user.id, base.course.id, 2);
      upsertRating(second.id, base.course.id, 5);

      expect(getUserRatingForCourse(base.user.id, base.course.id)?.score).toBe(
        2
      );
      expect(getUserRatingForCourse(second.id, base.course.id)?.score).toBe(
        5
      );
    });
  });

  describe("ratings_user_course_unique constraint", () => {
    it("rejects a raw duplicate insert for the same user and course at the database level", () => {
      testDb
        .insert(schema.ratings)
        .values({ userId: base.user.id, courseId: base.course.id, score: 3 })
        .run();

      expect(() =>
        testDb
          .insert(schema.ratings)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            score: 5,
          })
          .run()
      ).toThrow();
    });
  });

  describe("getUserRatingForCourse", () => {
    it("returns undefined when no rating exists", () => {
      expect(
        getUserRatingForCourse(base.user.id, base.course.id)
      ).toBeUndefined();
    });

    it("returns the rating row when one exists", () => {
      upsertRating(base.user.id, base.course.id, 4);
      const rating = getUserRatingForCourse(base.user.id, base.course.id);
      expect(rating?.score).toBe(4);
    });
  });

  describe("getAverageRatingForCourse", () => {
    it("returns null average and 0 count when there are no ratings", () => {
      expect(getAverageRatingForCourse(base.course.id)).toEqual({
        average: null,
        count: 0,
      });
    });

    it("returns the correct average and count for a single rating", () => {
      upsertRating(base.user.id, base.course.id, 4);
      expect(getAverageRatingForCourse(base.course.id)).toEqual({
        average: 4,
        count: 1,
      });
    });

    it("returns the correct average and count for multiple ratings", () => {
      const second = createSecondStudent();
      upsertRating(base.user.id, base.course.id, 3);
      upsertRating(second.id, base.course.id, 5);

      expect(getAverageRatingForCourse(base.course.id)).toEqual({
        average: 4,
        count: 2,
      });
    });
  });

  describe("getAverageRatingsForCourses", () => {
    it("returns an empty map for an empty input array without querying", () => {
      const result = getAverageRatingsForCourses([]);
      expect(result.size).toBe(0);
    });

    it("returns grouped results and omits courses with zero ratings", () => {
      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another test course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const secondStudent = createSecondStudent();

      upsertRating(base.user.id, base.course.id, 3);
      upsertRating(secondStudent.id, base.course.id, 5);

      const result = getAverageRatingsForCourses([
        base.course.id,
        secondCourse.id,
      ]);

      expect(result.get(base.course.id)).toEqual({ average: 4, count: 2 });
      expect(result.has(secondCourse.id)).toBe(false);
    });
  });
});
