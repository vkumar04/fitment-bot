import { getAnalytics } from "@/app/actions/analytics";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await getAnalytics();

  if (!result.success || !result.data) {
    return <div>Error loading analytics</div>;
  }

  const {
    total,
    totalChange,
    today,
    todayChange,
    active,
    avgSentiment,
    sentimentChange,
    sourceBreakdown,
    recentSessions,
  } = result.data;

  // Calculate Shopify vs Standalone stats
  const shopifyStats = sourceBreakdown
    .filter((s) => s.source === "shopify")
    .reduce(
      (acc, s) => ({
        count: acc.count + s.count,
        avgMessages: acc.avgMessages + s.avg_messages,
      }),
      { count: 0, avgMessages: 0 },
    );

  const standaloneStats = sourceBreakdown
    .filter((s) => s.source === "standalone")
    .reduce(
      (acc, s) => ({
        count: acc.count + s.count,
        avgMessages: acc.avgMessages + s.avg_messages,
      }),
      { count: 0, avgMessages: 0 },
    );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image src="/kansei-logo.png" alt="Kansei" width={40} height={40} />
          <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2 text-gray-100">Overview</h2>
          <p className="text-gray-400 text-sm">
            Monitor fitment assistant performance and customer interactions
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Conversations */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-400">
                  TOTAL CONVERSATIONS
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-gray-100">{total}</div>
              <div
                className={`text-sm flex items-center gap-1 ${totalChange >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {totalChange >= 0 ? "+" : ""}
                {totalChange.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Today */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-400">TODAY</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-gray-100">{today}</div>
              <div
                className={`text-sm flex items-center gap-1 ${todayChange >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {todayChange >= 0 ? "+" : ""}
                {todayChange.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Active Now */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-400">
                  ACTIVE NOW
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-gray-100">{active}</div>
              <div className="text-sm text-gray-500">-</div>
            </div>
          </div>

          {/* Avg Sentiment */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-400">
                  AVG. SENTIMENT
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-gray-100">
                {avgSentiment.toFixed(2)}
              </div>
              <div
                className={`text-sm flex items-center gap-1 ${sentimentChange >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {sentimentChange >= 0 ? "+" : ""}
                {sentimentChange.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Shopify Stats */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M16.373 7.116c-.003-.01-.006-.02-.01-.03-.11-.33-.298-.61-.54-.81-.245-.198-.543-.318-.859-.34h-.001c-.113-.008-.223-.006-.332.006-.012-.007-.024-.014-.037-.02-.248-.137-.53-.206-.817-.206-.072 0-.145.005-.218.014-.006-.006-.012-.01-.018-.016-.242-.226-.555-.357-.886-.372h-.005c-.22-.01-.434.034-.631.124-.006-.006-.013-.01-.019-.016a1.515 1.515 0 00-1.048-.324c-.2.008-.395.058-.577.145-.005-.005-.01-.009-.016-.014a1.474 1.474 0 00-1.009-.288 1.47 1.47 0 00-.969.47l-.006.008c-.225.274-.347.614-.343.961.003.24.059.472.162.68.009.017.018.034.027.05l1.664 3.05 3.05 5.58c.18.33.527.535.907.535h.001c.38 0 .727-.205.907-.535l4.714-8.63c.012-.021.023-.043.034-.065.139-.278.187-.588.14-.894-.046-.306-.176-.59-.376-.82z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">
                  Shopify Stores
                </h3>
                <p className="text-sm text-gray-400">
                  Embedded chatbot sessions
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-gray-100">
                  {shopifyStats.count}
                </div>
                <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-100">
                  {shopifyStats.avgMessages.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Avg Messages</div>
              </div>
            </div>
            {/* Show individual stores */}
            {sourceBreakdown.filter((s) => s.source === "shopify").length >
              0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="text-xs text-gray-500 mb-2">
                  Store Breakdown:
                </div>
                <div className="space-y-2">
                  {sourceBreakdown
                    .filter((s) => s.source === "shopify")
                    .map((store, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-400 truncate">
                          {store.source_domain || "Unknown"}
                        </span>
                        <span className="text-gray-300 font-medium">
                          {store.count} sessions
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Standalone Stats */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">
                  Standalone Site
                </h3>
                <p className="text-sm text-gray-400">Direct website sessions</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-gray-100">
                  {standaloneStats.count}
                </div>
                <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-100">
                  {standaloneStats.avgMessages.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Avg Messages</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-gray-100">
              Recent Conversations
            </h3>
          </div>
          <div className="divide-y divide-gray-800">
            {recentSessions.map((session) => {
              const date = new Date(session.created_at);
              const formattedDate = date.toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              });
              const formattedTime = date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });

              return (
                <div
                  key={session.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-300">
                          Session {session.id.slice(-8)}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${session.source === "shopify" ? "bg-green-900/30 text-green-400" : "bg-blue-900/30 text-blue-400"}`}
                        >
                          {session.source}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formattedDate}, {formattedTime}
                        {session.source_domain && ` • ${session.source_domain}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-sm text-gray-400">
                      {session.message_count} msgs
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded ${session.status === "active" ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-400"}`}
                    >
                      {session.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
