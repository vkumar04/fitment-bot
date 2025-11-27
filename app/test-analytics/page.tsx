'use client';

import { useState } from 'react';

export default function TestAnalytics() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testAnalytics = async () => {
    setLoading(true);
    try {
      const sessionId = `test_${Date.now()}`;

      // Test start session
      console.log('Testing start session...');
      const startRes = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_session',
          sessionId,
          data: { source: 'shopify', sourceDomain: 'test-store.myshopify.com' }
        })
      });
      const startData = await startRes.json();
      console.log('Start session result:', startData);

      // Test track message
      console.log('Testing track message...');
      const msgRes = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_message',
          sessionId,
          data: { role: 'user', contentLength: 50 }
        })
      });
      const msgData = await msgRes.json();
      console.log('Track message result:', msgData);

      setResult('Success! Check console and database.');
    } catch (error) {
      console.error('Error:', error);
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Analytics API Test</h1>
      <button
        onClick={testAnalytics}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Analytics API'}
      </button>
      {result && <div className="mt-4 p-4 bg-gray-900 rounded">{result}</div>}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Instructions:</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li>Click the button above</li>
          <li>Check browser console for logs</li>
          <li>Check terminal for [Analytics API] logs</li>
          <li>Run: <code className="bg-gray-800 px-2 py-1 rounded">sqlite3 data/analytics.db "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;"</code></li>
        </ol>
      </div>
    </div>
  );
}
