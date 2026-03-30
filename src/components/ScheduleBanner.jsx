export default function ScheduleBanner() {
  return (
    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-center gap-2 text-sm text-blue-400 mb-6">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <span>
        Automated scans run <strong>daily at 6:00 AM UTC</strong>. Weekly sites scan on Mondays, monthly on the 1st.
      </span>
    </div>
  );
}
