import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { fetchNewsletterMembers } from "@/lib/newsletter/admin.functions";

export const Route = createFileRoute("/subscribers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Newsletter subscribers — TheFullPicture.ai" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubscribersPage,
});

function SubscribersPage() {
  const { user, isAdmin, loading } = useAuth();
  const fetchMembers = useServerFn(fetchNewsletterMembers);
  const query = useQuery({
    queryKey: ["newsletter-members", user?.id],
    enabled: !loading && isAdmin,
    queryFn: () => fetchMembers(),
    refetchInterval: 60_000,
  });
  if (loading) return <main className="p-8">Checking access…</main>;
  if (!user)
    return (
      <main className="p-8">
        <Link to="/auth">Sign in</Link> to view subscribers.
      </main>
    );
  if (!isAdmin) return <main className="p-8">Administrator access required.</main>;
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/review" className="underline">
        Back to editorial review
      </Link>
      <h1 className="mt-6 font-serif text-4xl">Newsletter subscribers</h1>
      <p className="mt-3 text-muted-foreground">
        Complimentary test readers are separate from paying customers. Payment records refresh with
        the scheduled worker; each paid send checks Stripe again.
      </p>
      {query.isLoading && <p className="mt-6">Loading subscribers…</p>}
      {query.error && <p className="mt-6">Could not load subscribers. Please try again.</p>}
      <div className="mt-6 space-y-4">
        {query.data?.map((member) => {
          const expired =
            member.accessKind === "paid" &&
            (!member.paidUntil || new Date(member.paidUntil).getTime() <= Date.now());
          return (
            <article key={member.id} className="rounded-md border p-4">
              <h2 className="font-semibold break-all">{member.email}</h2>
              <p className="mt-1 capitalize">
                {member.cadence} ·{" "}
                {member.accessKind === "complimentary" ? "Complimentary test" : "Paid subscription"}
              </p>
              <p>
                {member.unsubscribed
                  ? "Email delivery stopped"
                  : expired
                    ? "No current paid access"
                    : member.status}
              </p>
              {member.paidUntil && (
                <p>Paid through: {new Date(member.paidUntil).toLocaleString()}</p>
              )}
              {member.accessKind === "paid" && (
                <p>
                  Last payment check:{" "}
                  {member.verifiedAt
                    ? new Date(member.verifiedAt).toLocaleString()
                    : "Not verified yet"}
                </p>
              )}
              <p>Latest delivery: {member.deliveryStatus}</p>
              {!member.unsubscribed && !expired && (
                <p>
                  Next edition due: {new Date(member.nextSendAt).toLocaleString()} (requires the
                  delivery worker)
                </p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
