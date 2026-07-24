import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.lesson-comments";
import { getCurrentUserId } from "~/lib/session";
import { isUserEnrolled } from "~/services/enrollmentService";
import { getUserById } from "~/services/userService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import { getCourseById } from "~/services/courseService";
import {
  createComment,
  getCommentById,
  softDeleteComment,
  canDeleteComment,
} from "~/services/lessonCommentService";
import { UserRole } from "~/db/schema";
import { parseJsonBody } from "~/lib/validation";

const createSchema = z.object({
  intent: z.literal("create"),
  lessonId: z.number().int(),
  body: z.string().trim().min(1).max(2000),
});

const deleteSchema = z.object({
  intent: z.literal("delete"),
  commentId: z.number().int(),
});

const actionSchema = z.discriminatedUnion("intent", [createSchema, deleteSchema]);

function resolveLessonCourse(lessonId: number) {
  const lesson = getLessonById(lessonId);
  if (!lesson) return null;
  const mod = getModuleById(lesson.moduleId);
  if (!mod) return null;
  const course = getCourseById(mod.courseId);
  if (!course) return null;
  return course;
}

function canViewOrPost(
  currentUserId: number,
  role: UserRole,
  course: { id: number; instructorId: number }
) {
  if (role === UserRole.Admin) return true;
  if (role === UserRole.Instructor && course.instructorId === currentUserId) {
    return true;
  }
  return isUserEnrolled(currentUserId, course.id);
}

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, actionSchema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  if (parsed.data.intent === "create") {
    const { lessonId, body } = parsed.data;

    const course = resolveLessonCourse(lessonId);
    if (!course) {
      throw data("Lesson not found", { status: 404 });
    }

    if (!canViewOrPost(currentUserId, currentUser.role, course)) {
      throw data("You do not have access to comment on this lesson", {
        status: 403,
      });
    }

    const comment = createComment(lessonId, currentUserId, body);
    return { success: true, comment };
  }

  const { commentId } = parsed.data;
  const comment = getCommentById(commentId);
  if (!comment || comment.deletedAt) {
    throw data("Comment not found", { status: 404 });
  }

  const course = resolveLessonCourse(comment.lessonId);
  if (!course) {
    throw data("Lesson not found", { status: 404 });
  }

  if (
    !canDeleteComment(
      comment,
      currentUserId,
      currentUser.role,
      course.instructorId
    )
  ) {
    throw data("You do not have permission to delete this comment", {
      status: 403,
    });
  }

  const deleted = softDeleteComment(commentId);
  return { success: true, comment: deleted };
}
