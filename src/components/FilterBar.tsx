import { TOPIC_DESCRIPTIONS } from "@/lib/taxonomy";
import {
  Search,
  X,
  BookmarkCheck,
  Check,
  FileText,
  Headphones,
  PlaySquare,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACCESS_OPTIONS,
  CONTENT_TYPES,
  GEOGRAPHIES,
  TONES,
  TONE_DESCRIPTIONS,
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
  onClearDefault?: () => void;
  hasSavedDefault?: boolean;
};

function outlineChip(active: boolean) {
  return `rounded-full border bg-background px-3 py-1 text-sm text-foreground shadow-none transition-colors hover:border-brand-accent hover:text-brand-accent ${
    active
      ? "border-brand-accent bg-accent font-semibold text-accent-foreground ring-1 ring-brand-accent"
      : "border-border"
  }`;
}

export function FilterBar({
  filters,
  onChange,
  onReset,
  onSaveDefault,
  canSaveDefault,
  saving,
  onClearDefault,
  hasSavedDefault,
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
    filters.contentType !== null ||
    filters.timeRange !== null ||
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
                title={TOPIC_DESCRIPTIONS[t]}
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Impact
            </p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <Button
                  key={tone}
                  title={TONE_DESCRIPTIONS[tone]}
                  aria-pressed={filters.tone === tone}
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
            <p className="mt-2 text-xs text-muted-foreground">
              {filters.tone
                ? TONE_DESCRIPTIONS[filters.tone]
                : "Labels describe the development’s impact, not the article’s writing style."}
            </p>
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

          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Content type
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((contentType) => {
                const Icon =
                  contentType === "Podcast"
                    ? Headphones
                    : contentType === "Video"
                      ? PlaySquare
                      : FileText;
                return (
                  <Button
                    key={contentType}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onChange({
                        contentType: filters.contentType === contentType ? null : contentType,
                      })
                    }
                    className={outlineChip(filters.contentType === contentType)}
                  >
                    {filters.contentType === contentType ? <Check /> : <Icon />}
                    {contentType}
                  </Button>
                );
              })}
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

        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            )}
            {canSaveDefault && onSaveDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveDefault}
                disabled={saving || !hasFilters}
              >
                <BookmarkCheck className="mr-1 h-4 w-4" />
                {saving ? "Saving…" : "Save as my default view"}
              </Button>
            )}
            {hasSavedDefault && onClearDefault && (
              <Button variant="ghost" size="sm" onClick={onClearDefault}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Forget my default view
              </Button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This view is shareable — the page address carries your filters. Saving a default keeps
            it in this browser only: no account needed, but it won&apos;t carry over to another
            device or browser, and it is forgotten if you clear your browsing data or browse
            privately. To keep it for good, bookmark the page address instead.
          </p>
        </div>
      </div>
    </section>
  );
}
