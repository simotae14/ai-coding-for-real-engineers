import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import { NotificationType } from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const notification = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "New Enrollment",
        "Test User enrolled in Test Course",
        "/instructor/1/students"
      );

      expect(notification).toBeDefined();
      expect(notification.recipientUserId).toBe(base.instructor.id);
      expect(notification.type).toBe(NotificationType.Enrollment);
      expect(notification.title).toBe("New Enrollment");
      expect(notification.message).toBe("Test User enrolled in Test Course");
      expect(notification.linkUrl).toBe("/instructor/1/students");
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications for a user ordered newest first", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "message 1",
        "/link-1"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "message 2",
        "/link-2"
      );

      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Second");
      expect(results[1].title).toBe("First");
    });

    it("respects limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        createNotification(
          base.instructor.id,
          NotificationType.Enrollment,
          `Notification ${i}`,
          "message",
          "/link"
        );
      }

      const firstPage = getNotifications(base.instructor.id, 2, 0);
      expect(firstPage).toHaveLength(2);
      expect(firstPage[0].title).toBe("Notification 4");
      expect(firstPage[1].title).toBe("Notification 3");

      const secondPage = getNotifications(base.instructor.id, 2, 2);
      expect(secondPage).toHaveLength(2);
      expect(secondPage[0].title).toBe("Notification 2");
      expect(secondPage[1].title).toBe("Notification 1");
    });

    it("only returns notifications for the given user", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "For instructor",
        "message",
        "/link"
      );
      createNotification(
        base.user.id,
        NotificationType.Enrollment,
        "For student",
        "message",
        "/link"
      );

      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("For instructor");
    });

    it("returns empty array when user has no notifications", () => {
      expect(getNotifications(base.instructor.id, 10, 0)).toHaveLength(0);
    });
  });

  describe("getUnreadCount", () => {
    it("counts only unread notifications", () => {
      const n1 = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "message",
        "/link"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "message",
        "/link"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(2);

      markAsRead(n1.id);

      expect(getUnreadCount(base.instructor.id)).toBe(1);
    });

    it("returns 0 when there are no notifications", () => {
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("is scoped to the given user", () => {
      createNotification(
        base.user.id,
        NotificationType.Enrollment,
        "For student",
        "message",
        "/link"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a single notification as read", () => {
      const notification = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Title",
        "message",
        "/link"
      );

      const result = markAsRead(notification.id);
      expect(result.isRead).toBe(true);
    });

    it("does not affect other notifications", () => {
      const n1 = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "message",
        "/link"
      );
      const n2 = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "message",
        "/link"
      );

      markAsRead(n1.id);

      const results = getNotifications(base.instructor.id, 10, 0);
      const unchanged = results.find((n) => n.id === n2.id);
      expect(unchanged?.isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all of a user's notifications as read", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "message",
        "/link"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "message",
        "/link"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not affect other users' notifications", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "For instructor",
        "message",
        "/link"
      );
      createNotification(
        base.user.id,
        NotificationType.Enrollment,
        "For student",
        "message",
        "/link"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.user.id)).toBe(1);
    });
  });
});
