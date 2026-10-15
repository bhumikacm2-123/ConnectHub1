
import { useEffect, useState } from "react";

const API_URL = "https://connecthub1.onrender.com";

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadNotifications() {
    const token = sessionStorage.getItem("connecthub_token");

    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load notifications."
        );
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(
        err.message || "Could not connect to the notification service."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load notifications when the component appears.
  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleToggle() {
    const shouldOpen = !isOpen;
    setIsOpen(shouldOpen);

    // Refresh the list whenever the user opens the dropdown.
    if (shouldOpen) {
      await loadNotifications();
    }
  }

  async function markAsRead(notification) {
    if (notification.isRead) return;

    const token = sessionStorage.getItem("connecthub_token");

    if (!token) {
      setError("Please log in again.");
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notification.id}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to mark notification as read."
        );
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true }
            : item
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (err) {
      setError(err.message || "Could not update notification.");
    }
  }

  async function markAllAsRead() {
    const token = sessionStorage.getItem("connecthub_token");

    if (!token) return;

    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/read-all`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update notifications."
        );
      }

      setNotifications((previous) =>
        previous.map((item) => ({ ...item, isRead: true }))
      );

      setUnreadCount(0);
    } catch (err) {
      setError(err.message || "Could not update notifications.");
    }
  }

  return (
    <div className="notification-widget">
      <button
        className="notification-toggle"
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={`Notifications, ${unreadCount} unread`}
      >
        <span className="notification-bell" aria-hidden="true">
          🔔
        </span>

        <span className="notification-label">Notifications</span>

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <div>
              <h3>Notifications</h3>
              <p>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                className="mark-all-read"
                type="button"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <p className="notification-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="notification-empty">
              Loading notifications...
            </p>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <span>🔔</span>
              <p>No notifications yet.</p>
              <small>
                Likes and comments on your posts will appear here.
              </small>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <div
                  className={`notification-item ${
                    notification.isRead ? "" : "unread"
                  }`}
                  key={notification.id}
                >
                  <span
                    className="notification-type-icon"
                    aria-hidden="true"
                  >
                    {notification.type === "like" ? "❤️" : "💬"}
                  </span>

                  <div className="notification-content">
                    <p>{notification.message}</p>

                    {notification.postContent && (
                      <small className="notification-post-preview">
                        {notification.postContent.length > 90
                          ? `${notification.postContent.slice(0, 90)}...`
                          : notification.postContent}
                      </small>
                    )}

                    <div className="notification-item-footer">
                      <small>
                        {notification.type === "like"
                          ? "Post liked"
                          : "New comment"}
                      </small>

                      {!notification.isRead && (
                        <button
                          className="mark-read-button"
                          type="button"
                          onClick={() => markAsRead(notification)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  {!notification.isRead && (
                    <span
                      className="unread-indicator"
                      aria-label="Unread"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
