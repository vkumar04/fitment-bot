'use client';

import { useState } from 'react';
import { clearDatabase } from '@/app/actions/clearDatabase';
import { useRouter } from 'next/navigation';

export default function ClearDatabaseButton() {
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleClear = async () => {
    setIsClearing(true);
    const result = await clearDatabase();
    if (result.success) {
      setShowConfirm(false);
      router.refresh();
    } else {
      alert('Error clearing database');
    }
    setIsClearing(false);
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Clear Database
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Clear Database?</h3>
            <p className="text-gray-400 text-sm mb-6">
              This will permanently delete all sessions and messages. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isClearing}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={isClearing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Clear Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
