import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.notifications.mark-read";
import { getCurrentUserId } from "~/lib/session";
import {
  getNotificationById,
  markAsRead,
} from "~/services/notificationService";
import { parseJsonBody } from "~/lib/validation";

const markReadSchema = z.object({
  notificationId: z.number(),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, markReadSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { notificationId } = parsed.data;

  const notification = getNotificationById(notificationId);
  if (!notification || notification.recipientUserId !== currentUserId) {
    throw data("Notification not found", { status: 404 });
  }

  markAsRead(notificationId);

  return { success: true };
}
