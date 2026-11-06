import { Button } from "./Button";
export function BrowserWelcome({
  ready,
  onPrompt,
}: {
  ready: boolean;
  onPrompt: (text: string) => void;
}) {
  return (
    <div className="empty">
      <h2>What can I help with?</h2>
      {!ready && (
        <p className="welcome-hint">
          Select a model from the message box to start chatting.
        </p>
      )}
      <div className="starter-prompts" aria-label="Conversation starters">
        {[
          "Explain something simply",
          "Help me plan my day",
          "Brainstorm project ideas",
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
    </div>
  );
}
