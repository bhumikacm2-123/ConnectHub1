
import React, { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import DiscoverPeople from "./pages/DiscoverPeople";
import Connections from "./pages/Connections";
import Messages from "./pages/Messages";

import BackendStatus from "./components/BackendStatus";
import PostFeed from "./components/PostFeed";
import NotificationBell from "./components/NotificationBell";

import "./App.css";

const API_BASE = "http://127.0.0.1:5000";

function getSavedUser() {
  try {
    const savedUser = sessionStorage.getItem("connecthub_user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch (error) {
    console.error("Could not read saved user:", error);
    return null;
  }
}

function hasSession() {
  return Boolean(sessionStorage.getItem("connecthub_token"));
}

// Protect pages that require login.
function ProtectedRoute({ children }) {
  if (!hasSession()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Redirect logged-in users away from Login and Sign Up.
function PublicOnlyRoute({ children }) {
  return hasSession() ? <Navigate to="/" replace /> : children;
}

// =====================================================
// NAVIGATION BAR
// =====================================================

function Navbar({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setUser(hasSession() ? getSavedUser() : null);
    setMobileMenuOpen(false);
  }, [location.pathname, location.key, setUser]);

  // Load unread-message count.
  useEffect(() => {
    let active = true;

    async function loadUnreadMessages() {
      const token = sessionStorage.getItem("connecthub_token");

      if (!token) {
        if (active) setUnreadMessages(0);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/connections`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401 && active) {
            setUnreadMessages(0);
          }
          return;
        }

        const data = await response.json();

        const total = Array.isArray(data.connections)
          ? data.connections.reduce(
              (sum, item) =>
                sum + Math.max(
                  0,
                  Number(item.unreadCount) || 0
                ),
              0
            )
          : 0;

        if (active) setUnreadMessages(total);
      } catch (error) {
        console.error(
          "Could not load unread messages:",
          error
        );
      }
    }

    loadUnreadMessages();

    const intervalId = window.setInterval(
      loadUnreadMessages,
      4000
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user, location.pathname, location.key]);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function handleLogout() {
    sessionStorage.removeItem("connecthub_token");
    sessionStorage.removeItem("connecthub_user");

    setUnreadMessages(0);
    setUser(null);
    closeMobileMenu();

    navigate("/login", { replace: true });
  }

  const navLinkStyle = {
    color: "#334155",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "14px",
    whiteSpace: "nowrap",
  };

  const primaryButtonStyle = {
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    background: "#4f46e5",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "14px",
    whiteSpace: "nowrap",
  };

  return (
    <header className="connecthub-header">
      <style>{`
        .connecthub-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(255,255,255,.97);
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 2px 12px rgba(15,23,42,.04);
        }

        .connecthub-nav {
          max-width: 1250px;
          min-height: 72px;
          margin: 0 auto;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .connecthub-nav-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 17px;
          flex-wrap: wrap;
        }

        .connecthub-mobile-menu-button {
          display: none;
        }

        .connecthub-nav a:hover {
          color: #4f46e5;
        }

        .connecthub-nav a:focus-visible,
        .connecthub-nav button:focus-visible {
          outline: 3px solid #818cf8;
          outline-offset: 3px;
        }

        @media (max-width: 940px) {
          .connecthub-mobile-menu-button {
            display: inline-flex !important;
          }

          .connecthub-nav-links {
            display: none;
            width: 100%;
            flex-direction: column;
            align-items: flex-start;
            padding: 12px 0;
          }

          .connecthub-nav-links.is-open {
            display: flex;
          }
        }
      `}</style>

      <nav className="connecthub-nav" aria-label="Main navigation">
        <Link
          to="/"
          onClick={closeMobileMenu}
          style={{
            textDecoration: "none",
            color: "#312e81",
            fontSize: "23px",
            fontWeight: 800,
          }}
        >
          Connect<span style={{ color: "#4f46e5" }}>Hub</span>
        </Link>

        <button
          type="button"
          className="connecthub-mobile-menu-button"
          aria-expanded={mobileMenuOpen}
          aria-controls="connecthub-nav-links"
          onClick={() =>
            setMobileMenuOpen((open) => !open)
          }
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "9px",
            padding: "8px 12px",
            background: "#ffffff",
            color: "#334155",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {mobileMenuOpen ? "Close ✕" : "Menu ☰"}
        </button>

        <div
          id="connecthub-nav-links"
          className={`connecthub-nav-links${
            mobileMenuOpen ? " is-open" : ""
          }`}
        >
          <Link
            to="/"
            style={navLinkStyle}
            onClick={closeMobileMenu}
          >
            Home
          </Link>

          <Link
            to="/#communities"
            style={navLinkStyle}
            onClick={closeMobileMenu}
          >
            Communities
          </Link>

          <Link
            to="/#opportunities"
            style={navLinkStyle}
            onClick={closeMobileMenu}
          >
            Opportunities
          </Link>

          <Link
            to="/#community-feed"
            style={navLinkStyle}
            onClick={closeMobileMenu}
          >
            Community Feed
          </Link>

          {user ? (
            <>
              <Link
                to="/discover"
                style={navLinkStyle}
                onClick={closeMobileMenu}
              >
                Discover People
              </Link>

              <Link
                to="/connections"
                style={navLinkStyle}
                onClick={closeMobileMenu}
              >
                My Connections
              </Link>

              <Link
                to="/messages"
                style={{
                  ...navLinkStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onClick={closeMobileMenu}
              >
                Messages

                {unreadMessages > 0 && (
                  <span
                    aria-label={`${unreadMessages} unread messages`}
                    style={{
                      minWidth: "21px",
                      height: "21px",
                      padding: "0 5px",
                      borderRadius: "999px",
                      background: "#dc2626",
                      color: "#ffffff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 800,
                    }}
                  >
                    {unreadMessages > 99
                      ? "99+"
                      : unreadMessages}
                  </span>
                )}
              </Link>

              <Link
                to="/profile"
                style={navLinkStyle}
                onClick={closeMobileMenu}
              >
                My Profile
              </Link>

              <span onClick={closeMobileMenu}>
                <NotificationBell />
              </span>

              <span
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  whiteSpace: "nowrap",
                }}
              >
                Hi, {user.fullName || user.name || "there"}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                style={primaryButtonStyle}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                style={navLinkStyle}
                onClick={closeMobileMenu}
              >
                Login
              </Link>

              <Link
                to="/signup"
                style={primaryButtonStyle}
                onClick={closeMobileMenu}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// =====================================================
// HOME PAGE CONTENT
// =====================================================

const communityCards = [
  {
    icon: "💻",
    title: "Technology & Coding",
    description:
      "Learn programming, share projects, and grow together.",
  },
  {
    icon: "📊",
    title: "Data Science",
    description:
      "Explore analytics, AI, machine learning, and new ideas.",
  },
  {
    icon: "🎓",
    title: "Student Community",
    description:
      "Connect with students, exchange notes, and prepare together.",
  },
];

const opportunityCards = [
  {
    icon: "🚀",
    title: "Internship Preparation",
    description:
      "Share learning resources and prepare for upcoming roles.",
  },
  {
    icon: "🤝",
    title: "Project Collaboration",
    description:
      "Meet people with similar interests and build useful projects.",
  },
  {
    icon: "🌱",
    title: "Career Discussions",
    description:
      "Exchange interview tips and professional experiences.",
  },
];

function Home() {
  return (
    <main style={{ background: "#f7f8ff", minHeight: "100vh" }}>
      {/* Hero section */}
      <section
        style={{
          background:
            "linear-gradient(135deg,#eef2ff 0%,#f5f3ff 48%,#ffffff 100%)",
          padding: "70px 20px 64px",
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(280px,1fr))",
            alignItems: "center",
            gap: "42px",
          }}
        >
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "999px",
                background: "#e0e7ff",
                color: "#4338ca",
                fontWeight: 700,
                fontSize: "13px",
                marginBottom: "18px",
              }}
            >
              Learn • Connect • Build
            </span>

            <h1
              style={{
                color: "#1e1b4b",
                fontSize: "clamp(36px,5vw,58px)",
                lineHeight: 1.1,
                letterSpacing: "-1.6px",
                margin: "0 0 20px",
              }}
            >
              Your community. Your ideas. Your future.
            </h1>

            <p
              style={{
                color: "#475569",
                fontSize: "18px",
                lineHeight: 1.75,
                maxWidth: "620px",
                marginBottom: "28px",
              }}
            >
              ConnectHub brings students and curious minds
              together to share knowledge, discover opportunities,
              collaborate on projects, and build meaningful
              connections.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                to="/discover"
                style={{
                  textDecoration: "none",
                  borderRadius: "12px",
                  padding: "13px 18px",
                  fontWeight: 700,
                  fontSize: "14px",
                  background: "#4f46e5",
                  color: "#ffffff",
                }}
              >
                Discover People
              </Link>

              <Link
                to="/#community-feed"
                style={{
                  textDecoration: "none",
                  borderRadius: "12px",
                  padding: "13px 18px",
                  fontWeight: 700,
                  fontSize: "14px",
                  background: "#ffffff",
                  color: "#4338ca",
                  border: "1px solid #c7d2fe",
                }}
              >
                Explore Community Feed
              </Link>
            </div>
          </div>

          <div
            style={{
              minHeight: "300px",
              borderRadius: "28px",
              background: "linear-gradient(145deg,#4f46e5,#7c3aed)",
              color: "#ffffff",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              boxShadow: "0 24px 60px rgba(79,70,229,0.22)",
            }}
          >
            <div style={{ fontSize: "60px", marginBottom: "14px" }}>
              🌐
            </div>

            <h2 style={{ margin: "0 0 12px", fontSize: "30px" }}>
              Great things happen together.
            </h2>

            <p style={{ color: "#e0e7ff", lineHeight: 1.7 }}>
              Find your people, share what you know, and turn
              your ideas into real projects.
            </p>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "24px" }}>
              {["Collaborate", "Learn", "Grow"].map((label) => (
                <span
                  key={label}
                  style={{
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.12)",
                    borderRadius: "999px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Communities */}
      <section
        id="communities"
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          padding: "58px 20px",
        }}
      >
        <p style={eyebrowStyle}>FIND YOUR COMMUNITY</p>
        <h2 style={sectionTitleStyle}>Explore communities</h2>
        <p style={sectionDescriptionStyle}>
          Join conversations around subjects and goals that matter to you.
        </p>

        <div style={gridStyle}>
          {communityCards.map((item) => (
            <article key={item.title} style={cardStyle}>
              <div style={{ fontSize: "34px", marginBottom: "16px" }}>
                {item.icon}
              </div>
              <h3 style={{ color: "#1e293b", margin: "0 0 10px" }}>
                {item.title}
              </h3>
              <p style={cardDescriptionStyle}>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Opportunities */}
      <section
        id="opportunities"
        style={{ background: "#ffffff", padding: "58px 20px" }}
      >
        <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
          <p style={eyebrowStyle}>GROW TOGETHER</p>
          <h2 style={sectionTitleStyle}>
            Opportunities to move forward
          </h2>
          <p style={sectionDescriptionStyle}>
            Find people to learn with, practise with, and create with.
          </p>

          <div style={gridStyle}>
            {opportunityCards.map((item) => (
              <article
                key={item.title}
                style={{ ...cardStyle, background: "#fafaff" }}
              >
                <div style={{ fontSize: "32px", marginBottom: "14px" }}>
                  {item.icon}
                </div>
                <h3 style={{ color: "#1e293b", margin: "0 0 10px" }}>
                  {item.title}
                </h3>
                <p style={cardDescriptionStyle}>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Community feed */}
      <section
        id="community-feed"
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          padding: "58px 20px",
        }}
      >
        <p style={eyebrowStyle}>WHAT THE COMMUNITY IS SHARING</p>
        <h2 style={sectionTitleStyle}>Community feed</h2>
        <p style={sectionDescriptionStyle}>
          Share an idea, ask a question, or learn from other members.
        </p>

        <div style={{ marginTop: "24px" }}>
          <BackendStatus />
        </div>

        <div style={{ marginTop: "22px" }}>
          <PostFeed />
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "26px 20px",
          background: "#1e1b4b",
          color: "#e0e7ff",
        }}
      >
        <strong>ConnectHub</strong>
        <p style={{ margin: "8px 0 0", fontSize: "13px" }}>
          Learn together. Build together. Grow together.
        </p>
      </footer>
    </main>
  );
}

// =====================================================
// SHARED STYLES
// =====================================================

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
  gap: "18px",
  marginTop: "26px",
};

const eyebrowStyle = {
  color: "#4f46e5",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "1.3px",
  margin: "0 0 10px",
};

const sectionTitleStyle = {
  color: "#1e1b4b",
  fontSize: "clamp(27px,3vw,38px)",
  letterSpacing: "-0.7px",
  margin: "0 0 12px",
};

const sectionDescriptionStyle = {
  color: "#64748b",
  lineHeight: 1.7,
  maxWidth: "650px",
  margin: 0,
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const cardDescriptionStyle = {
  color: "#64748b",
  lineHeight: 1.7,
  margin: 0,
};

// =====================================================
// MAIN APP AND ROUTES
// =====================================================

export default function App() {
  const [user, setUser] = useState(() =>
    hasSession() ? getSavedUser() : null
  );

  return (
    <>
      <Navbar user={user} setUser={setUser} />

      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <DiscoverPeople />
            </ProtectedRoute>
          }
        />

        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <Connections />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <main
              style={{
                minHeight: "60vh",
                display: "grid",
                placeItems: "center",
                padding: "24px",
                background: "#f7f8ff",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h1 style={{ color: "#312e81" }}>
                  Page not found
                </h1>
                <p style={{ color: "#64748b" }}>
                  The page you're looking for doesn't exist.
                </p>
                <Link
                  to="/"
                  style={{ color: "#4f46e5", fontWeight: 700 }}
                >
                  Return to Home
                </Link>
              </div>
            </main>
          }
        />
      </Routes>
    </>
  );
}
