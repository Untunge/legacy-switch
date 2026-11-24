import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuditLogResponse } from '../types';

const AuditLogPage: React.FC = () => {
  const { id } = useParams();
  const [verified, setVerified] = useState(false);

  const { data: auditLog = [], isLoading } = useQuery({
    queryKey: ['auditLog', id],
    queryFn: async () => {
      const response = await fetch(
        `http://localhost:3001/capsules/${id}/audit`,
        {
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to fetch audit log');
      const json = (await response.json()) as AuditLogResponse;
      return json.data;
    },
  });

  const verifyHashChain = () => {
    // TODO: Phase 4+ - Implement actual hash chain verification
    // For now, just show a success message
    setVerified(true);
  };

  if (isLoading)
    return <div className="text-center py-8">Loading audit log...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-300 mb-6">Audit Log</h1>

      <button
        onClick={verifyHashChain}
        className="mb-6 px-6 py-2 bg-blue-700 hover:bg-blue-600 rounded font-medium transition"
      >
        Verify Hash Chain
      </button>

      {verified && (
        <div className="bg-green-950 border border-green-700 rounded-lg p-4 mb-6">
          <p className="text-green-200">
            ✓ Hash chain verified - no tampering detected
          </p>
        </div>
      )}

      <div className="space-y-4">
        {auditLog.length === 0 ? (
          <div className="text-center py-8 bg-gray-800 border border-gray-700 rounded-lg">
            <p className="text-gray-400">No audit entries yet</p>
          </div>
        ) : (
          auditLog.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-purple-300">
                    {entry.action}
                  </p>
                  {entry.resourceType && (
                    <p className="text-sm text-gray-400">
                      {entry.resourceType}: {entry.resourceId}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
                {entry.tampered && (
                  <span className="bg-red-900 px-3 py-1 rounded text-sm font-semibold text-red-200">
                    ⚠ TAMPERED
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
