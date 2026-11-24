export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-purple-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Legacy Switch</h1>
          <p className="text-gray-400 text-sm mt-1">
            Digital Dead Man's Switch
          </p>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-800 border border-purple-700 rounded p-6">
          <h2 className="text-xl font-semibold mb-4">
            Planning Phase Complete
          </h2>
          <p className="text-gray-300">
            All specification documents (requirements.md, design.md, tasks.md)
            are ready. Phase 1 implementation is in progress.
          </p>
        </div>
      </main>
    </div>
  );
}
