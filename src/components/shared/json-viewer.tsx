import { cn } from "@/lib/utils";

const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

// Realce leve de sintaxe, sem dependências: chaves, strings, literais e números.
function highlight(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of json.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(json.slice(last, index));
    const [token, key, string, literal] = match;
    const className = key
      ? "text-primary"
      : string
        ? "text-success"
        : literal
          ? "text-warning"
          : "text-info";
    nodes.push(
      <span key={index} className={className}>
        {token}
      </span>,
    );
    last = index + token.length;
  }
  nodes.push(json.slice(last));
  return nodes;
}

export function JsonViewer({
  value,
  className,
}: {
  value: unknown;
  className?: string;
}) {
  const json = JSON.stringify(value, null, 2);
  return (
    <pre
      className={cn(
        "max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed",
        className,
      )}
    >
      <code>{highlight(json)}</code>
    </pre>
  );
}
