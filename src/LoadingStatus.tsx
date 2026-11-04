import { useEffect, useState } from "react";
export function LoadingStatus({
  progress,
}: {
  progress: { value: number; message: string };
}) {
  const [started] = useState(Date.now),
    [now, setNow] = useState(Date.now),
    [updated, setUpdated] = useState(Date.now);
  useEffect(() => {
    setUpdated(Date.now());
  }, [progress.message, progress.value]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const message = progress.message;
  const phase = /shader|compile|pipeline/i.test(message)
    ? "Preparing GPU"
    : /parameter|weight|fetching param/i.test(message)
      ? "Loading weights"
      : /connect.*server/i.test(message)
        ? "Connecting server"
        : "Loading runtime and model files";
  return (
    <div className="loading">
      <div className="loading-heading">
        <small>{phase}</small>
        <small>{Math.floor((now - started) / 1000)}s</small>
      </div>
      <progress
        max={1}
        value={progress.value > 0 ? Math.min(progress.value, 1) : undefined}
        aria-label="Model loading"
      />
      <p role="status">{message}</p>
      {now - updated > 30000 && (
        <p role="status">
          No new runtime progress for {Math.floor((now - updated) / 1000)}s. It
          may still be downloading or compiling. Stop to cancel, then retry from
          Models.
        </p>
      )}
    </div>
  );
}
