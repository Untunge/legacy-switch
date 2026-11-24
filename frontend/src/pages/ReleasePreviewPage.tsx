import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decrypt } from '../lib/crypto';
import { useQuery } from '@tanstack/react-query';

interface CapsulePreview {
  id: string;
  title: string;
  description?: string;
  encryptedContent: string;
  contentHash: string;
}

const ReleasePreviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const capsuleId = searchParams.get('id');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [decrypted, setDecrypted] = useState(false);
  const [plaintext, setPlaintext] = useState('');
  const [loading, setLoading] = useState(false);

  // Task 40: Fetch capsule preview (ciphertext only)
  const { data: preview } = useQuery({
    queryKey: ['releasePreview', capsuleId, token],
    queryFn: async () => {
      if (!capsuleId || !token) return null;
      const response = await fetch(
        `http://localhost:3001/releases/${capsuleId}?token=${token}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Invalid release link');
      const json = await response.json();
      return json.data as CapsulePreview;
    },
    enabled: !!capsuleId && !!token,
  });

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!passphrase.length) {
        setError('Enter passphrase to decrypt');
        return;
      }

      if (!preview) {
        setError('Capsule not found');
        return;
      }

      // Task 40: Parse ciphertext format (ciphertext:nonce:salt)
      const parts = preview.encryptedContent.split(':');
      if (parts.length !== 3) {
        setError('Invalid capsule format');
        return;
      }

      const [ciphertext, nonce, salt] = parts;

      // Decrypt in browser
      const decrypted = await decrypt(ciphertext, passphrase, salt, nonce);
      setPlaintext(decrypted);
      setDecrypted(true);

      // Mark as used
      await fetch(`http://localhost:3001/releases/${capsuleId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Decryption failed. Wrong passphrase?'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token || !capsuleId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-950 border border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-200 mb-2">
            Invalid Release Link
          </h2>
          <p className="text-gray-300">No token or capsule provided in URL.</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-purple-800 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-purple-300 mb-2">
          {preview.title}
        </h1>
        {preview.description && (
          <p className="text-gray-400 mb-6">{preview.description}</p>
        )}

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
              disabled={loading}
              className="w-full px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded font-medium transition"
            >
              {loading ? 'Decrypting...' : 'Unlock Content'}
            </button>
          </form>
        ) : (
          <div className="bg-green-950 border border-green-700 rounded p-4">
            <h2 className="font-semibold text-green-200 mb-3">
              ✓ Content Unlocked
            </h2>
            <div className="bg-gray-700 rounded p-4 max-h-64 overflow-y-auto">
              <p className="text-gray-100 whitespace-pre-wrap">{plaintext}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReleasePreviewPage;
