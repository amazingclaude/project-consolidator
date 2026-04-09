import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import {
  Database,
  ListChecks,
  AlertTriangle,
  Plus,
  X,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  FolderSearch,
  FileText,
  FileCheck,
  FileX,
} from 'lucide-react';

import { useIngestionStatus, useRunIngestion } from '../api/ingestion';
import type { IngestionResult } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';

function Ingestion() {
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useIngestionStatus();

  const mutation = useRunIngestion();

  const [directories, setDirectories] = useState<string[]>([]);
  const [directoryInput, setDirectoryInput] = useState('');
  const [useCache, setUseCache] = useState(true);
  const [batchSize, setBatchSize] = useState(20);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addDirectory = useCallback(() => {
    const trimmed = directoryInput.trim();
    if (trimmed && !directories.includes(trimmed)) {
      setDirectories((prev) => [...prev, trimmed]);
      setDirectoryInput('');
      inputRef.current?.focus();
    }
  }, [directoryInput, directories]);

  const removeDirectory = useCallback((dir: string) => {
    setDirectories((prev) => prev.filter((d) => d !== dir));
  }, []);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDirectory();
      }
    },
    [addDirectory],
  );

  const handleBatchSizeChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        setBatchSize(Math.max(5, Math.min(100, num)));
      }
    },
    [],
  );

  const handleRunIngestion = useCallback(async () => {
    setResult(null);
    setRunError(null);
    try {
      const ingestionResult = await mutation.mutateAsync({
        directories,
        use_cache: useCache,
        batch_size: batchSize,
      });
      setResult(ingestionResult);
      // Status is auto-refetched via the mutation's onSuccess invalidation
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : 'An unexpected error occurred during ingestion',
      );
    }
  }, [mutation, directories, useCache, batchSize]);

  const isRunning = mutation.isPending;
  const hasResult = result !== null;
  const hasRunError = runError !== null;

  // Determine result state for messaging
  const resultAllSkipped = hasResult && result.files_parsed === 0 && result.files_skipped > 0 && result.files_errored === 0;
  const resultHasErrors = hasResult && result.files_errored > 0;
  const resultSuccess = hasResult && result.files_parsed > 0 && result.files_errored === 0;

  if (statusLoading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Data Ingestion"
          subtitle="Import and refresh project files"
        />
        <LoadingState message="Loading database status..." />
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="p-6">
        <PageHeader
          title="Data Ingestion"
          subtitle="Import and refresh project files"
        />
        <ErrorState
          message={statusError instanceof Error ? statusError.message : 'Failed to load ingestion status'}
          onRetry={() => refetchStatus()}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Data Ingestion"
        subtitle="Import and refresh project files"
      />

      {/* Current Database Stats */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Current Database
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Projects"
            value={status?.total_projects ?? 0}
            icon={<Database className="h-5 w-5" />}
          />
          <MetricCard
            label="Tasks"
            value={status?.total_tasks ?? 0}
            icon={<ListChecks className="h-5 w-5" />}
          />
          <MetricCard
            label="Deviations"
            value={status?.total_deviations ?? 0}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* Source Directories */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Source Directories
        </h2>
        <div className="flex items-center gap-2 mb-3">
          <input
            ref={inputRef}
            type="text"
            value={directoryInput}
            onChange={(e) => setDirectoryInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter directory path, e.g. /data/projects"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addDirectory}
            disabled={!directoryInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {directories.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No directories added yet. Add at least one source directory to begin ingestion.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {directories.map((dir) => (
              <span
                key={dir}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-800"
              >
                <FolderSearch className="h-3.5 w-3.5 flex-shrink-0" />
                {dir}
                <button
                  type="button"
                  onClick={() => removeDirectory(dir)}
                  className="ml-0.5 rounded-full p-0.5 text-blue-500 transition-colors hover:bg-blue-200 hover:text-blue-800"
                  aria-label={`Remove ${dir}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Options */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Options
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useCache}
              onChange={(e) => setUseCache(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Skip unchanged files (cache)</span>
          </label>

          <div className="flex items-center gap-2">
            <label htmlFor="batch-size" className="text-sm text-gray-700">
              Batch size
            </label>
            <input
              id="batch-size"
              type="number"
              min={5}
              max={100}
              value={batchSize}
              onChange={(e) => handleBatchSizeChange(e.target.value)}
              className="w-20 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Run Button */}
      <section>
        <button
          type="button"
          onClick={handleRunIngestion}
          disabled={directories.length === 0 || isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              Run Ingestion
            </>
          )}
        </button>
      </section>

      {/* Progress Area */}
      {(isRunning || hasResult || hasRunError) && (
        <section>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">
                  {isRunning ? 'Processing files...' : 'Complete'}
                </span>
                <span className="text-sm text-gray-500">
                  {isRunning ? '' : '100%'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                {isRunning ? (
                  <div
                    className="bg-blue-500 h-2.5 rounded-full animate-pulse"
                    style={{ width: '100%' }}
                  />
                ) : (
                  <div
                    className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            </div>

            {/* Results */}
            {hasResult && (
              <>
                {/* Result metric cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Files Discovered"
                    value={result.files_discovered}
                    icon={<FolderSearch className="h-5 w-5" />}
                  />
                  <MetricCard
                    label="Files Parsed"
                    value={result.files_parsed}
                    icon={<FileCheck className="h-5 w-5" />}
                    className={result.files_parsed > 0 ? 'border-green-200 bg-green-50/30' : ''}
                  />
                  <MetricCard
                    label="Files Skipped"
                    value={result.files_skipped}
                    icon={<FileText className="h-5 w-5" />}
                  />
                  <MetricCard
                    label="Files Errored"
                    value={result.files_errored}
                    icon={<FileX className="h-5 w-5" />}
                    className={result.files_errored > 0 ? 'border-red-200 bg-red-50/30' : ''}
                  />
                </div>

                {/* Error list */}
                {resultHasErrors && result.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-800 mb-2">
                          Ingestion errors ({result.errors.length})
                        </p>
                        <ul className="space-y-1">
                          {result.errors.map((err, i) => (
                            <li key={i} className="text-sm text-red-700 break-all">
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success message */}
                {resultSuccess && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                      <p className="text-sm font-medium text-green-800">
                        Ingestion completed successfully &mdash; {result.files_parsed} file(s) processed
                      </p>
                    </div>
                  </div>
                )}

                {/* All skipped message */}
                {resultAllSkipped && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                      <p className="text-sm font-medium text-blue-800">
                        All files unchanged (skipped via cache)
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Mutation error */}
            {hasRunError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">
                      Ingestion failed
                    </p>
                    <p className="text-sm text-red-700 mt-1">{runError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default Ingestion;
