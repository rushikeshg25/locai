import { diffWordsWithSpace } from "diff";
export function ChangeReview({
  source,
  result,
}: {
  source: string;
  result: string;
}) {
  return (
    <details className="review">
      <summary>Review changes</summary>
      <p className="muted">
        Deleted text is struck through. Added text is highlighted.
      </p>
      <div className="diff">
        {diffWordsWithSpace(source, result).map((part, index) =>
          part.added ? (
            <ins key={index}>{part.value}</ins>
          ) : part.removed ? (
            <del key={index}>{part.value}</del>
          ) : (
            <span key={index}>{part.value}</span>
          ),
        )}
      </div>
    </details>
  );
}
