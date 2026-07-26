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
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let moduleId: number;
let lessonId: number;

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

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    moduleId = mod.id;
    const lesson = createLesson(moduleId, "Lesson 1", null, null, 1, null);
    lessonId = lesson.id;
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const result = toggleBookmark({ userId: base.user.id, lessonId });

      expect(result).toEqual({ bookmarked: true });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        true
      );
    });

    it("removes the bookmark when one already exists", () => {
      toggleBookmark({ userId: base.user.id, lessonId });

      const result = toggleBookmark({ userId: base.user.id, lessonId });

      expect(result).toEqual({ bookmarked: false });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        false
      );
    });

    it("does not create duplicate rows across multiple toggles", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId });

      const rows = testDb
        .select()
        .from(schema.lessonBookmarks)
        .all()
        .filter(
          (r) => r.userId === base.user.id && r.lessonId === lessonId
        );

      expect(rows).toHaveLength(1);
    });

    it("keeps bookmarks independent per user", () => {
      const second = createSecondStudent();

      toggleBookmark({ userId: base.user.id, lessonId });

      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        true
      );
      expect(isLessonBookmarked({ userId: second.id, lessonId })).toBe(false);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        false
      );
    });

    it("returns true after bookmarking", () => {
      toggleBookmark({ userId: base.user.id, lessonId });

      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        true
      );
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns an empty array when nothing is bookmarked", () => {
      expect(
        getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id })
      ).toEqual([]);
    });

    it("returns bookmarked lesson ids for the given course", () => {
      const lesson2 = createLesson(moduleId, "Lesson 2", null, null, 2, null);

      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId: lesson2.id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids.sort()).toEqual([lessonId, lesson2.id].sort());
    });

    it("excludes bookmarks belonging to other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another test course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      const otherModule = createModule(otherCourse.id, "Other Module", 1);
      const otherLesson = createLesson(
        otherModule.id,
        "Other Lesson",
        null,
        null,
        1,
        null
      );

      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId: otherLesson.id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([lessonId]);
    });

    it("excludes bookmarks belonging to other users", () => {
      const second = createSecondStudent();

      toggleBookmark({ userId: second.id, lessonId });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([]);
    });
  });
});
