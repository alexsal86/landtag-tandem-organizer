import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";

interface TruncatedDescriptionProps {
  content: string;
  maxLength?: number;
}

export const TruncatedDescription = ({
  content,
  maxLength = 150,
}: TruncatedDescriptionProps) => {
  const [expanded, setExpanded] = useState(false);

  const plainText = content.replace(/<[^>]*>/g, "");
  const isTruncated = plainText.length > maxLength;

  if (!isTruncated || expanded) {
    return (
      <div>
        <RichTextDisplay content={content} className="text-sm text-muted-foreground" />
        {isTruncated && (
          <Button
            variant="link"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="text-xs p-0 h-auto text-muted-foreground hover:text-primary"
          >
            weniger
          </Button>
        )}
      </div>
    );
  }

  const truncatedPlain = plainText.substring(0, maxLength).replace(/\s+\S*$/, "") + "...";

  return (
    <div>
      <p className="text-sm text-muted-foreground">{truncatedPlain}</p>
      <Button
        variant="link"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        className="text-xs p-0 h-auto text-muted-foreground hover:text-primary"
      >
        mehr
      </Button>
    </div>
  );
};
