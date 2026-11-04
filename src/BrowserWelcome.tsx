import { Button } from "./Button";
export function BrowserWelcome({
  ready,
  supported,
  model,
  onPrompt,
}: {
  ready: boolean;
  supported: boolean | null;
  model: string;
  onPrompt: (text: string) => void;
}) {
  return (
    <div className="empty">
      <p className="eyebrow">AI ON YOUR DEVICE</p>
      <h2>Your own private chat.</h2>
      <p>
        Ask questions, explore an idea, or polish a draft. Your messages stay in
        this browser.
      </p>
      {ready ? (
        <p role="status">{model} is ready. Start a conversation below.</p>
      ) : (
        <ol className="setup-steps">
          <li>
            Open <strong>Models</strong> below and choose a model.
          </li>
          <li>Download its weights once. No account or separate app needed.</li>
          <li>
            Chat locally. Offline use needs the app and all model files cached.
          </li>
        </ol>
      )}
      {supported === null && (
        <p className="muted">Checking this browser’s WebGPU support…</p>
      )}
      {supported === false && (
        <p className="muted">
          This browser cannot run the model yet. Try a recent desktop browser
          with hardware acceleration enabled.
        </p>
      )}
      <div className="starter-prompts" aria-label="Conversation starters">
        {[
          "Explain a technical concept in plain English",
          "Help me plan my day",
          "Brainstorm a small project idea",
        ].map((prompt) => (
          <Button
            className="secondary"
            key={prompt}
            onClick={() => onPrompt(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
      <small>
        Small local models can make mistakes. Verify important answers.
      </small>
    </div>
  );
}
