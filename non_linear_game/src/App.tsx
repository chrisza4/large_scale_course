import { useState, useEffect, useRef } from "react";
import "./index.css";

export function App() {
  const [currentValue, setCurrentValue] = useState<string>("—");
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    wsRef.current = ws;
    ws.onmessage = (e) => setCurrentValue(e.data);
    return () => ws.close();
  }, []);

  function send() {
    const num = Number(inputValue);
    if (!Number.isFinite(num) || inputValue.trim() === "") return;
    wsRef.current?.send(inputValue.trim());
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
