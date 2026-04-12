import { useState } from "react";

export default function App() {
  // This stores whatever the backend sends back
  const [result, setResult] = useState<any>(null);

  // This runs when you click the button
  async function callAnalyze() {
    try {
      // 1) We send a POST request to your backend /analyze endpoint
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST", // means "send data to server"
        headers: {
          "Content-Type": "application/json", // tells server "I'm sending JSON"
        },
        body: JSON.stringify({
          // This object is the JSON your backend expects
          pose: { ankle_angle_r: 0.0, subtalar_angle_r: 0.1 },
          selected_muscles: ["tib_post_r"],
          tightness: { tib_post_r: 0.5 },
        }),
      });

      // 2) Convert server response from JSON text into a JS object
      const data = await response.json();

      // 3) Save it into React state so it shows on the page
      setResult(data);
    } catch (err: any) {
      // If something fails (server down, bad CORS, etc.)
      setResult({ error: String(err) });
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h1>MusculoMove</h1>

      <button onClick={callAnalyze} style={{ padding: "10px 14px" }}>
        Call /analyze
      </button>

      <h2>Result</h2>
      <pre style={{ background: "#f6f6f6", padding: 12, overflow: "auto" }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}