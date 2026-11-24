import React from 'react';
import { Link } from 'react-router-dom';
import { useCapsules } from '../hooks/useCapsules';
import { formatDistanceToNow } from 'date-fns';

const DashboardPage: React.FC = () => {
  const { capsules, isLoading } = useCapsules();

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const sorted = [...capsules].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-purple-300">Your Capsules</h1>
        <Link
          to="/capsule/new"
          className="px-6 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium transition"
        >
          + New Capsule
        </Link>
      </div>

      {capsules.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-gray-400 mb-4">No capsules yet.</p>
          <Link
            to="/capsule/new"
            className="text-purple-400 hover:text-purple-300"
          >
            Create your first capsule →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sorted.map((capsule) => (
            <div
              key={capsule.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-purple-600 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-purple-300">
                    {capsule.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {capsule.description || 'No description'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Created{' '}
                    {formatDistanceToNow(new Date(capsule.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/capsule/${capsule.id}`}
                    className="px-3 py-1 bg-blue-900 hover:bg-blue-800 rounded text-sm transition"
                  >
                    View
                  </Link>
                  <Link
                    to={`/capsule/${capsule.id}/edit`}
                    className="px-3 py-1 bg-yellow-900 hover:bg-yellow-800 rounded text-sm transition"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
