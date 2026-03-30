import { MouseEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { StompSubscription } from '@stomp/stompjs';
import { v4 as uuid } from 'uuid';
import { CursorEvent, DrawEvent } from '../features/canvas/types';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { upsertCursor } from '../features/presence/presenceSlice';
import { boardService, COMMENTS_ELEMENT_ID, CommentReply, CommentThread, DOC_ELEMENT_ID } from '../services/boardService';
import { websocketService } from '../services/websocketService';
import { debounce } from '../utils/debounce';
import { throttle } from '../utils/throttle';

type Props = {
  boardId: string;
  user: { id: string; name: string };
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
  initialHtml: string;
  initialUpdatedAt: number;
  initialComments: CommentThread[];
  rightPanelWidth: number;
  onRightPanelWidthChange: (value: number) => void;
};

export function DocumentEditor({
  boardId,
  user,
  permission,
  initialHtml,
  initialUpdatedAt,
  initialComments,
  rightPanelWidth,
  onRightPanelWidthChange
}: Props) {
  const dispatch = useAppDispatch();
  const canEdit = permission === 'EDIT';
  const canComment = permission === 'EDIT' || permission === 'COMMENT';
  const offlineKey = 'doc-offline-' + boardId;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const latestHtmlRef = useRef(initialHtml || '<p>Start writing...</p>');
  const latestUpdatedAtRef = useRef(initialUpdatedAt || Date.now());

  const [threads, setThreads] = useState<CommentThread[]>(initialComments || []);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<{ anchorId: string; selectedText: string } | null>(null);
  const [status, setStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [cursors, setCursors] = useState<Record<string, CursorEvent>>({});
  const [docZoom, setDocZoom] = useState(1);

  const toCursorEvent = (payload: any): CursorEvent | null => {
    const source = payload?.cursor ?? payload;
    if (!source) return null;
    const userId = String(source.userId || '').trim();
    const x = Number(source.x);
    const y = Number(source.y);
    if (!userId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      boardId: String(source.boardId || boardId),
      userId,
      name: String(source.name || 'User'),
      color: String(source.color || '#22c55e'),
      mode: source.mode === 'canvas' ? 'canvas' : 'docs',
      x,
      y
    };
  };

  const activeThread = activeThreadId ? threads.find((thread) => thread.id === activeThreadId) || null : null;

  const applyHtmlToEditor = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML === html) return;
    editor.innerHTML = html;
  };

  useEffect(() => {
    const nextHtml = initialHtml || '<p>Start writing...</p>';
    latestHtmlRef.current = nextHtml;
    latestUpdatedAtRef.current = initialUpdatedAt || Date.now();
    setThreads(initialComments || []);
    setCursors({});
    setStatus('saved');
    setCommentText('');
    setReplyText('');
    setPendingAnchor(null);
    setActiveThreadId(null);
    setActiveAnchorId(null);
    savedRangeRef.current = null;
    setDocZoom(1);
    applyHtmlToEditor(nextHtml);
  }, [boardId, initialHtml, initialUpdatedAt, initialComments]);

  useEffect(() => {
    const cached = localStorage.getItem(offlineKey);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as { html: string; updatedAt: number };
      if (parsed.updatedAt > latestUpdatedAtRef.current) {
        latestUpdatedAtRef.current = parsed.updatedAt;
        latestHtmlRef.current = parsed.html;
        applyHtmlToEditor(parsed.html);
      }
    } catch {
      // ignore malformed cache
    }
  }, [offlineKey]);

  const persistDocument = useMemo(
    () =>
      debounce(async (nextHtml: string, nextUpdatedAt: number) => {
        if (!canEdit && !canComment) return;

        if (!navigator.onLine) {
          setStatus('offline');
          localStorage.setItem(offlineKey, JSON.stringify({ html: nextHtml, updatedAt: nextUpdatedAt }));
          return;
        }

        setStatus('saving');
        try {
          await boardService.saveDocument(boardId, nextHtml, nextUpdatedAt, user.id);
          localStorage.removeItem(offlineKey);
          setStatus('saved');
        } catch {
          setStatus('offline');
          localStorage.setItem(offlineKey, JSON.stringify({ html: nextHtml, updatedAt: nextUpdatedAt }));
        }
      }, 700),
    [boardId, canComment, canEdit, offlineKey, user.id]
  );

  useEffect(() => {
    const onOnline = async () => {
      if (!canEdit && !canComment) return;
      const cached = localStorage.getItem(offlineKey);
      if (!cached) return;
      try {
        const parsed = JSON.parse(cached) as { html: string; updatedAt: number };
        await boardService.saveDocument(boardId, parsed.html, parsed.updatedAt, user.id);
        localStorage.removeItem(offlineKey);
        setStatus('saved');
      } catch {
        setStatus('offline');
      }
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [boardId, canComment, canEdit, offlineKey, user.id]);

  useEffect(() => {
    let drawSubscription: StompSubscription | undefined;
    let cursorSubscription: StompSubscription | undefined;

    websocketService.connect(() => {
      drawSubscription = websocketService.subscribe('/topic/board/' + boardId, (event: DrawEvent) => {
        if (!event.shape || event.shape.updatedBy === user.id) return;

        if (event.shape.id === DOC_ELEMENT_ID && event.shape.data?.kind === 'DOCUMENT') {
          const incomingHtml = typeof event.shape.data.html === 'string' ? event.shape.data.html : '';
          if (!incomingHtml) return;
          if (event.shape.updatedAt <= latestUpdatedAtRef.current) return;
          latestUpdatedAtRef.current = event.shape.updatedAt;
          latestHtmlRef.current = incomingHtml;
          applyHtmlToEditor(incomingHtml);
          return;
        }

        if (event.shape.id === COMMENTS_ELEMENT_ID && event.shape.data?.kind === 'COMMENTS' && Array.isArray(event.shape.data.items)) {
          setThreads(event.shape.data.items as CommentThread[]);
        }
      });

      cursorSubscription = websocketService.subscribe('/topic/board/' + boardId + '/cursor', (event: any) => {
        const parsed = toCursorEvent(event);
        if (!parsed) return;
        if (parsed.userId === user.id) return;
        if (parsed.mode === 'canvas') return;
        setCursors((prev) => ({ ...prev, [parsed.userId]: parsed }));
        dispatch(upsertCursor(parsed));
      });
    });

    return () => {
      drawSubscription?.unsubscribe();
      cursorSubscription?.unsubscribe();
      websocketService.disconnect();
    };
  }, [boardId, dispatch, user.id]);

  const publishDocUpdate = (nextHtml: string, nextUpdatedAt: number) => {
    if (!canEdit && !canComment) return;
    websocketService.publish('/app/board/draw', {
      eventType: 'DRAW_EVENT',
      boardId,
      shape: {
        id: DOC_ELEMENT_ID,
        updatedAt: nextUpdatedAt,
        updatedBy: user.id,
        data: { kind: 'DOCUMENT', html: nextHtml }
      }
    });
    persistDocument(nextHtml, nextUpdatedAt);
  };

  const publishCommentsUpdate = (nextThreads: CommentThread[]) => {
    const now = Date.now();
    websocketService.publish('/app/board/draw', {
      eventType: 'DRAW_EVENT',
      boardId,
      shape: {
        id: COMMENTS_ELEMENT_ID,
        updatedAt: now,
        updatedBy: user.id,
        data: { kind: 'COMMENTS', items: nextThreads }
      }
    });
    boardService.saveComments(boardId, nextThreads, now, user.id).catch(() => {
      // retry on next update
    });
  };

  const emitCursor = useMemo(
    () =>
      throttle((clientX: number, clientY: number) => {
        const pane = paneRef.current;
        if (!pane) return;
        const rect = pane.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const normalizedX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const normalizedY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        websocketService.publish('/app/board/cursor', {
          eventType: 'CURSOR_EVENT',
          boardId,
          cursor: {
            boardId,
            userId: user.id,
            name: user.name,
            color: '#22c55e',
            mode: 'docs',
            x: normalizedX,
            y: normalizedY
          }
        });
      }, 40),
    [boardId, user.id, user.name]
  );

  const onInput = () => {
    if (!canEdit) return;
    const nextHtml = editorRef.current?.innerHTML || '<p></p>';
    const nextUpdatedAt = Date.now();
    latestHtmlRef.current = nextHtml;
    latestUpdatedAtRef.current = nextUpdatedAt;
    publishDocUpdate(nextHtml, nextUpdatedAt);
  };

  const runCommand = (command: string, value?: string) => {
    if (!canEdit) return;
    document.execCommand(command, false, value);
    onInput();
  };

  const saveSelectionIfInsideEditor = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || selection.rangeCount === 0 || !editor) {
      savedRangeRef.current = null;
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = null;
      return;
    }
    savedRangeRef.current = range.cloneRange();
  };

  const activateThreadByAnchor = (anchorId: string) => {
    const matched = threads.find((thread) => thread.anchorId === anchorId) || null;
    if (!matched) {
      setActiveAnchorId(null);
      setActiveThreadId(null);
      return;
    }
    setActiveAnchorId(anchorId);
    setActiveThreadId(matched.id);
    focusAnchor(anchorId);
  };

  const createSelectionComment = () => {
    if (!canComment) return;
    const selection = window.getSelection();
    const range = savedRangeRef.current;
    if (!selection || !range || range.collapsed) return;
    const editor = editorRef.current;
    if (!editor || !editor.contains(range.commonAncestorContainer)) return;

    const selectedText = range.toString().trim();
    if (!selectedText) return;

    const anchorId = uuid();
    const marker = document.createElement('span');
    marker.setAttribute('data-comment-anchor', anchorId);
    marker.className = 'comment-highlight';

    try {
      range.surroundContents(marker);
    } catch {
      const contents = range.extractContents();
      marker.appendChild(contents);
      range.insertNode(marker);
    }

    selection.removeAllRanges();
    savedRangeRef.current = null;
    setPendingAnchor({ anchorId, selectedText });
    setActiveAnchorId(anchorId);
    const nextHtml = editor.innerHTML || '<p></p>';
    const nextUpdatedAt = Date.now();
    latestHtmlRef.current = nextHtml;
    latestUpdatedAtRef.current = nextUpdatedAt;
    publishDocUpdate(nextHtml, nextUpdatedAt);
  };

  const addComment = () => {
    if (!pendingAnchor || !commentText.trim()) return;
    const firstReply: CommentReply = {
      id: uuid(),
      text: commentText.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: Date.now()
    };
    const thread: CommentThread = {
      id: uuid(),
      anchorId: pendingAnchor.anchorId,
      selectedText: pendingAnchor.selectedText,
      replies: [firstReply]
    };
    const nextThreads = [...threads, thread];
    setThreads(nextThreads);
    setPendingAnchor(null);
    setCommentText('');
    setActiveThreadId(thread.id);
    setActiveAnchorId(thread.anchorId);
    publishCommentsUpdate(nextThreads);
  };

  const addReply = () => {
    if (!activeThread || !replyText.trim()) return;
    const reply: CommentReply = {
      id: uuid(),
      text: replyText.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: Date.now()
    };
    const nextThreads = threads.map((thread) =>
      thread.id === activeThread.id ? { ...thread, replies: [...thread.replies, reply] } : thread
    );
    setThreads(nextThreads);
    setReplyText('');
    publishCommentsUpdate(nextThreads);
  };

  const onEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const anchorNode = target.closest('[data-comment-anchor]') as HTMLElement | null;
    if (!anchorNode) {
      setActiveThreadId(null);
      setActiveAnchorId(null);
      return;
    }
    const anchorId = anchorNode.getAttribute('data-comment-anchor');
    if (!anchorId) return;
    activateThreadByAnchor(anchorId);
  };

  const focusAnchor = (anchorId: string) => {
    const editor = editorRef.current;
    if (!editor || !anchorId) return;
    const previous = editor.querySelector('.comment-highlight-active') as HTMLElement | null;
    if (previous) previous.classList.remove('comment-highlight-active');
    const node = editor.querySelector(`[data-comment-anchor="${anchorId}"]`) as HTMLElement | null;
    if (node) node.classList.add('comment-highlight-active');
    if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const cursorPosition = (value: number) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 1) {
      return `${numeric * 100}%`;
    }
    if (Number.isFinite(numeric)) {
      return `${Math.max(0, numeric)}px`;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        return `${parsed * 100}%`;
      }
      if (Number.isFinite(parsed)) {
        return `${Math.max(0, parsed)}px`;
      }
    }
    return '0px';
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (activeAnchorId) {
      focusAnchor(activeAnchorId);
      return;
    }
    const current = editor.querySelector('.comment-highlight-active') as HTMLElement | null;
    if (current) current.classList.remove('comment-highlight-active');
  }, [activeAnchorId]);

  const beginRightResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    const maxWidth = Math.max(320, container.clientWidth - 360);

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const next = Math.max(260, Math.min(maxWidth, startWidth - (moveEvent.clientX - startX)));
      onRightPanelWidthChange(next);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div ref={paneRef} className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-10">
          {Object.values(cursors).map((cursor) => (
            <div
              key={cursor.userId}
              className="absolute"
              style={{
                left: cursorPosition(cursor.x),
                top: cursorPosition(cursor.y),
                transform: 'translate(8px, 8px)'
              }}
            >
              <div className="h-3 w-3 rounded-full shadow" style={{ backgroundColor: cursor.color }} />
              <p className="mt-1 rounded bg-black/70 px-1 text-xs text-white">{cursor.name}</p>
            </div>
          ))}
        </div>

        <div className="absolute left-4 right-4 top-20 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-panel/95 p-2 shadow-xl">
          <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium" onClick={() => runCommand('bold')} disabled={!canEdit}>B</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium italic" onClick={() => runCommand('italic')} disabled={!canEdit}>I</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium underline" onClick={() => runCommand('underline')} disabled={!canEdit}>U</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium line-through" onClick={() => runCommand('strikeThrough')} disabled={!canEdit}>S</button>
          <div className="mx-1 h-5 w-px bg-slate-700" />
          <button
            className="rounded bg-amber-600/80 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
            onMouseDown={(event) => event.preventDefault()}
            onClick={createSelectionComment}
            disabled={!canComment}
          >
            Comment Selection
          </button>
          <div className="mx-1 h-5 w-px bg-slate-700" />
          <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium" onClick={() => setDocZoom((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))))}>-</button>
          <span className="w-12 text-center text-xs font-medium text-slate-300">{Math.round(docZoom * 100)}%</span>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs font-medium" onClick={() => setDocZoom((prev) => Math.min(1.8, Number((prev + 0.1).toFixed(2))))}>+</button>
          <span className="ml-auto rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving...' : 'Offline draft'}</span>
        </div>

        <div className="h-full overflow-auto bg-slate-950 px-10 pb-10 pt-36">
          <div style={{ transform: `scale(${docZoom})`, transformOrigin: 'top center', width: `${100 / docZoom}%` }}>
            <div
              ref={editorRef}
              contentEditable={canEdit}
              suppressContentEditableWarning
              onInput={onInput}
              onClick={onEditorClick}
              onMouseUp={saveSelectionIfInsideEditor}
              onKeyUp={saveSelectionIfInsideEditor}
              onMouseMove={(e) => emitCursor(e.clientX, e.clientY)}
              className={'mx-auto min-h-[calc(100vh-10rem)] max-w-4xl rounded-xl border border-slate-700 bg-slate-900 p-10 text-slate-100 shadow-xl outline-none ' + (canEdit || canComment ? 'cursor-text' : 'cursor-default')}
              style={{ lineHeight: 1.6 }}
            />
          </div>
        </div>
      </div>

      <div
        className="w-2 cursor-col-resize bg-transparent hover:bg-accent/30"
        onMouseDown={beginRightResize}
        aria-label="Resize right panel"
        role="separator"
      />

      <aside
        className="overflow-y-auto border-l border-slate-700 bg-panel/95 px-4 pb-4 pt-24"
        style={{ width: rightPanelWidth }}
      >
        <h3 className="mb-1 text-sm font-semibold">Comments</h3>
        <p className="mb-3 text-[11px] text-slate-400">Threaded notes on selected text</p>
        {pendingAnchor && canComment && (
          <div className="mb-3 rounded border border-amber-700/60 bg-amber-900/20 p-2">
            <p className="mb-1 text-xs text-amber-200">New comment for selection</p>
            <p className="mb-2 text-xs text-slate-300">"{pendingAnchor.selectedText}"</p>
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" placeholder="Write your comment" />
            <div className="mt-2 flex gap-2">
              <button className="flex-1 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900" onClick={addComment}>Add</button>
              <button className="rounded border border-slate-600 px-3 py-1.5 text-xs" onClick={() => setPendingAnchor(null)}>Cancel</button>
            </div>
          </div>
        )}

        {activeThread && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-900 p-2">
            <p className="mb-2 text-[11px] text-amber-300">{activeThread.selectedText}</p>
            <div className="max-h-44 space-y-2 overflow-auto">
              {activeThread.replies.map((reply) => (
                <div key={reply.id} className="rounded bg-slate-800 p-2">
                  <p className="text-xs text-slate-200">{reply.text}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{reply.authorName} • {new Date(reply.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
            {canComment && (
              <div className="mt-2 space-y-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs" placeholder="Reply to this thread" />
                <button className="w-full rounded bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900" onClick={addReply}>Reply</button>
              </div>
            )}
          </div>
        )}

        {!pendingAnchor && !activeThread && (
          <div className="mt-2 rounded border border-slate-700 bg-slate-900 p-3">
            <p className="text-xs text-slate-300">Comments stay contextual.</p>
            <p className="mt-1 text-[11px] text-slate-400">Click highlighted text in the document to open its thread.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
