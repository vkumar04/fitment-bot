'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Metrics {
  totalConversations: number;
  todayConversations: number;
  activeConversations: number;
  averageSentiment: number;
  shopBreakdown: Array<{ shop_domain: string; session_count: number }>;
  recentConversations: Array<{
    id: string;
    session_id: string;
    shop_domain: string;
    started_at: string;
    message_count: number;
    sentiment_score: number;
    is_active: number;
  }>;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/analytics/metrics');
      const data = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearDatabase = async () => {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch('/api/analytics/clear', { method: 'POST' });
      if (res.ok) {
        await fetchMetrics();
        alert('Database cleared successfully');
      } else {
        alert('Failed to clear database');
      }
    } catch (error) {
      console.error('Error clearing database:', error);
      alert('Failed to clear database');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const todayChange = metrics?.totalConversations
    ? ((metrics.todayConversations / metrics.totalConversations) * 100).toFixed(1)
    : '0.0';

  const sentimentChange = ((metrics?.averageSentiment || 0.5) - 0.5).toFixed(2);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Image
            src="/kansei-logo.png"
            alt="Kansei"
            width={120}
            height={40}
            className="object-contain"
          />
        </div>
        <button
          onClick={clearDatabase}
          disabled={clearing}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {clearing ? 'Clearing...' : 'Clear Database'}
        </button>
      </div>

      {/* Overview Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Overview</h1>
        <p className="text-gray-400">Monitor fitment assistant performance and customer interactions</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Conversations */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-gray-400 text-sm font-medium">TOTAL CONVERSATIONS</span>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-bold">{metrics?.totalConversations || 0}</div>
            <div className="text-green-400 text-sm">+0.0%</div>
          </div>
        </div>

        {/* Today */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-gray-400 text-sm font-medium">TODAY</span>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-bold">{metrics?.todayConversations || 0}</div>
            <div className="text-green-400 text-sm">+0.0%</div>
          </div>
        </div>

        {/* Active Now */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-gray-400 text-sm font-medium">ACTIVE NOW</span>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-bold">{metrics?.activeConversations || 0}</div>
            <div className="text-gray-500 text-sm">-</div>
          </div>
        </div>

        {/* Avg Sentiment */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-gray-400 text-sm font-medium">AVG. SENTIMENT</span>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-bold">{(metrics?.averageSentiment || 0.5).toFixed(2)}</div>
            <div className={`text-sm ${parseFloat(sentimentChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {parseFloat(sentimentChange) >= 0 ? '+' : ''}{sentimentChange}
            </div>
          </div>
        </div>
      </div>

      {/* Shopify Store Breakdown */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
          </svg>
          <h2 className="text-xl font-bold">Shopify Store Breakdown</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">Sessions by store domain</p>

        {metrics?.shopBreakdown && metrics.shopBreakdown.length > 0 ? (
          <div className="space-y-3">
            {metrics.shopBreakdown.map((shop, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-gray-300">{shop.shop_domain}</span>
                </div>
                <span className="text-gray-400 font-medium">{shop.session_count} sessions</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No sessions yet
          </div>
        )}
      </div>

      {/* Recent Conversations */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6">Recent Conversations</h2>

        {metrics?.recentConversations && metrics.recentConversations.length > 0 ? (
          <div className="space-y-4">
            {metrics.recentConversations.map((conv) => (
              <div key={conv.id} className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${conv.is_active ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <div>
                    <div className="text-gray-300 font-medium">{conv.shop_domain}</div>
                    <div className="text-gray-500 text-sm">
                      {new Date(conv.started_at).toLocaleString()} • {conv.message_count} messages
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-sm">Sentiment</div>
                  <div className="text-gray-300 font-medium">{conv.sentiment_score.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
}
