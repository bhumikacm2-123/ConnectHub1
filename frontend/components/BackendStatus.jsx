
import { useEffect, useState } from "react";

function BackendStatus() {
  const [message, setMessage] = useState("Connecting to backend...");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => {
        setMessage(data.message);
        setConnected(true);
      })
      .catch(() => {
        setMessage("Could not connect to the backend.");
        setConnected(false);
      });
  }, []);

  return (
    <div
      className={`backend-status ${
        connected ? "connected" : "disconnected"
      }`}
      role="status"
    >
      <span className="status-indicator" />

      <div>
        <h3>ConnectHub Server</h3>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default BackendStatus;
