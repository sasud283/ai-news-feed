import { Search, X, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACCESS_OPTIONS,
  GEOGRAPHIES,
  TONES,
  TOPICS,
  toneClass,
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

function chip(active: boolean) {
  return `rounded-full border px-3 py-1 text-sm transition-colors ${
    active
      ? "border-topic-foreground bg-topic-foreground text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
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
    <section className="border-y border-filter-border bg-filter-surface py-5">
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search headlines and summaries"
            className="bg-background pl-9"
            aria-label="Search stories"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTopic(t)}
                className={chip(filters.topics.includes(t))}
              >
                {t}
              </button>
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
                <button
                  key={tone}
                  type="button"
                  onClick={() => onChange({ tone: filters.tone === tone ? null : tone })}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    filters.tone === tone
                      ? toneClass[tone]
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Access
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCESS_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onChange({ access: filters.access === a ? null : a })}
                  className={chip(filters.access === a)}
                >
                  {a}
                </button>
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
              <button
                key={g}
                type="button"
                onClick={() => onChange({ geography: filters.geography === g ? null : g })}
                className={chip(filters.geography === g)}
              >
                {g}
              </button>
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
