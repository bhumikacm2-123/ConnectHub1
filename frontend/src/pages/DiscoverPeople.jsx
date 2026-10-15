
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "https://connecthub1.onrender.com";

function DiscoverPeople() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyUsers, setBusyUsers] = useState({});

  const token = sessionStorage.getItem("connecthub_token");

  useEffect(() => {
    async function loadUsers() {
      const savedToken = sessionStorage.getItem("connecthub_token");

      if (!savedToken) {
        setError("Please log in to discover people.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/users/discover`,
          {
            headers: {
              Authorization: `Bearer ${savedToken}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to discover users."
          );
        }

        setUsers(data.users || []);
      } catch (err) {
        setError(err.message || "Could not load members.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  async function handleConnect(user) {
    const savedToken = sessionStorage.getItem("connecthub_token");

    if (!savedToken) {
      setError("Please log in before sending a connection request.");
      return;
    }

    setError("");
    setMessage("");

    setBusyUsers((previous) => ({
      ...previous,
      [user.id]: true,
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/connections/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${savedToken}`,
          },
          body: JSON.stringify({
            receiverId: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to send connection request."
        );
      }

      setUsers((previous) =>
        previous.map((member) =>
          member.id === user.id
            ? {
                ...member,
                connectionStatus: "pending",
                requestDirection: "sent",
              }
            : member
        )
      );

      setMessage(`Connection request sent to ${user.fullName}.`);
    } catch (err) {
      setError(err.message || "Could not send the request.");
    } finally {
      setBusyUsers((previous) => ({
        ...previous,
        [user.id]: false,
      }));
    }
  }

  function getAction(user) {
    if (user.connectionStatus === "accepted") {
      return (
        <button
          className="connect-button connected-button"
          type="button"
          disabled
        >
          ✓ Connected
        </button>
      );
    }

    if (
      user.connectionStatus === "pending" &&
      user.requestDirection === "sent"
    ) {
      return (
        <button
          className="connect-button pending-button"
          type="button"
          disabled
        >
          Request sent
        </button>
      );
    }

    if (
      user.connectionStatus === "pending" &&
      user.requestDirection === "received"
    ) {
      return (
        <span className="request-received-label">
          Request received
        </span>
      );
    }

    return (
      <button
        className="button connect-button"
        type="button"
        onClick={() => handleConnect(user)}
        disabled={Boolean(busyUsers[user.id])}
      >
        {busyUsers[user.id]
          ? "Sending..."
          : user.connectionStatus === "rejected"
            ? "Connect again"
            : "+ Connect"}
      </button>
    );
  }

  if (!token) {
    return (
      <main className="discover-page">
        <Link className="brand" to="/">
          <span className="brand-icon">C</span>
          <span>ConnectHub</span>
        </Link>

        <section className="discover-empty">
          <h1>Discover your community</h1>
          <p>Log in to find and connect with other members.</p>
          <Link className="button" to="/login">
            Log in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="discover-page">
      <header className="discover-header">
        <Link className="brand" to="/">
          <span className="brand-icon">C</span>
          <span>ConnectHub</span>
        </Link>

        <Link className="secondary-button" to="/">
          ← Back to Home
        </Link>
      </header>

      <section className="discover-hero">
        <span className="eyebrow">GROW YOUR NETWORK</span>
        <h1>Discover people.</h1>
        <p>
          Meet learners, developers, and creators who share your
          interests. Great collaborations start with a connection.
        </p>
      </section>

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

      <section className="discover-results">
        <div className="discover-results-heading">
          <h2>Community members</h2>
          <span>{users.length} members</span>
        </div>

        {loading ? (
          <div className="discover-empty">
            Loading members...
          </div>
        ) : users.length === 0 ? (
          <div className="discover-empty">
            <span className="discover-empty-icon">🌱</span>
            <h3>Your community is just getting started.</h3>
            <p>
              There are no other registered members to show yet.
              Invite a friend to join ConnectHub!
            </p>
          </div>
        ) : (
          <div className="discover-grid">
            {users.map((user) => (
              <article
                className="discover-card"
                key={user.id}
              >
                <div className="discover-avatar">
                  {(user.fullName || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <h3>{user.fullName}</h3>

                <p className="discover-bio">
                  {user.bio || "Connect and introduce yourself!"}
                </p>

                {user.skills && (
                  <div className="discover-detail">
                    <strong>Skills</strong>
                    <p>{user.skills}</p>
                  </div>
                )}

                {user.interests && (
                  <div className="discover-detail">
                    <strong>Interests</strong>
                    <p>{user.interests}</p>
                  </div>
                )}

                <div className="discover-card-footer">
                  {getAction(user)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default DiscoverPeople;
