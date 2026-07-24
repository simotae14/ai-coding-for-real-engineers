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
  getCommentsForLesson,
  createComment,
  getCommentById,
  softDeleteComment,
  canDeleteComment,
} from "./lessonCommentService";

function seedLesson() {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Test Module", position: 1 })
    .returning()
    .get();

  return testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Test Lesson", position: 1 })
    .returning()
    .get();
}

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

function createOtherInstructor() {
  return testDb
    .insert(schema.users)
    .values({
      name: "Other Instructor",
      email: "other-instructor@example.com",
      role: schema.UserRole.Instructor,
    })
    .returning()
    .get();
}

function createAdmin() {
  return testDb
    .insert(schema.users)
    .values({
      name: "Test Admin",
      email: "admin@example.com",
      role: schema.UserRole.Admin,
    })
    .returning()
    .get();
}

describe("lessonCommentService", () => {
  let lesson: ReturnType<typeof seedLesson>;

  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    lesson = seedLesson();
  });

  describe("createComment", () => {
    it("creates a comment with the trimmed body", () => {
      const comment = createComment(
        lesson.id,
        base.user.id,
        "  Hello world  "
      );

      expect(comment.lessonId).toBe(lesson.id);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.body).toBe("Hello world");
      expect(comment.deletedAt).toBeNull();
    });

    it("throws for an empty or whitespace-only body", () => {
      expect(() => createComment(lesson.id, base.user.id, "")).toThrow();
      expect(() => createComment(lesson.id, base.user.id, "   ")).toThrow();
    });

    it("throws when the body exceeds 2000 characters", () => {
      const tooLong = "a".repeat(2001);
      expect(() => createComment(lesson.id, base.user.id, tooLong)).toThrow();
    });

    it("allows a body of exactly 2000 characters", () => {
      const maxLength = "a".repeat(2000);
      const comment = createComment(lesson.id, base.user.id, maxLength);
      expect(comment.body).toHaveLength(2000);
    });
  });

  describe("getCommentsForLesson", () => {
    it("returns an empty list when there are no comments", () => {
      expect(getCommentsForLesson(lesson.id)).toEqual([]);
    });

    it("returns comments ordered oldest first with author name and role", () => {
      createComment(lesson.id, base.user.id, "First");
      createComment(lesson.id, base.instructor.id, "Second");

      const comments = getCommentsForLesson(lesson.id);

      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe("First");
      expect(comments[0].authorName).toBe(base.user.name);
      expect(comments[0].authorRole).toBe(schema.UserRole.Student);
      expect(comments[1].body).toBe("Second");
      expect(comments[1].authorRole).toBe(schema.UserRole.Instructor);
    });

    it("does not include comments from other lessons", () => {
      const otherLesson = seedLesson();
      createComment(lesson.id, base.user.id, "On lesson one");
      createComment(otherLesson.id, base.user.id, "On lesson two");

      const comments = getCommentsForLesson(lesson.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe("On lesson one");
    });

    it("still includes soft-deleted comments (with body intact) for the caller to redact", () => {
      const comment = createComment(lesson.id, base.user.id, "Delete me");
      softDeleteComment(comment.id);

      const comments = getCommentsForLesson(lesson.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].deletedAt).not.toBeNull();
      expect(comments[0].authorName).toBe(base.user.name);
    });
  });

  describe("softDeleteComment", () => {
    it("sets deletedAt without removing the row", () => {
      const comment = createComment(lesson.id, base.user.id, "Bye");
      const deleted = softDeleteComment(comment.id);

      expect(deleted.id).toBe(comment.id);
      expect(deleted.deletedAt).not.toBeNull();
      expect(getCommentById(comment.id)).toBeDefined();
    });
  });

  describe("canDeleteComment", () => {
    it("allows the comment author to delete their own comment", () => {
      const comment = { userId: base.user.id };
      expect(
        canDeleteComment(
          comment,
          base.user.id,
          schema.UserRole.Student,
          base.instructor.id
        )
      ).toBe(true);
    });

    it("denies a different student from deleting someone else's comment", () => {
      const secondStudent = createSecondStudent();
      const comment = { userId: base.user.id };

      expect(
        canDeleteComment(
          comment,
          secondStudent.id,
          schema.UserRole.Student,
          base.instructor.id
        )
      ).toBe(false);
    });

    it("allows the course's own instructor to delete a student's comment", () => {
      const comment = { userId: base.user.id };

      expect(
        canDeleteComment(
          comment,
          base.instructor.id,
          schema.UserRole.Instructor,
          base.instructor.id
        )
      ).toBe(true);
    });

    it("denies an instructor of a different course from deleting the comment", () => {
      const otherInstructor = createOtherInstructor();
      const comment = { userId: base.user.id };

      expect(
        canDeleteComment(
          comment,
          otherInstructor.id,
          schema.UserRole.Instructor,
          base.instructor.id
        )
      ).toBe(false);
    });

    it("allows an admin to delete any comment regardless of course", () => {
      const admin = createAdmin();
      const comment = { userId: base.user.id };

      expect(
        canDeleteComment(
          comment,
          admin.id,
          schema.UserRole.Admin,
          base.instructor.id
        )
      ).toBe(true);
    });
  });
});
