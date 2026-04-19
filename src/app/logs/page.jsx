import LogViewer from '@/components/LogViewer';

export default function LogsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Logs</h1>
        <p className="text-sm text-gray-400 mt-1">
          Live event feed — schedule runs, scans, notifications, AI calls. Auto-refreshes every 10 seconds.
        </p>
      </div>
      <LogViewer />
    </div>
  );
}
