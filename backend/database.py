
import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent / "connecthub.db"


def get_connection():
    """Open a connection to the ConnectHub database."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    """Create all ConnectHub tables without deleting existing data."""
    connection = get_connection()

    try:
        # Users and profiles
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                bio TEXT NOT NULL DEFAULT '',
                skills TEXT NOT NULL DEFAULT '',
                interests TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Add profile fields if the database was created using an older schema.
        existing_columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(users)"
            ).fetchall()
        }

        profile_columns = {
            "bio": "TEXT NOT NULL DEFAULT ''",
            "skills": "TEXT NOT NULL DEFAULT ''",
            "interests": "TEXT NOT NULL DEFAULT ''",
        }

        for column_name, column_type in profile_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    f"ALTER TABLE users ADD COLUMN "
                    f"{column_name} {column_type}"
                )

        # Posts
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL
                    CHECK(length(trim(content)) > 0),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id)
                    REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        # Likes
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(post_id, user_id),
                FOREIGN KEY (post_id)
                    REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id)
                    REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        # Comments
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL
                    CHECK(length(trim(content)) > 0),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id)
                    REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id)
                    REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        # Notifications
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_id INTEGER NOT NULL,
                actor_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                type TEXT NOT NULL
                    CHECK(type IN ('like', 'comment')),
                is_read INTEGER NOT NULL DEFAULT 0
                    CHECK(is_read IN (0, 1)),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (recipient_id)
                    REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (actor_id)
                    REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id)
                    REFERENCES posts(id) ON DELETE CASCADE
            )
            """
        )

        # Connection requests between ConnectHub users
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'accepted', 'rejected')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(requester_id, receiver_id),
                CHECK(requester_id <> receiver_id),
                FOREIGN KEY (requester_id)
                    REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id)
                    REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        # Indexes
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_posts_created_at
            ON posts(created_at)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_likes_post_id
            ON likes(post_id)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_comments_post_id
            ON comments(post_id)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_notifications_recipient
            ON notifications(recipient_id, is_read, created_at)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_connections_receiver_status
            ON connections(receiver_id, status)
            """
        )

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


if __name__ == "__main__":
    initialize_database()
    print("ConnectHub database is ready!")
    print(f"Database location: {DATABASE_PATH}")
    print("Users table is ready.")
    print("Posts table is ready.")
    print("Likes table is ready.")
    print("Comments table is ready.")
    print("Notifications table is ready.")
    print("Connections table is ready.")


def initialize_messages_table():
    """Create or upgrade the private messages table."""
    conn = get_connection()

    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                content TEXT NOT NULL
                    CHECK (length(trim(content)) > 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                is_read INTEGER NOT NULL DEFAULT 0
                    CHECK (is_read IN (0, 1)),
                FOREIGN KEY (sender_id)
                    REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id)
                    REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Upgrade existing databases without deleting messages.
        columns = {
            row[1]
            for row in conn.execute(
                "PRAGMA table_info(messages)"
            ).fetchall()
        }

        if "is_read" not in columns:
            conn.execute("""
                ALTER TABLE messages
                ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0
            """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver
            ON messages(sender_id, receiver_id, id)
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender
            ON messages(receiver_id, sender_id, id)
        """)

        conn.commit()
        print("Messages table and read status are ready!")

    finally:
        conn.close()


def initialize_profile_picture_column():
    """Safely add profile-picture support to existing user accounts."""
    conn = get_connection()

    try:
        columns = {
            row[1]
            for row in conn.execute(
                "PRAGMA table_info(users)"
            ).fetchall()
        }

        if "profile_picture" not in columns:
            conn.execute("""
                ALTER TABLE users
                ADD COLUMN profile_picture TEXT
            """)

        conn.commit()
        print("Profile-picture database support is ready!")

    finally:
        conn.close()
