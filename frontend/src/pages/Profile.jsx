
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = "https://connecthub1.onrender.com";

const EMPTY_PROFILE = {
  fullName: "",
  email: "",
  bio: "",
  skills: "",
  interests: "",
  profilePicture: "",
  createdAt: "",
};

// Convert a stored filename or API path into an image URL.
function getPictureUrl(value) {
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE}${value}`;
  }

  return `${API_BASE}/api/profile/pictures/${encodeURIComponent(value)}`;
}

async function readResponse(response) {
  return response.json().catch(() => ({}));
}

export default function Profile() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const token = sessionStorage.getItem("connecthub_token");

  // Load the logged-in user's profile.
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!token) {
        setError("Please log in to view your profile.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load your profile."
          );
        }

        if (active) {
          setProfile({
            ...EMPTY_PROFILE,
            ...data.profile,
          });
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load your profile.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [token]);

  // Clean up temporary preview images.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Update profile fields.
  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Select and preview a picture.
  function handlePictureChange(event) {
    const file = event.target.files?.[0];

    setError("");
    setNotice("");

    if (!file) return;

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];

    if (!allowedExtensions.includes(extension)) {
      setError("Choose a JPG, JPEG, PNG, or WEBP picture.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setSelectedPicture(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  // Upload a profile picture to Flask.
  async function handleUploadPicture() {
    if (!selectedPicture || uploading || !token) return;

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("picture", selectedPicture);

      const response = await fetch(
        `${API_BASE}/api/profile/picture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to upload your picture."
        );
      }

      // The server returns an API path for the saved picture.
      if (data.profilePicture) {
        setProfile((previous) => ({
          ...previous,
          profilePicture: data.profilePicture,
        }));
      }

      setSelectedPicture(null);
      setPreviewUrl("");
      setNotice("Profile picture uploaded successfully!");

      // Refresh the file input so the same file can be selected again.
      const input = document.getElementById("profile-picture-input");
      if (input) input.value = "";
    } catch (err) {
      setError(err.message || "Unable to upload your picture.");
    } finally {
      setUploading(false);
    }
  }

  // Save bio, skills, and interests.
  async function handleSaveProfile(event) {
    event.preventDefault();

    if (saving || !token) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bio: profile.bio || "",
          skills: profile.skills || "",
          interests: profile.interests || "",
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update your profile."
        );
      }

      setNotice("Your profile has been updated successfully!");
    } catch (err) {
      setError(err.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "15px",
    outlineColor: "#6366f1",
    background: "#ffffff",
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "8px",
  };

  const primaryButtonStyle = {
    border: "none",
    borderRadius: "10px",
    padding: "12px 18px",
    background: "#4f46e5",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  };

  const displayPicture =
    previewUrl || getPictureUrl(profile.profilePicture);

  if (!token) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h2>Log in to view your profile</h2>
          <p>Please log in to manage your ConnectHub profile.</p>
          <Link to="/login">Go to Login</Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <p>Loading your profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Profile heading */}
        <header style={{ marginBottom: "24px" }}>
          <Link
            to="/"
            style={{
              color: "#4f46e5",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Back to ConnectHub
          </Link>

          <h1
            style={{
              marginBottom: "8px",
              marginTop: "18px",
              color: "#1e1b4b",
              fontSize: "32px",
            }}
          >
            My Profile
          </h1>

          <p style={{ color: "#64748b", margin: 0 }}>
            Manage your personal information and profile picture.
          </p>
        </header>

        {/* Status messages */}
        {error && (
          <div
            role="alert"
            style={{
              padding: "13px 16px",
              marginBottom: "18px",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: "10px",
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              padding: "13px 16px",
              marginBottom: "18px",
              background: "#dcfce7",
              color: "#166534",
              borderRadius: "10px",
            }}
          >
            {notice}
          </div>
        )}

        {/* Profile picture section */}
        <section style={{ ...cardStyle, marginBottom: "22px" }}>
          <h2 style={subheadingStyle}>Profile picture</h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            {displayPicture ? (
              <img
                src={displayPicture}
                alt="Your profile"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
                style={{
                  width: "125px",
                  height: "125px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "4px solid #e0e7ff",
                  background: "#f1f5f9",
                }}
              />
            ) : (
              <div
                aria-label="Profile picture placeholder"
                style={{
                  width: "125px",
                  height: "125px",
                  borderRadius: "50%",
                  background: "#e0e7ff",
                  color: "#4338ca",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "44px",
                  fontWeight: 800,
                  border: "4px solid #c7d2fe",
                  flexShrink: 0,
                }}
              >
                {(profile.fullName || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, minWidth: "220px" }}>
              <p
                style={{
                  color: "#64748b",
                  lineHeight: 1.7,
                  marginTop: 0,
                }}
              >
                Choose a JPG, JPEG, PNG, or WEBP image.
                The maximum file size is 5 MB.
              </p>

              <input
                id="profile-picture-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handlePictureChange}
                style={{
                  display: "block",
                  width: "100%",
                  marginBottom: "14px",
                  fontSize: "14px",
                }}
              />

              <button
                type="button"
                onClick={handleUploadPicture}
                disabled={!selectedPicture || uploading}
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    !selectedPicture || uploading ? 0.55 : 1,
                  cursor:
                    !selectedPicture || uploading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {uploading ? "Uploading..." : "Upload Picture"}
              </button>

              {selectedPicture && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginBottom: 0,
                  }}
                >
                  Selected: {selectedPicture.name}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Basic account information */}
        <section style={{ ...cardStyle, marginBottom: "22px" }}>
          <h2 style={subheadingStyle}>Account information</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                value={profile.fullName || ""}
                readOnly
                style={{
                  ...inputStyle,
                  background: "#f8fafc",
                  color: "#64748b",
                }}
              />
            </div>

            <div>
              <label style={labelStyle}>Email address</label>
              <input
                type="email"
                value={profile.email || ""}
                readOnly
                style={{
                  ...inputStyle,
                  background: "#f8fafc",
                  color: "#64748b",
                }}
              />
            </div>
          </div>
        </section>

        {/* Editable profile details */}
        <form
          onSubmit={handleSaveProfile}
          style={{ ...cardStyle, marginBottom: "32px" }}
        >
          <h2 style={subheadingStyle}>About me</h2>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="bio" style={labelStyle}>
              Bio
            </label>

            <textarea
              id="bio"
              name="bio"
              value={profile.bio || ""}
              onChange={handleChange}
              maxLength={500}
              rows={4}
              placeholder="Tell your community a little about yourself..."
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />

            <small style={{ color: "#64748b" }}>
              {(profile.bio || "").length}/500 characters
            </small>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="skills" style={labelStyle}>
              Skills
            </label>

            <textarea
              id="skills"
              name="skills"
              value={profile.skills || ""}
              onChange={handleChange}
              maxLength={500}
              rows={3}
              placeholder="Example: Python, SQL, React, Data Science"
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label htmlFor="interests" style={labelStyle}>
              Interests
            </label>

            <textarea
              id="interests"
              name="interests"
              value={profile.interests || ""}
              onChange={handleChange}
              maxLength={500}
              rows={3}
              placeholder="Example: AI, reading, sports, travel"
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              ...primaryButtonStyle,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </main>
  );
}

// Shared page styles.
const pageStyle = {
  minHeight: "100vh",
  background: "#f3f6fc",
  padding: "32px 16px",
  color: "#1e293b",
  fontFamily: "Arial, sans-serif",
};

const cardStyle = {
  maxWidth: "100%",
  background: "#ffffff",
  padding: "26px",
  borderRadius: "18px",
  boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
  border: "1px solid #e2e8f0",
};

const subheadingStyle = {
  fontSize: "21px",
  color: "#312e81",
  marginTop: 0,
  marginBottom: "20px",
};
