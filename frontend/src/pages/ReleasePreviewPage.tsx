import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const ReleasePreviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [decrypted, setDecrypted] = useState(false);

  const handleDecrypt = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    // TODO: Phase 4 - Implement actual decryption with WebCrypto
    // For now, show placeholder message
    setDecrypted(true);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-950 border border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-200 mb-2">
            Invalid Release Link
          </h2>
          <p className="text-gray-300">No token provided in URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-purple-800 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-purple-300 mb-6">
          Legacy Release
        </h1>

        {!decrypted ? (
          <form onSubmit={handleDecrypt} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enter Passphrase to Access
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100"
              />
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium transition"
            >
              Unlock Content
            </button>
            <p className="text-xs text-gray-400 mt-4">
              TODO: Phase 4 - Decryption will happen in the browser using
              WebCrypto
            </p>
          </form>
        ) : (
          <div className="bg-gray-700 rounded p-4">
            <p className="text-gray-300">
              Content has been successfully decrypted. This is where the capsule
              contents would appear after Phase 4 encryption is implemented.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReleasePreviewPage;
