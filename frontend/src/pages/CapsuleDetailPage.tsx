import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCapsules } from '../hooks/useCapsules';
import { useCheckIn } from '../hooks/useCheckIn';
import { useContacts } from '../hooks/useContacts';

const CapsuleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { capsules, deleteCapsule } = useCapsules();
  const { checkIn, isPending } = useCheckIn();
  const { contacts } = useContacts(id);

  const capsule = capsules.find((c) => c.id === id);

  if (!capsule) {
    return <div className="text-center py-8">Capsule not found</div>;
  }

  const handleCheckIn = () => {
    if (id) checkIn(id);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure?')) {
      if (id) deleteCapsule(id);
      navigate('/dashboard');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-purple-300 mb-2">
          {capsule.title}
        </h1>
        {capsule.description && (
          <p className="text-gray-400 mb-4">{capsule.description}</p>
        )}
        <div className="bg-gray-700 rounded p-4 mb-6">
          <h3 className="font-semibold text-gray-300 mb-2">Content Preview</h3>
          <p className="text-gray-400 whitespace-pre-wrap truncate max-h-32">
            {capsule.encryptedContent}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleCheckIn}
            disabled={isPending}
            className="px-6 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded font-medium"
          >
            {isPending ? 'Checking in...' : '✓ Check In'}
          </button>
          <Link
            to={`/capsule/${id}/edit`}
            className="px-6 py-2 bg-yellow-700 hover:bg-yellow-600 rounded font-medium"
          >
            Edit
          </Link>
          <Link
            to={`/audit/${id}`}
            className="px-6 py-2 bg-blue-700 hover:bg-blue-600 rounded font-medium"
          >
            Audit
          </Link>
          <button
            onClick={handleDelete}
            className="px-6 py-2 bg-red-700 hover:bg-red-600 rounded font-medium"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-purple-300 mb-4">
          Contacts ({contacts.length})
        </h2>
        {contacts.length === 0 ? (
          <p className="text-gray-400">No contacts</p>
        ) : (
          contacts.map((c) => (
            <div
              key={c.id}
              className="flex justify-between bg-gray-700 p-3 rounded mb-2"
            >
              <div>
                <p className="font-medium text-gray-100">{c.name || c.email}</p>
              </div>
              <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                {c.released ? 'Released' : 'Pending'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CapsuleDetailPage;
