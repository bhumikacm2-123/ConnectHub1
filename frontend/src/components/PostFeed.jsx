
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://127.0.0.1:5000";

function PostFeed() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [openComments, setOpenComments] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoaded, setCommentsLoaded] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});
  const [likeBusy, setLikeBusy] = useState({});

  const [editingPostId, setEditingPostId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);

  const token = sessionStorage.getItem("connecthub_token");

  let currentUser = null;

  try {
    const savedUser = sessionStorage.getItem("connecthub_user");
    currentUser = savedUser ? JSON.parse(savedUser) : null;
  } catch {
    currentUser = null;
  }

  const isLoggedIn = Boolean(token && currentUser);

  // Load posts from the backend.
  useEffect(() => {
    async function loadPosts() {
      try {
        const savedToken = sessionStorage.getItem("connecthub_token");

        const response = await fetch(`${API_URL}/api/posts`, {
          headers: savedToken
            ? { Authorization: `Bearer ${savedToken}` }
            : {},
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load posts.");
        }

        setPosts(data.posts || []);
      } catch (err) {
        setError(err.message || "Could not load posts.");
      } finally {
        setLoading(false);
      }
    }

    loadPosts();
  }, []);

  // Publish a new post.
  async function handlePublish(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const postContent = content.trim();
    const savedToken = sessionStorage.getItem("connecthub_token");

    if (!postContent) {
      setError("Please write something before publishing.");
      return;
    }

    if (!savedToken) {
      setError("Please log in before creating a post.");
      return;
    }

    setPublishing(true);

    try {
      const response = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({ content: postContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to publish your post.");
      }

      const newPost = {
        ...data.post,
        likeCount: 0,
        likedByMe: false,
        commentCount: 0,
      };

      setPosts((previous) => [newPost, ...previous]);
      setContent("");
      setMessage("Your post was published successfully!");
    } catch (err) {
      setError(err.message || "Could not publish the post.");
    } finally {
      setPublishing(false);
    }
  }

  // Like or unlike a post.
  async function handleLike(post) {
    const savedToken = sessionStorage.getItem("connecthub_token");

    if (!savedToken) {
      setError("Please log in to like posts.");
      return;
    }

    setError("");
    setMessage("");

    setLikeBusy((previous) => ({
      ...previous,
      [post.id]: true,
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/posts/${post.id}/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update like.");
      }

      setPosts((previous) =>
        previous.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likedByMe: data.liked,
                likeCount: data.likeCount,
              }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Could not update like.");
    } finally {
      setLikeBusy((previous) => ({
        ...previous,
        [post.id]: false,
      }));
    }
  }

  // Load comments for a post.
  async function loadComments(postId) {
    setCommentsLoading((previous) => ({
      ...previous,
      [postId]: true,
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/posts/${postId}/comments`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load comments.");
      }

      setCommentsByPost((previous) => ({
        ...previous,
        [postId]: data.comments || [],
      }));

      setCommentsLoaded((previous) => ({
        ...previous,
        [postId]: true,
      }));

      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentCount: (data.comments || []).length,
              }
            : post
        )
      );
    } catch (err) {
      setError(err.message || "Could not load comments.");
    } finally {
      setCommentsLoading((previous) => ({
        ...previous,
        [postId]: false,
      }));
    }
  }

  async function toggleComments(post) {
    const willOpen = !openComments[post.id];

    setOpenComments((previous) => ({
      ...previous,
      [post.id]: willOpen,
    }));

    if (willOpen && !commentsLoaded[post.id]) {
      await loadComments(post.id);
    }
  }

  // Add a comment.
  async function handleCommentSubmit(event, post) {
    event.preventDefault();

    const commentContent = (
      commentDrafts[post.id] || ""
    ).trim();

    const savedToken = sessionStorage.getItem("connecthub_token");

    if (!savedToken) {
      setError("Please log in to comment.");
      return;
    }

    if (!commentContent) {
      setError("Please write a comment first.");
      return;
    }

    setError("");

    setCommentSubmitting((previous) => ({
      ...previous,
      [post.id]: true,
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/posts/${post.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${savedToken}`,
          },
          body: JSON.stringify({ content: commentContent }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to add comment.");
      }

      setCommentsByPost((previous) => ({
        ...previous,
        [post.id]: [
          ...(previous[post.id] || []),
          data.comment,
        ],
      }));

      setCommentsLoaded((previous) => ({
        ...previous,
        [post.id]: true,
      }));

      setCommentDrafts((previous) => ({
        ...previous,
        [post.id]: "",
      }));

      setPosts((previous) =>
        previous.map((item) =>
          item.id === post.id
            ? {
                ...item,
                commentCount: (item.commentCount || 0) + 1,
              }
            : item
        )
      );

      setMessage("Comment added successfully!");
    } catch (err) {
      setError(err.message || "Could not add comment.");
    } finally {
      setCommentSubmitting((previous) => ({
        ...previous,
        [post.id]: false,
      }));
    }
  }

  // Start editing your own post.
  function startEditing(post) {
    setEditingPostId(post.id);
    setEditDraft(post.content);
    setError("");
    setMessage("");
  }

  // Save an edited post.
  async function handleSaveEdit(event, post) {
    event.preventDefault();

    const updatedContent = editDraft.trim();
    const savedToken = sessionStorage.getItem("connecthub_token");

    if (!updatedContent) {
      setError("Post content cannot be empty.");
      return;
    }

    if (updatedContent.length > 2000) {
      setError("Post content cannot exceed 2000 characters.");
      return;
    }

    if (!savedToken) {
      setError("Please log in again to edit your post.");
      return;
    }

    setEditSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/posts/${post.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${savedToken}`,
          },
          body: JSON.stringify({ content: updatedContent }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to edit this post.");
      }

      setPosts((previous) =>
        previous.map((item) =>
          item.id === post.id
            ? { ...item, content: data.post.content }
            : item
        )
      );

      setEditingPostId(null);
      setEditDraft("");
      setMessage("Post updated successfully!");
    } catch (err) {
      setError(err.message || "Could not update the post.");
    } finally {
      setEditSaving(false);
    }
  }

  // Delete your own post.
  async function handleDelete(post) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this post? This cannot be undone."
    );

    if (!confirmed) return;

    const savedToken = sessionStorage.getItem("connecthub_token");

    if (!savedToken) {
      setError("Please log in again to delete your post.");
      return;
    }

    setDeletingPostId(post.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/posts/${post.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete this post.");
      }

      setPosts((previous) =>
        previous.filter((item) => item.id !== post.id)
      );

      setOpenComments((previous) => {
        const next = { ...previous };
        delete next[post.id];
        return next;
      });

      setCommentsByPost((previous) => {
        const next = { ...previous };
        delete next[post.id];
        return next;
      });

      if (editingPostId === post.id) {
        setEditingPostId(null);
        setEditDraft("");
      }

      setMessage("Post deleted successfully!");
    } catch (err) {
      setError(err.message || "Could not delete the post.");
    } finally {
      setDeletingPostId(null);
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const normalized = value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;

    const date = new Date(normalized);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  }

  return (
    <section className="feed-section" id="feed">
      <div className="feed-heading">
        <span className="eyebrow">COMMUNITY FEED</span>
        <h2>What's happening?</h2>
        <p>
          Share ideas, learning experiences, and project updates.
        </p>
      </div>

      {isLoggedIn ? (
        <form className="create-post-card" onSubmit={handlePublish}>
          <label htmlFor="post-content">
            Share something with your community
          </label>

          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What have you been learning or building?"
            maxLength={2000}
            rows={4}
            required
          />

          <div className="create-post-footer">
            <span>{content.length}/2000 characters</span>

            <button
              className="button"
              type="submit"
              disabled={publishing || !content.trim()}
            >
              {publishing ? "Publishing..." : "Publish post →"}
            </button>
          </div>
        </form>
      ) : (
        <div className="feed-login-prompt">
          <p>Log in to share your ideas with the community.</p>
          <Link className="button" to="/login">
            Log in to post
          </Link>
        </div>
      )}

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="posts-list">
        {loading ? (
          <p className="feed-empty">Loading posts...</p>
        ) : posts.length === 0 ? (
          <div className="feed-empty">
            <span>🌱</span>
            <h3>Be the first to share something!</h3>
            <p>Your community's first post could start here.</p>
          </div>
        ) : (
          posts.map((post) => {
            const isOwnPost =
              currentUser &&
              Number(currentUser.id) === Number(post.userId);

            const isEditing = editingPostId === post.id;

            return (
              <article className="feed-post-card" key={post.id}>
                <div className="post-author">
                  <div className="post-avatar">
                    {(post.author || "U").charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3>{post.author}</h3>
                    <span className="post-date">
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                </div>

                {isEditing ? (
                  <form
                    className="edit-post-form"
                    onSubmit={(event) => handleSaveEdit(event, post)}
                  >
                    <label htmlFor={`edit-post-${post.id}`}>
                      Edit your post
                    </label>

                    <textarea
                      id={`edit-post-${post.id}`}
                      value={editDraft}
                      onChange={(event) =>
                        setEditDraft(event.target.value)
                      }
                      maxLength={2000}
                      rows={4}
                      required
                    />

                    <div className="edit-post-actions">
                      <button
                        className="button"
                        type="submit"
                        disabled={editSaving || !editDraft.trim()}
                      >
                        {editSaving ? "Saving..." : "Save changes"}
                      </button>

                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setEditingPostId(null);
                          setEditDraft("");
                        }}
                        disabled={editSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="post-content">{post.content}</p>
                )}

                {isOwnPost && !isEditing && (
                  <div className="owner-post-actions">
                    <button
                      className="post-action-button"
                      type="button"
                      onClick={() => startEditing(post)}
                      disabled={Boolean(deletingPostId === post.id)}
                    >
                      ✏️ Edit
                    </button>

                    <button
                      className="post-action-button delete-post-button"
                      type="button"
                      onClick={() => handleDelete(post)}
                      disabled={deletingPostId === post.id}
                    >
                      {deletingPostId === post.id
                        ? "Deleting..."
                        : "🗑 Delete"}
                    </button>
                  </div>
                )}

                {!isEditing && (
                  <>
                    <div className="post-actions">
                      <button
                        className={`post-action-button ${
                          post.likedByMe ? "is-liked" : ""
                        }`}
                        type="button"
                        onClick={() => handleLike(post)}
                        disabled={
                          !isLoggedIn || Boolean(likeBusy[post.id])
                        }
                      >
                        {likeBusy[post.id]
                          ? "Updating..."
                          : post.likedByMe
                            ? "♥ Liked"
                            : "♡ Like"}
                        {" · "}
                        {post.likeCount || 0}
                      </button>

                      <button
                        className="post-action-button"
                        type="button"
                        onClick={() => toggleComments(post)}
                      >
                        💬 Comments · {post.commentCount || 0}
                      </button>
                    </div>

                    {openComments[post.id] && (
                      <div className="comments-panel">
                        <h4>Comments</h4>

                        {commentsLoading[post.id] ? (
                          <p>Loading comments...</p>
                        ) : (commentsByPost[post.id] || []).length ===
                          0 ? (
                          <p className="no-comments">
                            No comments yet. Start the conversation!
                          </p>
                        ) : (
                          <div className="comments-list">
                            {(commentsByPost[post.id] || []).map(
                              (comment) => (
                                <div
                                  className="comment-item"
                                  key={comment.id}
                                >
                                  <div className="comment-avatar">
                                    {(comment.author || "U")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>

                                  <div className="comment-body">
                                    <strong>{comment.author}</strong>
                                    <p>{comment.content}</p>
                                    <span>
                                      {formatDate(comment.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {isLoggedIn ? (
                          <form
                            className="comment-form"
                            onSubmit={(event) =>
                              handleCommentSubmit(event, post)
                            }
                          >
                            <input
                              type="text"
                              value={commentDrafts[post.id] || ""}
                              onChange={(event) =>
                                setCommentDrafts((previous) => ({
                                  ...previous,
                                  [post.id]: event.target.value,
                                }))
                              }
                              placeholder="Write a comment..."
                              maxLength={1000}
                              required
                            />

                            <button
                              className="button button-small"
                              type="submit"
                              disabled={
                                Boolean(commentSubmitting[post.id]) ||
                                !(commentDrafts[post.id] || "").trim()
                              }
                            >
                              {commentSubmitting[post.id]
                                ? "Sending..."
                                : "Comment"}
                            </button>
                          </form>
                        ) : (
                          <p className="no-comments">
                            <Link to="/login">Log in</Link> to add a
                            comment.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default PostFeed;
