import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const code = useRef<HTMLPreElement>(null);
  const [notice, setNotice] = useState("");
  return (
    <div className="code-block">
      <button
        className="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              code.current?.textContent ?? "",
            );
            setNotice("Copied");
          } catch {
            setNotice("Copy failed — select the code manually");
          }
        }}
      >
        Copy code
      </button>
      <pre {...props} ref={code}>
        {children}
      </pre>
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
          // Never fetch model-generated remote images; that would disclose the visitor's IP.
          img: ({ alt }) => <span>[Image: {alt || "not loaded"}]</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
