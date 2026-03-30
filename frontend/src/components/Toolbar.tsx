import { Tool } from '../features/canvas/types';

type Props = {
  selected: Tool;
  onSelect: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canEdit: boolean;
};

const tools: Tool[] = ['select', 'pencil', 'rect', 'circle', 'line', 'text', 'eraser'];

export function Toolbar({ selected, onSelect, onUndo, onRedo, zoom, onZoomIn, onZoomOut, canEdit }: Props) {
  return (
    <div className="absolute left-4 top-20 z-20 flex gap-1 rounded-xl border border-slate-700 bg-panel/90 p-2 shadow-xl backdrop-blur">
      {tools.map((tool) => (
        <button
          key={tool}
          onClick={() => onSelect(tool)}
          disabled={!canEdit && tool !== 'select'}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition ${
            selected === tool ? 'bg-accent text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {tool}
        </button>
      ))}
      <div className="mx-1 w-px bg-slate-700" />
      <button onClick={onUndo} disabled={!canEdit} className="rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
        Undo
      </button>
      <button onClick={onRedo} disabled={!canEdit} className="rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
        Redo
      </button>
      <div className="mx-1 w-px bg-slate-700" />
      <button onClick={onZoomOut} className="rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium hover:bg-slate-700">
        -
      </button>
      <span className="w-12 self-center text-center text-xs font-medium text-slate-300">{Math.round(zoom * 100)}%</span>
      <button onClick={onZoomIn} className="rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium hover:bg-slate-700">
        +
      </button>
    </div>
  );
}
