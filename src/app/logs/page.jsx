import LogViewer from '@/components/LogViewer';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';

export default function LogsPage() {
  return (
    <PageShell>
      <Topbar
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className="pulse-dot" /> Live
          </span>
        }
        title="Logs"
        subtitle="Schedule runs, scans, notifications, AI calls."
      />
      <LogViewer />
    </PageShell>
  );
}
