import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
import jwt
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from uuid import uuid4
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from database import (
    get_connection,
    initialize_database,
    initialize_messages_table,
    initialize_profile_picture_column,
)
# =========================================================
# CONFIGURATION
# =========================================================
BASE_DIR = Path(__file__).resolve().parent
PROFILE_PICTURE_DIR = BASE_DIR / "uploads" / "profile_pictures"
PROFILE_PICTURE_DIR.mkdir(parents=True, exist_ok=True)
MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024  # 5 MB
load_dotenv(BASE_DIR / ".env")
app = Flask(__name__)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
# Development configuration: allow Vite on localhost or 127.0.0.1
# on any port. Restrict this to your frontend origin in production.
CORS(
    app,
    origins=[
        re.compile(r"^http://(localhost|127\.0\.0\.1):\d+$"),
        "https://connect-hub1.vercel.app",
    ],
)
initialize_database()
initialize_messages_table()
initialize_profile_picture_column()
# =========================================================
# HOME AND HEALTH
# =========================================================
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "success",
        "message": "Welcome to ConnectHub Backend!",
    }), 200
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "success",
        "message": "ConnectHub backend is running!",
    }), 200
# =========================================================
# AUTHENTICATION HELPER
# =========================================================
def get_authenticated_user():
    """Validate a JWT and return the ID of an existing user."""
    if not JWT_SECRET_KEY:
        return None, (
            jsonify({
                "status": "error",
                "message": "Server authentication is not configured.",
            }),
            500,
        )
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None, (
            jsonify({
                "status": "error",
                "message": "Please log in to access this feature.",
            }),
            401,
        )
    token = authorization[len("Bearer "):].strip()
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        user_id = int(payload["sub"])
        connection = get_connection()
        try:
            user = connection.execute(
                "SELECT id FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        finally:
            connection.close()
        if user is None:
            return None, (
                jsonify({
                    "status": "error",
                    "message": "User account was not found.",
                }),
                401,
            )
        return user_id, None
    except jwt.ExpiredSignatureError:
        return None, (
            jsonify({
                "status": "error",
                "message": "Your session has expired. Please log in again.",
            }),
            401,
        )
    except (
        jwt.InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ):
        return None, (
            jsonify({
                "status": "error",
                "message": "Invalid login session. Please log in again.",
            }),
            401,
        )
# =========================================================
# SIGNUP
# =========================================================
@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    full_name = data.get("fullName", "")
    email = data.get("email", "")
    password = data.get("password", "")
    if not all(
        isinstance(value, str)
        for value in (full_name, email, password)
    ):
        return jsonify({
            "status": "error",
            "message": "Please provide valid signup information.",
        }), 400
    full_name = full_name.strip()
    email = email.strip().lower()
    if not full_name or not email or not password:
        return jsonify({
            "status": "error",
            "message": "Name, email, and password are required.",
        }), 400
    if len(full_name) > 100:
        return jsonify({
            "status": "error",
            "message": "Name must be 100 characters or fewer.",
        }), 400
    if (
        len(email) > 254
        or email.count("@") != 1
        or email.startswith("@")
        or email.endswith("@")
    ):
        return jsonify({
            "status": "error",
            "message": "Please enter a valid email address.",
        }), 400
    if len(password) < 8 or len(password) > 1024:
        return jsonify({
            "status": "error",
            "message": "Password must contain at least 8 characters.",
        }), 400
    password_hash = generate_password_hash(password)
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO users (full_name, email, password_hash)
            VALUES (?, ?, ?)
            """,
            (full_name, email, password_hash),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Your ConnectHub account has been created!",
            "user": {
                "id": cursor.lastrowid,
                "fullName": full_name,
                "email": email,
            },
        }), 201
    except sqlite3.IntegrityError:
        connection.rollback()
        return jsonify({
            "status": "error",
            "message": "This email is already registered.",
        }), 409
    except Exception:
        connection.rollback()
        app.logger.exception("Signup failed")
        return jsonify({
            "status": "error",
            "message": "Unable to create your account right now.",
        }), 500
    finally:
        connection.close()
# =========================================================
# LOGIN
# =========================================================
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    email = data.get("email", "")
    password = data.get("password", "")
    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({
            "status": "error",
            "message": "Please enter a valid email and password.",
        }), 400
    email = email.strip().lower()
    if not email or not password:
        return jsonify({
            "status": "error",
            "message": "Email and password are required.",
        }), 400
    if not JWT_SECRET_KEY:
        app.logger.error("JWT_SECRET_KEY is missing from backend/.env")
        return jsonify({
            "status": "error",
            "message": "Server authentication is not configured.",
        }), 500
    connection = get_connection()
    try:
        user = connection.execute(
            """
            SELECT id, full_name, email, password_hash
            FROM users
            WHERE email = ?
            """,
            (email,),
        ).fetchone()
    finally:
        connection.close()
    if user is None or not check_password_hash(
        user["password_hash"],
        password,
    ):
        return jsonify({
            "status": "error",
            "message": "Invalid email or password.",
        }), 401
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user["id"]),
            "email": user["email"],
            "iat": now,
            "exp": now + timedelta(hours=24),
        },
        JWT_SECRET_KEY,
        algorithm="HS256",
    )
    return jsonify({
        "status": "success",
        "message": "Login successful!",
        "token": token,
        "user": {
            "id": user["id"],
            "fullName": user["full_name"],
            "email": user["email"],
        },
    }), 200
# =========================================================
# PROFILE
# =========================================================
@app.route("/api/profile", methods=["GET"])
def get_profile():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        user = connection.execute(
            """
           SELECT
    id, full_name, email, bio, skills, interests,
    created_at, profile_picture
FROM users
WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
    finally:
        connection.close()
    if user is None:
        return jsonify({
            "status": "error",
            "message": "User account was not found.",
        }), 404
    return jsonify({
        "status": "success",
        "profile": {
            "id": user["id"],
            "fullName": user["full_name"],
            "email": user["email"],
            "bio": user["bio"],
            "skills": user["skills"],
            "interests": user["interests"],
            "profilePicture": user["profile_picture"],
            "createdAt": user["created_at"],
        },
    }), 200
@app.route("/api/profile", methods=["PUT"])
def update_profile():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    bio = data.get("bio", "")
    skills = data.get("skills", "")
    interests = data.get("interests", "")
    if not all(
        isinstance(value, str)
        for value in (bio, skills, interests)
    ):
        return jsonify({
            "status": "error",
            "message": "Bio, skills, and interests must be text.",
        }), 400
    bio = bio.strip()
    skills = skills.strip()
    interests = interests.strip()
    if any(
        len(value) > 500
        for value in (bio, skills, interests)
    ):
        return jsonify({
            "status": "error",
            "message": "Each profile field must be 500 characters or fewer.",
        }), 400
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            UPDATE users
            SET bio = ?, skills = ?, interests = ?
            WHERE id = ?
            """,
            (bio, skills, interests, user_id),
        )
        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({
                "status": "error",
                "message": "User account was not found.",
            }), 404
        connection.commit()
    except Exception:
        connection.rollback()
        app.logger.exception("Profile update failed")
        return jsonify({
            "status": "error",
            "message": "Unable to update your profile.",
        }), 500
    finally:
        connection.close()
    return jsonify({
        "status": "success",
        "message": "Your profile has been updated!",
    }), 200
# =========================================================
# GET POSTS, INCLUDING LIKE AND COMMENT COUNTS
# =========================================================
@app.route("/api/posts", methods=["GET"])
def get_posts():
    limit = request.args.get("limit", default=20, type=int) or 20
    limit = max(1, min(limit, 50))
    viewer_id = None
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer ") and JWT_SECRET_KEY:
        token = authorization[len("Bearer "):].strip()
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=["HS256"],
            )
            viewer_id = int(payload["sub"])
        except (
            jwt.InvalidTokenError,
            KeyError,
            TypeError,
            ValueError,
        ):
            viewer_id = None
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
                posts.id,
                posts.user_id,
                posts.content,
                posts.created_at,
                users.full_name,
                (
                    SELECT COUNT(*)
                    FROM likes
                    WHERE likes.post_id = posts.id
                ) AS like_count,
                (
                    SELECT COUNT(*)
                    FROM likes
                    WHERE likes.post_id = posts.id
                      AND likes.user_id = ?
                ) AS liked_by_me,
                (
                    SELECT COUNT(*)
                    FROM comments
                    WHERE comments.post_id = posts.id
                ) AS comment_count
            FROM posts
            JOIN users ON users.id = posts.user_id
            ORDER BY posts.id DESC
            LIMIT ?
            """,
            (viewer_id, limit),
        ).fetchall()
        posts = [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "author": row["full_name"],
                "content": row["content"],
                "createdAt": row["created_at"],
                "likeCount": row["like_count"],
                "likedByMe": row["liked_by_me"] > 0,
                "commentCount": row["comment_count"],
            }
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "posts": posts,
        }), 200
    finally:
        connection.close()
# =========================================================
# CREATE POST
# =========================================================
@app.route("/api/posts", methods=["POST"])
def create_post():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    content = data.get("content", "")
    if not isinstance(content, str):
        return jsonify({
            "status": "error",
            "message": "Post content must be text.",
        }), 400
    content = content.strip()
    if not content:
        return jsonify({
            "status": "error",
            "message": "Please write something before publishing.",
        }), 400
    if len(content) > 2000:
        return jsonify({
            "status": "error",
            "message": "Post content cannot exceed 2000 characters.",
        }), 400
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO posts (user_id, content)
            VALUES (?, ?)
            """,
            (user_id, content),
        )
        post_id = cursor.lastrowid
        connection.commit()
        row = connection.execute(
            """
            SELECT posts.id, posts.user_id, posts.content,
                   posts.created_at, users.full_name
            FROM posts
            JOIN users ON users.id = posts.user_id
            WHERE posts.id = ?
            """,
            (post_id,),
        ).fetchone()
        return jsonify({
            "status": "success",
            "message": "Your post was published!",
            "post": {
                "id": row["id"],
                "userId": row["user_id"],
                "author": row["full_name"],
                "content": row["content"],
                "createdAt": row["created_at"],
                "likeCount": 0,
                "likedByMe": False,
                "commentCount": 0,
            },
        }), 201
    except Exception:
        connection.rollback()
        app.logger.exception("Creating post failed")
        return jsonify({
            "status": "error",
            "message": "Unable to publish the post.",
        }), 500
    finally:
        connection.close()
# =========================================================
# EDIT POST - OWNER ONLY
# =========================================================
@app.route("/api/posts/<int:post_id>", methods=["PATCH"])
def edit_post(post_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    content = data.get("content", "")
    if not isinstance(content, str):
        return jsonify({
            "status": "error",
            "message": "Post content must be text.",
        }), 400
    content = content.strip()
    if not content or len(content) > 2000:
        return jsonify({
            "status": "error",
            "message": "Post content must be between 1 and 2000 characters.",
        }), 400
    connection = get_connection()
    try:
        post = connection.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if post is None:
            return jsonify({
                "status": "error",
                "message": "Post not found.",
            }), 404
        if post["user_id"] != user_id:
            return jsonify({
                "status": "error",
                "message": "You can only edit your own posts.",
            }), 403
        connection.execute(
            "UPDATE posts SET content = ? WHERE id = ?",
            (content, post_id),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Post updated successfully!",
            "post": {
                "id": post_id,
                "content": content,
            },
        }), 200
    except Exception:
        connection.rollback()
        app.logger.exception("Editing post failed")
        return jsonify({
            "status": "error",
            "message": "Unable to update the post.",
        }), 500
    finally:
        connection.close()
# =========================================================
# DELETE POST - OWNER ONLY
# =========================================================
@app.route("/api/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        post = connection.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if post is None:
            return jsonify({
                "status": "error",
                "message": "Post not found.",
            }), 404
        if post["user_id"] != user_id:
            return jsonify({
                "status": "error",
                "message": "You can only delete your own posts.",
            }), 403
        connection.execute(
            "DELETE FROM posts WHERE id = ?",
            (post_id,),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Post deleted successfully!",
        }), 200
    except Exception:
        connection.rollback()
        app.logger.exception("Deleting post failed")
        return jsonify({
            "status": "error",
            "message": "Unable to delete the post.",
        }), 500
    finally:
        connection.close()
# =========================================================
# LIKE / UNLIKE POST
# =========================================================
@app.route("/api/posts/<int:post_id>/like", methods=["POST"])
def toggle_like(post_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        post = connection.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if post is None:
            return jsonify({
                "status": "error",
                "message": "Post not found.",
            }), 404
        existing_like = connection.execute(
            """
            SELECT id
            FROM likes
            WHERE post_id = ? AND user_id = ?
            """,
            (post_id, user_id),
        ).fetchone()
        if existing_like:
            connection.execute(
                """
                DELETE FROM likes
                WHERE post_id = ? AND user_id = ?
                """,
                (post_id, user_id),
            )
            liked = False
        else:
            connection.execute(
                """
                INSERT INTO likes (post_id, user_id)
                VALUES (?, ?)
                """,
                (post_id, user_id),
            )
            liked = True
            if post["user_id"] != user_id:
                connection.execute(
                    """
                    INSERT INTO notifications
                        (recipient_id, actor_id, post_id, type)
                    VALUES (?, ?, ?, 'like')
                    """,
                    (post["user_id"], user_id, post_id),
                )
        connection.commit()
        like_count = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM likes
            WHERE post_id = ?
            """,
            (post_id,),
        ).fetchone()["total"]
        return jsonify({
            "status": "success",
            "liked": liked,
            "likeCount": like_count,
            "message": "Like updated successfully.",
        }), 200
    except Exception:
        connection.rollback()
        app.logger.exception("Updating post like failed")
        return jsonify({
            "status": "error",
            "message": "Unable to update the like.",
        }), 500
    finally:
        connection.close()
# =========================================================
# GET COMMENTS
# =========================================================
@app.route("/api/posts/<int:post_id>/comments", methods=["GET"])
def get_comments(post_id):
    connection = get_connection()
    try:
        post = connection.execute(
            "SELECT id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if post is None:
            return jsonify({
                "status": "error",
                "message": "Post not found.",
            }), 404
        rows = connection.execute(
            """
            SELECT comments.id, comments.post_id, comments.user_id,
                   comments.content, comments.created_at,
                   users.full_name
            FROM comments
            JOIN users ON users.id = comments.user_id
            WHERE comments.post_id = ?
            ORDER BY comments.id ASC
            LIMIT 100
            """,
            (post_id,),
        ).fetchall()
        comments = [
            {
                "id": row["id"],
                "postId": row["post_id"],
                "userId": row["user_id"],
                "author": row["full_name"],
                "content": row["content"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "comments": comments,
        }), 200
    finally:
        connection.close()
# =========================================================
# CREATE COMMENT
# =========================================================
@app.route("/api/posts/<int:post_id>/comments", methods=["POST"])
def create_comment(post_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    content = data.get("content", "")
    if not isinstance(content, str):
        return jsonify({
            "status": "error",
            "message": "Comment must be text.",
        }), 400
    content = content.strip()
    if not content or len(content) > 1000:
        return jsonify({
            "status": "error",
            "message": "Comment must be between 1 and 1000 characters.",
        }), 400
    connection = get_connection()
    try:
        post = connection.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if post is None:
            return jsonify({
                "status": "error",
                "message": "Post not found.",
            }), 404
        cursor = connection.execute(
            """
            INSERT INTO comments (post_id, user_id, content)
            VALUES (?, ?, ?)
            """,
            (post_id, user_id, content),
        )
        comment_id = cursor.lastrowid
        if post["user_id"] != user_id:
            connection.execute(
                """
                INSERT INTO notifications
                    (recipient_id, actor_id, post_id, type)
                VALUES (?, ?, ?, 'comment')
                """,
                (post["user_id"], user_id, post_id),
            )
        connection.commit()
        row = connection.execute(
            """
            SELECT comments.id, comments.post_id, comments.user_id,
                   comments.content, comments.created_at,
                   users.full_name
            FROM comments
            JOIN users ON users.id = comments.user_id
            WHERE comments.id = ?
            """,
            (comment_id,),
        ).fetchone()
        return jsonify({
            "status": "success",
            "message": "Comment added successfully!",
            "comment": {
                "id": row["id"],
                "postId": row["post_id"],
                "userId": row["user_id"],
                "author": row["full_name"],
                "content": row["content"],
                "createdAt": row["created_at"],
            },
        }), 201
    except Exception:
        connection.rollback()
        app.logger.exception("Creating comment failed")
        return jsonify({
            "status": "error",
            "message": "Unable to add the comment.",
        }), 500
    finally:
        connection.close()
# =========================================================
# GET NOTIFICATIONS
# =========================================================
@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
                n.id,
                n.type,
                n.is_read,
                n.created_at,
                n.post_id,
                actor.full_name AS actor_name,
                p.content AS post_content
            FROM notifications n
            JOIN users actor ON actor.id = n.actor_id
            JOIN posts p ON p.id = n.post_id
            WHERE n.recipient_id = ?
            ORDER BY n.id DESC
            LIMIT 50
            """,
            (user_id,),
        ).fetchall()
        unread_count = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM notifications
            WHERE recipient_id = ? AND is_read = 0
            """,
            (user_id,),
        ).fetchone()["total"]
        notifications = [
            {
                "id": row["id"],
                "type": row["type"],
                "isRead": bool(row["is_read"]),
                "createdAt": row["created_at"],
                "postId": row["post_id"],
                "actorName": row["actor_name"],
                "postContent": row["post_content"],
                "message": (
                    f"{row['actor_name']} liked your post."
                    if row["type"] == "like"
                    else f"{row['actor_name']} commented on your post."
                ),
            }
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "notifications": notifications,
            "unreadCount": unread_count,
        }), 200
    finally:
        connection.close()
# =========================================================
# MARK ONE NOTIFICATION AS READ
# =========================================================
@app.route(
    "/api/notifications/<int:notification_id>/read",
    methods=["PUT"],
)
def mark_notification_read(notification_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND recipient_id = ?
            """,
            (notification_id, user_id),
        )
        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({
                "status": "error",
                "message": "Notification not found.",
            }), 404
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Notification marked as read.",
        }), 200
    except Exception:
        connection.rollback()
        app.logger.exception("Marking notification read failed")
        return jsonify({
            "status": "error",
            "message": "Unable to update notification.",
        }), 500
    finally:
        connection.close()
# =========================================================
# MARK ALL NOTIFICATIONS AS READ
# =========================================================
@app.route("/api/notifications/read-all", methods=["PUT"])
def mark_all_notifications_read():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        connection.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE recipient_id = ? AND is_read = 0
            """,
            (user_id,),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "All notifications marked as read.",
        }), 200
    except Exception:
        connection.rollback()
        app.logger.exception("Marking all notifications read failed")
        return jsonify({
            "status": "error",
            "message": "Unable to update notifications.",
        }), 500
    finally:
        connection.close()
# =========================================================
# DISCOVER PEOPLE
# =========================================================
@app.route("/api/users/discover", methods=["GET"])
def discover_users():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
                u.id,
                u.full_name,
                u.bio,
                u.skills,
                u.interests,
                c.id AS connection_id,
                c.status AS connection_status,
                c.requester_id,
                c.receiver_id
            FROM users u
            LEFT JOIN connections c ON (
                (c.requester_id = ? AND c.receiver_id = u.id)
                OR
                (c.requester_id = u.id AND c.receiver_id = ?)
            )
            WHERE u.id != ?
            ORDER BY LOWER(u.full_name)
            LIMIT 100
            """,
            (user_id, user_id, user_id),
        ).fetchall()
        users = []
        for row in rows:
            status = row["connection_status"]
            direction = None
            if status == "pending":
                direction = (
                    "sent"
                    if row["requester_id"] == user_id
                    else "received"
                )
            users.append({
                "id": row["id"],
                "fullName": row["full_name"],
                "bio": row["bio"],
                "skills": row["skills"],
                "interests": row["interests"],
                "connectionId": row["connection_id"],
                "connectionStatus": status or "none",
                "requestDirection": direction,
            })
        return jsonify({
            "status": "success",
            "users": users,
        }), 200
    finally:
        connection.close()
# =========================================================
# SEND A CONNECTION REQUEST
# =========================================================
@app.route("/api/connections/request", methods=["POST"])
def send_connection_request():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    receiver_id = data.get("receiverId")
    if (
        not isinstance(receiver_id, int)
        or isinstance(receiver_id, bool)
        or receiver_id <= 0
    ):
        return jsonify({
            "status": "error",
            "message": "A valid receiverId is required.",
        }), 400
    if receiver_id == user_id:
        return jsonify({
            "status": "error",
            "message": "You cannot send a request to yourself.",
        }), 400
    connection = get_connection()
    try:
        receiver = connection.execute(
            "SELECT id FROM users WHERE id = ?",
            (receiver_id,),
        ).fetchone()
        if receiver is None:
            return jsonify({
                "status": "error",
                "message": "User not found.",
            }), 404
        existing = connection.execute(
            """
            SELECT id, requester_id, receiver_id, status
            FROM connections
            WHERE (requester_id = ? AND receiver_id = ?)
               OR (requester_id = ? AND receiver_id = ?)
            LIMIT 1
            """,
            (user_id, receiver_id, receiver_id, user_id),
        ).fetchone()
        if existing:
            if existing["status"] == "accepted":
                return jsonify({
                    "status": "error",
                    "message": "You are already connected.",
                }), 409
            if existing["status"] == "pending":
                if existing["requester_id"] == user_id:
                    message = "You have already sent this request."
                else:
                    message = (
                        "This user has already sent you a request. "
                        "Check your received requests."
                    )
                return jsonify({
                    "status": "error",
                    "message": message,
                }), 409
            connection.execute(
                """
                UPDATE connections
                SET requester_id = ?,
                    receiver_id = ?,
                    status = 'pending',
                    created_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (user_id, receiver_id, existing["id"]),
            )
            connection.commit()
            return jsonify({
                "status": "success",
                "message": "Connection request sent!",
            }), 200
        cursor = connection.execute(
            """
            INSERT INTO connections (requester_id, receiver_id)
            VALUES (?, ?)
            """,
            (user_id, receiver_id),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Connection request sent!",
            "connectionId": cursor.lastrowid,
        }), 201
    except sqlite3.IntegrityError:
        connection.rollback()
        return jsonify({
            "status": "error",
            "message": "This connection request already exists.",
        }), 409
    except Exception:
        connection.rollback()
        app.logger.exception("Sending connection request failed")
        return jsonify({
            "status": "error",
            "message": "Unable to send the connection request.",
        }), 500
    finally:
        connection.close()
# =========================================================
# VIEW RECEIVED CONNECTION REQUESTS
# =========================================================
@app.route("/api/connections/requests", methods=["GET"])
def get_connection_requests():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
                c.id AS connection_id,
                c.created_at,
                u.id AS user_id,
                u.full_name,
                u.bio,
                u.skills,
                u.interests
            FROM connections c
            JOIN users u ON u.id = c.requester_id
            WHERE c.receiver_id = ?
              AND c.status = 'pending'
            ORDER BY c.id DESC
            """,
            (user_id,),
        ).fetchall()
        requests_list = [
            {
                "connectionId": row["connection_id"],
                "userId": row["user_id"],
                "fullName": row["full_name"],
                "bio": row["bio"],
                "skills": row["skills"],
                "interests": row["interests"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "requests": requests_list,
        }), 200
    finally:
        connection.close()
# =========================================================
# ACCEPT OR REJECT A RECEIVED REQUEST
# =========================================================
@app.route(
    "/api/connections/<int:connection_id>/respond",
    methods=["PUT"],
)
def respond_to_connection_request(connection_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    action = data.get("action")
    if action not in ("accept", "reject"):
        return jsonify({
            "status": "error",
            "message": "Action must be 'accept' or 'reject'.",
        }), 400
    new_status = "accepted" if action == "accept" else "rejected"
    connection = get_connection()
    try:
        request_row = connection.execute(
            """
            SELECT id
            FROM connections
            WHERE id = ?
              AND receiver_id = ?
              AND status = 'pending'
            """,
            (connection_id, user_id),
        ).fetchone()
        if request_row is None:
            return jsonify({
                "status": "error",
                "message": "Pending connection request not found.",
            }), 404
        connection.execute(
            """
            UPDATE connections
            SET status = ?
            WHERE id = ?
            """,
            (new_status, connection_id),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": (
                "Connection request accepted!"
                if action == "accept"
                else "Connection request rejected."
            ),
            "connectionStatus": new_status,
        }), 200
    except Exception:
        connection.rollback()
        app.logger.exception("Responding to connection request failed")
        return jsonify({
            "status": "error",
            "message": "Unable to process the connection request.",
        }), 500
    finally:
        connection.close()
# =========================================================
# VIEW ACCEPTED CONNECTIONS + UNREAD MESSAGE COUNTS
# =========================================================
@app.route("/api/connections", methods=["GET"])
def get_connections():
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
                c.id AS connection_id,
                c.created_at,
                u.id AS user_id,
                u.full_name,
                u.bio,
                u.skills,
                u.interests,
                (
                    SELECT COUNT(*)
                    FROM messages m
                    WHERE m.sender_id = u.id
                      AND m.receiver_id = ?
                      AND m.is_read = 0
                ) AS unread_count
            FROM connections c
            JOIN users u ON u.id = CASE
                WHEN c.requester_id = ? THEN c.receiver_id
                ELSE c.requester_id
            END
            WHERE c.status = 'accepted'
              AND (c.requester_id = ? OR c.receiver_id = ?)
            ORDER BY LOWER(u.full_name)
            """,
            (user_id, user_id, user_id, user_id),
        ).fetchall()
        connections_list = [
            {
                "connectionId": row["connection_id"],
                "userId": row["user_id"],
                "fullName": row["full_name"],
                "bio": row["bio"],
                "skills": row["skills"],
                "interests": row["interests"],
                "connectedAt": row["created_at"],
                "unreadCount": row["unread_count"],
            }
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "connections": connections_list,
        }), 200
    except Exception:
        app.logger.exception("Loading connections failed")
        return jsonify({
            "status": "error",
            "message": "Unable to load connections.",
        }), 500
    finally:
        connection.close()
# =========================================================
# PRIVATE MESSAGING
# =========================================================
def accepted_connection_exists(conn, user_id, other_user_id):
    """Return True only when the two users have an accepted connection."""
    result = conn.execute(
        """
        SELECT 1
        FROM connections
        WHERE status = 'accepted'
          AND (
              (requester_id = ? AND receiver_id = ?)
              OR
              (requester_id = ? AND receiver_id = ?)
          )
        LIMIT 1
        """,
        (user_id, other_user_id, other_user_id, user_id),
    ).fetchone()
    return result is not None
@app.route("/api/messages/<int:other_user_id>", methods=["GET"])
def get_private_messages(other_user_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    if user_id == other_user_id:
        return jsonify({
            "status": "error",
            "message": "You cannot message yourself.",
        }), 400
    conn = get_connection()
    try:
        if not accepted_connection_exists(conn, user_id, other_user_id):
            return jsonify({
                "status": "error",
                "message": "Messaging requires an accepted connection.",
            }), 403
        # Mark incoming messages from the selected person as read.
        conn.execute(
            """
            UPDATE messages
            SET is_read = 1
            WHERE sender_id = ?
              AND receiver_id = ?
              AND is_read = 0
            """,
            (other_user_id, user_id),
        )
        conn.commit()
        rows = conn.execute(
            """
            SELECT id, sender_id, receiver_id, content, created_at, is_read
            FROM messages
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY id ASC
            """,
            (user_id, other_user_id, other_user_id, user_id),
        ).fetchall()
        messages = [
            {
                "id": row["id"],
                "senderId": row["sender_id"],
                "receiverId": row["receiver_id"],
                "content": row["content"],
                "createdAt": row["created_at"],
                "isRead": bool(row["is_read"]),
            }
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "messages": messages,
        }), 200
    except Exception:
        conn.rollback()
        app.logger.exception("Loading messages failed")
        return jsonify({
            "status": "error",
            "message": "Unable to load messages.",
        }), 500
    finally:
        conn.close()
@app.route("/api/messages/<int:other_user_id>", methods=["POST"])
def send_private_message(other_user_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    if user_id == other_user_id:
        return jsonify({
            "status": "error",
            "message": "You cannot message yourself.",
        }), 400
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Please send valid JSON data.",
        }), 400
    content = data.get("content")
    if not isinstance(content, str) or not content.strip():
        return jsonify({
            "status": "error",
            "message": "Please enter a message.",
        }), 400
    content = content.strip()
    if len(content) > 2000:
        return jsonify({
            "status": "error",
            "message": "Messages cannot exceed 2000 characters.",
        }), 400
    conn = get_connection()
    try:
        if not accepted_connection_exists(conn, user_id, other_user_id):
            return jsonify({
                "status": "error",
                "message": "Messaging requires an accepted connection.",
            }), 403
        cursor = conn.execute(
            """
            INSERT INTO messages (sender_id, receiver_id, content)
            VALUES (?, ?, ?)
            """,
            (user_id, other_user_id, content),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, sender_id, receiver_id, content, created_at, is_read
            FROM messages
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        return jsonify({
            "status": "success",
            "message": {
                "id": row["id"],
                "senderId": row["sender_id"],
                "receiverId": row["receiver_id"],
                "content": row["content"],
                "createdAt": row["created_at"],
                "isRead": bool(row["is_read"]),
            },
        }), 201
    except Exception:
        conn.rollback()
        app.logger.exception("Sending message failed")
        return jsonify({
            "status": "error",
            "message": "Unable to send the message.",
        }), 500
    finally:
        conn.close()
# =========================================================
# DELETE YOUR OWN MESSAGE
# =========================================================
@app.route("/api/messages/delete/<int:message_id>", methods=["DELETE"])
def delete_private_message(message_id):
    user_id, auth_error = get_authenticated_user()
    if auth_error:
        return auth_error
    conn = get_connection()
    try:
        message = conn.execute(
            """
            SELECT id, sender_id
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
        if message is None:
            return jsonify({
                "status": "error",
                "message": "Message not found.",
            }), 404
        if message["sender_id"] != user_id:
            return jsonify({
                "status": "error",
                "message": "You can delete only your own messages.",
            }), 403
        conn.execute(
            """
            DELETE FROM messages
            WHERE id = ? AND sender_id = ?
            """,
            (message_id, user_id),
        )
        conn.commit()
        return jsonify({
            "status": "success",
            "message": "Message deleted successfully.",
        }), 200
    except Exception:
        conn.rollback()
        app.logger.exception("Deleting private message failed")
        return jsonify({
            "status": "error",
            "message": "Unable to delete the message.",
        }), 500
    finally:
        conn.close()
# =========================================================
# START DEVELOPMENT SERVER
# =========================================================
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False
    )