
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://127.0.0.1:5000";

function Connections() {
  const [requests, setRequests] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadConnections = useCallback(async () => {
    const token = sessionStorage.getItem("connecthub_token");

    if (!token) {
      setError("Please log in to view your connections.");
      setLoading(false);
      return;
    }

    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [requestsResponse, connectionsResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/connections/requests`, { headers }),
          fetch(`${API_URL}/api/connections`, { headers }),
        ]);

      const requestsData = await requestsResponse.json();
      const connectionsData = await connectionsResponse.json();

      if (!requestsResponse.ok) {
        throw new Error(
          requestsData.message || "Could not load connection requests."
        );
      }

      if (!connectionsResponse.ok) {
        throw new Error(
          connectionsData.message || "Could not load connections."
        );
      }

      setRequests(requestsData.requests || []);
      setConnections(connectionsData.connections || []);
    } catch (err) {
      setError(err.message || "Unable to load your connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  async function respondToRequest(requestItem, action) {
    const token = sessionStorage.getItem("connecthub_token");

    if (!token) {
      setError("Please log in again.");
      return;
    }

    setBusyId(requestItem.connectionId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/connections/${requestItem.connectionId}/respond`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to process this request."
        );
      }

      setMessage(
        action === "accept"
          ? `You are now connected with ${requestItem.fullName}.`
          : `Request from ${requestItem.fullName} rejected.`
      );

      await loadConnections();
    } catch (err) {
      setError(err.message || "Could not process the request.");
    } finally {
      setBusyId(null);
    }
  }

  if (!sessionStorage.getItem("connecthub_token")) {
    return (
      <main className="connections-page">
        <Link className="brand" to="/">
          <span className="brand-icon">C</span>
          <span>ConnectHub</span>
        </Link>

        <section className="connections-empty">
          <h1>Login required</h1>
          <p>Log in to manage your connection requests.</p>
          <Link className="button" to="/login">
            Log in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="connections-page">
      <header className="connections-header">
        <Link className="brand" to="/">
          <span className="brand-icon">C</span>
          <span>ConnectHub</span>
        </Link>

        <div className="connections-nav">
          <Link className="secondary-button" to="/discover">
            Discover People
          </Link>
          <Link className="secondary-button" to="/">
            Back to Home
          </Link>
        </div>
      </header>

      <section className="connections-hero">
        <span className="eyebrow">YOUR COMMUNITY</span>
        <h1>Your Connections</h1>
        <p>
          Build meaningful relationships with learners, developers,
          and creators in the ConnectHub community.
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

      {loading ? (
        <section className="connections-empty">
          Loading your connections...
        </section>
      ) : (
        <>
          {/* Incoming requests */}
          <section className="connections-section">
            <div className="connections-section-heading">
              <h2>Connection Requests</h2>
              <span>{requests.length} pending</span>
            </div>

            {requests.length === 0 ? (
              <div className="connections-empty">
                <span className="connections-empty-icon">🤝</span>
                <h3>No pending requests</h3>
                <p>
                  When someone sends you a connection request, it
                  will appear here.
                </p>
                <Link className="button" to="/discover">
                  Discover People
                </Link>
              </div>
            ) : (
              <div className="connections-grid">
                {requests.map((requestItem) => (
                  <article
                    className="connection-card"
                    key={requestItem.connectionId}
                  >
                    <div className="connection-avatar">
                      {(requestItem.fullName || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <h3>{requestItem.fullName}</h3>

                    <p>
                      {requestItem.bio ||
                        "Would like to connect with you."}
                    </p>

                    {requestItem.skills && (
                      <div className="connection-detail">
                        <strong>Skills</strong>
                        <span>{requestItem.skills}</span>
                      </div>
                    )}

                    <div className="connection-actions">
                      <button
                        className="button"
                        type="button"
                        disabled={busyId === requestItem.connectionId}
                        onClick={() =>
                          respondToRequest(requestItem, "accept")
                        }
                      >
                        {busyId === requestItem.connectionId
                          ? "Please wait..."
                          : "✓ Accept"}
                      </button>

                      <button
                        className="reject-button"
                        type="button"
                        disabled={busyId === requestItem.connectionId}
                        onClick={() =>
                          respondToRequest(requestItem, "reject")
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Accepted connections */}
          <section className="connections-section">
            <div className="connections-section-heading">
              <h2>My Connections</h2>
              <span>{connections.length} connected</span>
            </div>

            {connections.length === 0 ? (
              <div className="connections-empty">
                <span className="connections-empty-icon">🌱</span>
                <h3>Your network starts here</h3>
                <p>
                  Find people who share your interests and connect
                  with them.
                </p>
                <Link className="button" to="/discover">
                  Find People
                </Link>
              </div>
            ) : (
              <div className="connections-grid">
                {connections.map((person) => (
                  <article
                    className="connection-card"
                    key={person.connectionId}
                  >
                    <div className="connection-avatar">
                      {(person.fullName || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <h3>{person.fullName}</h3>

                    <p>
                      {person.bio || "A member of ConnectHub."}
                    </p>

                    {person.skills && (
                      <div className="connection-detail">
                        <strong>Skills</strong>
                        <span>{person.skills}</span>
                      </div>
                    )}

                    <div className="connection-status">
                      ✓ Connected
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="connections-refresh">
            <button
              className="secondary-button"
              type="button"
              onClick={loadConnections}
              disabled={loading || busyId !== null}
            >
              Refresh connections
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default Connections;
