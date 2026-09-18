import { Search, X, BookmarkCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACCESS_OPTIONS,
  GEOGRAPHIES,
  TONES,
  TOPICS,
  topicClass,
  type Filters,
  type Topic,
} from "@/lib/news";

type Props = {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  onReset: () => void;
  onSaveDefault?: () => void;
  canSaveDefault?: boolean;
  saving?: boolean;
};

function outlineChip(active: boolean) {
  return `rounded-full border bg-background px-3 py-1 text-sm text-foreground shadow-none transition-colors hover:border-brand-accent hover:text-brand-accent ${
    active ? "border-brand-accent bg-accent font-semibold text-accent-foreground ring-1 ring-brand-accent" : "border-border"
  }`;
}

export function FilterBar({
  filters,
  onChange,
  onReset,
  onSaveDefault,
  canSaveDefault,
  saving,
}: Props) {
  const toggleTopic = (topic: Topic) => {
    const next = filters.topics.includes(topic)
      ? filters.topics.filter((t) => t !== topic)
      : [...filters.topics, topic];
    onChange({ topics: next });
  };

  const hasFilters =
    filters.topics.length > 0 ||
    filters.tone !== null ||
    filters.access !== null ||
    filters.geography !== null ||
    filters.q !== "";

  return (
    <section className="bg-background/85 py-7 backdrop-blur-xl">
      <div className="mx-auto max-w-3xl space-y-5 px-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search headlines and summaries"
            className="h-11 border-border bg-background pl-9 shadow-none focus-visible:border-brand-accent focus-visible:ring-brand-accent/20"
            aria-label="Search stories"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => toggleTopic(t)}
                 className={`rounded-full border-transparent px-3 shadow-none opacity-85 hover:opacity-100 ${topicClass[t]} ${
                   filters.topics.includes(t) ? "ring-2 ring-brand-accent ring-offset-2" : ""
                }`}
              >
                {filters.topics.includes(t) && <Check />}
                {t}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Tone
            </p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <Button
                  key={tone}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChange({ tone: filters.tone === tone ? null : tone })}
                  className={outlineChip(filters.tone === tone)}
                >
                  {filters.tone === tone && <Check />}
                  {tone}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Access
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCESS_OPTIONS.map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChange({ access: filters.access === a ? null : a })}
                  className={outlineChip(filters.access === a)}
                >
                  {filters.access === a && <Check />}
                  {a}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Geography
          </p>
          <div className="flex flex-wrap gap-2">
            {GEOGRAPHIES.map((g) => (
              <Button
                key={g}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange({ geography: filters.geography === g ? null : g })}
                className={outlineChip(filters.geography === g)}
              >
                {filters.geography === g && <Check />}
                {g}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          )}
          {canSaveDefault && onSaveDefault && (
            <Button variant="outline" size="sm" onClick={onSaveDefault} disabled={saving}>
              <BookmarkCheck className="mr-1 h-4 w-4" />
              {saving ? "Saving…" : "Save as my default view"}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            This view is shareable — the page address carries your filters.
          </span>
        </div>
      </div>
    </section>
  );
}
