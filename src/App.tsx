import { Terminal } from "./components/Terminal";

export function App() {
  return (
    <div className="h-screen w-screen bg-[#0f0f0f] overflow-hidden">
      <Terminal sessionId="main" />
    </div>
  );
}
