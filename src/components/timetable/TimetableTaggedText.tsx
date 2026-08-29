import { Badge } from "@/components/ui/badge";
import { extractHashtags, splitTextWithUrls } from "@/lib/timetable/sectionItems";

type TimetableTaggedTextProps = {
  text: string;
  className?: string;
};

function renderHashtags(text: string) {
  const tags = new Set(extractHashtags(text));
  const parts = text.split(/(#[A-Za-z0-9_][A-Za-z0-9_-]{0,39})/g);
  return parts.map((part, index) => {
    if (part.startsWith("#") && tags.has(part.slice(1).toLowerCase())) {
      return (
        <Badge key={`${part}-${index}`} variant="secondary">
          {part}
        </Badge>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function TimetableTaggedText({ text, className }: TimetableTaggedTextProps) {
  const chunks = splitTextWithUrls(text);
  return (
    <span className={className}>
      {chunks.map((chunk, index) => {
        if (chunk.type === "url") {
          return (
            <a
              key={`${chunk.value}-${index}`}
              href={chunk.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {chunk.value}
            </a>
          );
        }
        return <span key={`${chunk.value}-${index}`}>{renderHashtags(chunk.value)}</span>;
      })}
    </span>
  );
}
