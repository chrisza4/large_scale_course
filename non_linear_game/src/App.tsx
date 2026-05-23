import { useState, useEffect } from "react";
import "./index.css";

export function App() {
  const [currentValue, setCurrentValue] = useState<string>("—");
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const poll = async () => {
      const res = await fetch("/api/value");
      const data = (await res.json()) as { value: number };
      setCurrentValue(String(data.value));
    };

    poll();
    const id = setInterval(poll, 200);
    return () => clearInterval(id);
  }, []);

  async function send() {
    const num = Number(inputValue);
    if (!Number.isFinite(num) || inputValue.trim() === "") return;
    const res = await fetch("/api/value", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: num }),
    });
    const data = (await res.json()) as { value: number };
    setCurrentValue(String(data.value));
    setInputValue("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") send();
  }

  return (
    <div className="game">
      <h1 className="game-title">Shared Number</h1>
      <div className="current-value" data-testid="current-value">
        {currentValue}
      </div>
      <div className="input-row">
        <input
          className="number-input"
          type="number"
          placeholder="Enter a number…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          data-testid="number-input"
        />
        <button className="ok-button" onClick={send} data-testid="send-button">
          OK
        </button>
      </div>
    </div>
  );
}

export default App;
