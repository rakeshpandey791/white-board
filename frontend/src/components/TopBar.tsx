import { useMemo } from 'react';

type Props = {
  boardName: string;
  users: { userId: string; name: string; color: string }[];
  mode: 'docs' | 'canvas';
  onModeChange: (mode: 'docs' | 'canvas') => void;
  permission?: 'VIEW' | 'COMMENT' | 'EDIT';
  accessScope?: 'RESTRICTED' | 'PUBLIC';
  updatedAt?: string;
};

export function TopBar({ boardName, users, mode, onModeChange, permission, accessScope, updatedAt }: Props) {
  const displayUsers = useMemo(() => users.slice(0, 4), [users]);
  const remainingUsers = Math.max(0, users.length - displayUsers.length);
  const onlineCount = users.length;
  const formattedUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString() : null;

  return (
    <header className="absolute left-4 right-4 top-4 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-700 bg-panel/90 px-3 py-2 shadow-lg backdrop-blur">
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 p-1">
          <button
            className={`rounded px-3 py-1 text-xs font-medium ${mode === 'docs' ? 'bg-accent text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => onModeChange('docs')}
          >
            Docs
          </button>
          <button
            className={`rounded px-3 py-1 text-xs font-medium ${mode === 'canvas' ? 'bg-accent text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => onModeChange('canvas')}
          >
            Canvas
          </button>
      </div>

      <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-100" title={boardName || 'Untitled'}>
            {boardName || 'Untitled'}
          </p>
          {permission && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              permission === 'EDIT'
                ? 'bg-emerald-700/30 text-emerald-300'
                : permission === 'COMMENT'
                  ? 'bg-amber-700/30 text-amber-300'
                  : 'bg-slate-700/70 text-slate-200'
            }`}>
              {permission}
            </span>
          )}
          {accessScope && (
            <span className="shrink-0 rounded bg-slate-700/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
              {accessScope}
            </span>
          )}
          <span className="shrink-0 rounded bg-cyan-700/25 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
            Live
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          <span>{onlineCount} collaborator{onlineCount === 1 ? '' : 's'} online</span>
          {formattedUpdatedAt && <span>Updated {formattedUpdatedAt}</span>}
        </div>
      </div>

      {displayUsers.length > 0 && (
        <div className="flex shrink-0 items-center -space-x-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1">
          {displayUsers.map((user) => (
            <div
              key={user.userId}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-900 text-xs font-semibold text-white"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {remainingUsers > 0 && (
            <div
              className="ml-1 flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 px-2 text-[10px] font-semibold text-slate-200"
              title={`${remainingUsers} more collaborators`}
            >
              +{remainingUsers}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
