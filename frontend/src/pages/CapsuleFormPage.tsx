import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCapsules } from '../hooks/useCapsules';

interface CapsuleFormPageProps {
  mode: 'create' | 'edit';
}

const CapsuleFormPage: React.FC<CapsuleFormPageProps> = ({ mode }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { capsules, createCapsule, updateCapsule } = useCapsules();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>(
    'weekly'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      const capsule = capsules.find((c) => c.id === id);
      if (capsule) {
        setTitle(capsule.title);
        setDescription(capsule.description || '');
        // TODO: Phase 4 - Decrypt encryptedContent with passphrase
        setContent(capsule.encryptedContent || '');
      }
    }
  }, [mode, id, capsules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match');
      return;
    }

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      // TODO: Phase 4 - Encrypt content with WebCrypto PBKDF2+AES-GCM
      // For now, store plaintext with TODO comment
      const capsuleData = {
        title,
        description,
        encryptedContent: content, // TODO: Phase 4 - Replace with encrypted ciphertext
        contentHash: 'placeholder_hash', // TODO: Phase 4 - Compute actual hash
        interval,
      };

      if (mode === 'create') {
        createCapsule(capsuleData);
      } else if (id) {
        updateCapsule({ id, updates: capsuleData });
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save capsule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-300 mb-6">
        {mode === 'create' ? 'Create Capsule' : 'Edit Capsule'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100 h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100 h-32"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Passphrase
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            At least 8 characters. Never sent to server.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Passphrase
          </label>
          <input
            type="password"
            value={passphraseConfirm}
            onChange={(e) => setPassphraseConfirm(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Check-in Interval
          </label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as any)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:border-purple-500 outline-none text-gray-100"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded font-medium transition"
          >
            {loading ? 'Saving...' : 'Save Capsule'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CapsuleFormPage;
