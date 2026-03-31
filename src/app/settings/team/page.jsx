import Link from 'next/link';
import TeamManager from '@/components/TeamManager';

export default function TeamPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/settings"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Team Members</h1>
          <p className="text-sm text-gray-400 mt-1">Manage who has access to your dashboard</p>
        </div>
      </div>

      <TeamManager />
    </div>
  );
}
