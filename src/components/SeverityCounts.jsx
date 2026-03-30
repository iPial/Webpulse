export default function SeverityCounts({ critical = 0, improvement = 0, optional = 0 }) {
  return (
    <div className="flex gap-3 text-xs">
      {critical > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {critical} critical
        </span>
      )}
      {improvement > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          {improvement} to improve
        </span>
      )}
      {optional > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {optional} optional
        </span>
      )}
      {critical === 0 && improvement === 0 && optional === 0 && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          All passing
        </span>
      )}
    </div>
  );
}
