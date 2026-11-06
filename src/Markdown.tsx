import { Button } from "./Button";
import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const code = useRef<HTMLPreElement>(null);
  const [notice, setNotice] = useState("");
  return (
    <div className="code-block">
      <Button
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
      </Button>
      <pre {...props} ref={code}>
        {children}
      </pre>
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
export function Markdown({
  text,
  sources = [],
}: {
  text: string;
  sources?: { url: string }[];
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
          a: ({ node: _node, ...props }) => {
            const label = String(props.children);
            const citation = /^\d+$/.test(label)
              ? sources[Number(label) - 1]
              : undefined;
            return (
              <a
                {...props}
                href={citation?.url ?? props.href}
                target="_blank"
                rel="noreferrer noopener"
              />
            );
          },
          // Never fetch model-generated remote images; that would disclose the visitor's IP.
          img: ({ alt }) => <span>[Image: {alt || "not loaded"}]</span>,
        }}
      >
        {text +
          (sources.length
            ? "\n\n" +
              sources.map((s, i) => `[${i + 1}]: <${s.url}>`).join("\n")
            : "")}
      </ReactMarkdown>
    </div>
  );
}
