
import "./Messages.css";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = "https://connecthub1.onrender.com";
const REFRESH_INTERVAL = 4000;

function getSavedUserId() {
  try {
    const user = JSON.parse(
      sessionStorage.getItem("connecthub_user") || "{}"
    );
    return Number(user.id) || null;
  } catch {
    return null;
  }
}

async function readJsonResponse(response) {
  return response.json().catch(() => ({}));
}

export default function Messages() {
  const [connections, setConnections] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  const token = sessionStorage.getItem("connecthub_token");
  const currentUserId = getSavedUserId();

  // Load accepted connections and unread-message counts.
  useEffect(() => {
    let active = true;
    let firstLoad = true;

    async function loadConnections() {
      if (!token) {
        if (active) {
          setError("Please log in to use private messaging.");
          setConnections([]);
          setSelectedUser(null);
          setLoadingConnections(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/connections`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load your connections."
          );
        }

        if (!active) return;

        const list = Array.isArray(data.connections)
          ? data.connections
          : [];

        setConnections(list);

        setSelectedUser((current) => {
          if (current) {
            const refreshed = list.find(
              (person) =>
                Number(person.userId) === Number(current.userId)
            );
            if (refreshed) return refreshed;
          }
          return list[0] || null;
        });

        if (firstLoad) setError("");
      } catch (err) {
        if (active && firstLoad) {
          setError(err.message || "Unable to load connections.");
        }
      } finally {
        if (active && firstLoad) {
          setLoadingConnections(false);
          firstLoad = false;
        }
      }
    }

    loadConnections();
    const intervalId = setInterval(
      loadConnections,
      REFRESH_INTERVAL
    );

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [token]);

  // Load the selected conversation.
  // The backend marks incoming messages as read.
  useEffect(() => {
    const otherUserId = selectedUser?.userId;

    if (!otherUserId || !token) {
      setMessages([]);
      setLoadingMessages(false);
      return undefined;
    }

    let active = true;
    let firstLoad = true;

    async function loadMessages() {
      try {
        const response = await fetch(
          `${API_BASE}/api/messages/${otherUserId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load this conversation."
          );
        }

        if (!active) return;

        setMessages(
          Array.isArray(data.messages) ? data.messages : []
        );
        setError("");
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load messages.");
        }
      } finally {
        if (active && firstLoad) {
          setLoadingMessages(false);
          firstLoad = false;
        }
      }
    }

    setMessages([]);
    setError("");
    setLoadingMessages(true);

    loadMessages();
    const intervalId = setInterval(
      loadMessages,
      REFRESH_INTERVAL
    );

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [selectedUser?.userId, token]);

  // Automatically scroll to the latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  // Send a message.
  async function handleSend(event) {
    event.preventDefault();

    const content = draft.trim();
    const otherUserId = selectedUser?.userId;

    if (!content || !otherUserId || sending || !token) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/messages/${otherUserId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to send the message."
        );
      }

      if (data.message) {
        setMessages((previous) => {
          if (
            previous.some(
              (message) => message.id === data.message.id
            )
          ) {
            return previous;
          }

          return [...previous, data.message];
        });
      }

      setDraft("");
    } catch (err) {
      setError(err.message || "Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  // Delete a message sent by the current user.
  async function handleDeleteMessage(messageId) {
    const confirmed = window.confirm(
      "Delete this message for both users? This cannot be undone."
    );

    if (!confirmed || !token || deletingMessageId !== null) {
      return;
    }

    setDeletingMessageId(messageId);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/messages/delete/${messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not delete the message. Check that the backend delete API is installed."
        );
      }

      setMessages((previous) =>
        previous.filter(
          (message) => Number(message.id) !== Number(messageId)
        )
      );
    } catch (err) {
      setError(err.message || "Unable to delete the message.");
    } finally {
      setDeletingMessageId(null);
    }
  }

  const pageStyle = {
    minHeight: "100vh",
    background: "#f3f6fc",
    padding: "28px 16px",
    color: "#1e293b",
    fontFamily: "Arial, sans-serif",
  };

  const linkStyle = {
    color: "#4338ca",
    textDecoration: "none",
    fontWeight: 600,
  };

  const panelStyle = {
    background: "#ffffff",
    borderRadius: "18px",
    overflow: "hidden",
    minHeight: "650px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.07)",
  };

  // Require login before opening messages.
  if (!token) {
    return (
      <main style={pageStyle}>
        <div
          style={{
            ...panelStyle,
            maxWidth: "600px",
            minHeight: "auto",
            padding: "32px",
            margin: "50px auto",
            textAlign: "center",
          }}
        >
          <h2>Please log in first</h2>
          <p>You need an account to use private messaging.</p>
          <Link to="/login" style={linkStyle}>
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Page header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "22px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#312e81",
                fontSize: "30px",
              }}
            >
              ConnectHub Messages
            </h1>
            <p style={{ color: "#64748b" }}>
              Stay connected with your community.
            </p>
          </div>

          <Link to="/connections" style={linkStyle}>
            ← My Connections
          </Link>
        </header>

        {/* Display errors */}
        {error && (
          <div
            role="alert"
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Main chat layout */}
        <div
          style={{
            ...panelStyle,
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 300px) minmax(0, 1fr)",
          }}
        >
          {/* Connections sidebar */}
          <aside
            style={{
              borderRight: "1px solid #e2e8f0",
              padding: "20px 12px",
              background: "#fafbff",
            }}
          >
            <h3 style={{ padding: "0 10px" }}>
              Your conversations
            </h3>

            {loadingConnections && (
              <p style={{ padding: "10px", color: "#64748b" }}>
                Loading connections...
              </p>
            )}

            {!loadingConnections && connections.length === 0 && (
              <div style={{ padding: "10px", lineHeight: 1.7 }}>
                <p>
                  You don't have any accepted connections yet.
                </p>
                <Link to="/discover" style={linkStyle}>
                  Discover people →
                </Link>
              </div>
            )}

            {connections.map((person) => {
              const selected =
                Number(selectedUser?.userId) ===
                Number(person.userId);

              const unreadCount = Math.max(
                0,
                Number(person.unreadCount) || 0
              );

              return (
                <button
                  key={person.userId}
                  type="button"
                  onClick={() => setSelectedUser(person)}
                  aria-label={`${person.fullName}, ${unreadCount} unread messages`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                    padding: "12px 10px",
                    marginBottom: "6px",
                    border: "none",
                    borderRadius: "12px",
                    background: selected
                      ? "#e0e7ff"
                      : "transparent",
                    cursor: "pointer",
                    color: "#1e293b",
                  }}
                >
                  {/* Initial avatar */}
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      background: selected
                        ? "#4f46e5"
                        : "#dbeafe",
                      color: selected
                        ? "#ffffff"
                        : "#1d4ed8",
                      fontSize: "18px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {(person.fullName || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  {/* Name and connection status */}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {person.fullName}
                    </strong>

                    <span
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Connected
                    </span>
                  </span>

                  {/* Unread-message badge */}
                  {unreadCount > 0 && (
                    <span
                      title={`${unreadCount} unread messages`}
                      style={{
                        minWidth: "23px",
                        height: "23px",
                        padding: "0 6px",
                        borderRadius: "999px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#16a34a",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Chat window */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            {selectedUser ? (
              <>
                {/* Selected connection header */}
                <div
                  style={{
                    padding: "17px 22px",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      display: "grid",
                      placeItems: "center",
                      background: "#4f46e5",
                      color: "#ffffff",
                      borderRadius: "50%",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {(selectedUser.fullName || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>{selectedUser.fullName}</strong>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#16a34a",
                        marginTop: "4px",
                      }}
                    >
                      Accepted connection
                    </div>
                  </div>
                </div>

                {/* Message list */}
                <div
                  style={{
                    flex: 1,
                    padding: "22px",
                    minHeight: "400px",
                    maxHeight: "480px",
                    overflowY: "auto",
                    background: "#f8fafc",
                  }}
                >
                  {loadingMessages && (
                    <p
                      style={{
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      Loading messages...
                    </p>
                  )}

                  {!loadingMessages && messages.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#64748b",
                        marginTop: "80px",
                      }}
                    >
                      <div style={{ fontSize: "36px" }}>💬</div>
                      <h3>Start a conversation</h3>
                      <p>
                        Send your first message to{" "}
                        {selectedUser.fullName}.
                      </p>
                    </div>
                  )}

                  {messages.map((message) => {
                    const mine =
                      Number(message.senderId) === currentUserId;

                    const messageTime = message.createdAt
                      ? new Date(
                          message.createdAt.replace(" ", "T") +
                            (message.createdAt.endsWith("Z")
                              ? ""
                              : "Z")
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: "flex",
                          justifyContent: mine
                            ? "flex-end"
                            : "flex-start",
                          marginBottom: "14px",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "78%",
                            padding: "12px 15px",
                            borderRadius: mine
                              ? "16px 16px 4px 16px"
                              : "16px 16px 16px 4px",
                            background: mine
                              ? "#4f46e5"
                              : "#ffffff",
                            color: mine
                              ? "#ffffff"
                              : "#1e293b",
                            boxShadow:
                              "0 2px 8px rgba(15,23,42,0.06)",
                            overflowWrap: "anywhere",
                          }}
                        >
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {message.content}
                          </div>

                          {/* Message timestamp */}
                          <div
                            style={{
                              fontSize: "10px",
                              marginTop: "7px",
                              opacity: 0.78,
                              textAlign: "right",
                            }}
                          >
                            {messageTime}
                          </div>

                          {/* Read receipt and delete button */}
                          {mine && (
                            <>
                              <div
                                aria-label={
                                  message.isRead
                                    ? "Read by recipient"
                                    : "Sent, not yet read"
                                }
                                style={{
                                  fontSize: "11px",
                                  marginTop: "3px",
                                  textAlign: "right",
                                  fontWeight: 700,
                                  color: message.isRead
                                    ? "#bbf7d0"
                                    : "#e0e7ff",
                                }}
                              >
                                {message.isRead
                                  ? "✓✓ Read"
                                  : "✓ Sent"}
                              </div>

                              <div
                                style={{
                                  textAlign: "right",
                                  marginTop: "5px",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteMessage(message.id)
                                  }
                                  disabled={deletingMessageId !== null}
                                  title="Delete this message for both users"
                                  style={{
                                    border:
                                      "1px solid rgba(255,255,255,0.45)",
                                    borderRadius: "6px",
                                    padding: "3px 7px",
                                    background:
                                      "rgba(255,255,255,0.12)",
                                    color: "#ffffff",
                                    fontSize: "11px",
                                    cursor:
                                      deletingMessageId !== null
                                        ? "wait"
                                        : "pointer",
                                    opacity:
                                      deletingMessageId !== null &&
                                      deletingMessageId !== message.id
                                        ? 0.5
                                        : 1,
                                  }}
                                >
                                  {deletingMessageId === message.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} />
                </div>

                {/* Send-message form */}
                <form
                  onSubmit={handleSend}
                  style={{
                    display: "flex",
                    gap: "10px",
                    padding: "16px",
                    borderTop: "1px solid #e2e8f0",
                    background: "#ffffff",
                  }}
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) =>
                      setDraft(event.target.value)
                    }
                    placeholder={`Message ${selectedUser.fullName}...`}
                    maxLength={2000}
                    aria-label="Write a message"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: "1px solid #cbd5e1",
                      borderRadius: "12px",
                      padding: "13px 14px",
                      outlineColor: "#6366f1",
                    }}
                  />

                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    style={{
                      border: "none",
                      borderRadius: "10px",
                      padding: "12px 18px",
                      background: "#4f46e5",
                      color: "#ffffff",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: !draft.trim() || sending ? 0.6 : 1,
                    }}
                  >
                    {sending ? "Sending..." : "Send ➤"}
                  </button>
                </form>
              </>
            ) : (
              <div
                style={{
                  display: "grid",
                  placeContent: "center",
                  textAlign: "center",
                  padding: "24px",
                  color: "#64748b",
                }}
              >
                <div style={{ fontSize: "44px" }}>💬</div>
                <h2>Your messages</h2>
                <p>Select a connection to open a conversation.</p>
              </div>
            )}
          </section>
        </div>

        <p
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginTop: "14px",
          }}
        >
          Messages and unread counts refresh automatically every four
          seconds. Sent messages show “Read” when the recipient opens
          the conversation. You can delete messages you sent.
        </p>
      </div>
    </main>
  );
}
