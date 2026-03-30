import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasBoard } from './components/CanvasBoard';
import { DocumentEditor } from './components/DocumentEditor';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { useAppDispatch } from './hooks/useAppDispatch';
import { useAppSelector } from './hooks/useAppSelector';
import { createBoardThunk, fetchBoardsThunk, loadBoardThunk, saveElementsThunk } from './features/board/boardSlice';
import { canvasActions, selectAllShapes, selectCanvasView } from './features/canvas/canvasSlice';
import { debounce } from './utils/debounce';
import { setActiveUsers } from './features/presence/presenceSlice';
import { loginThunk, logout, setSession, signupThunk } from './features/auth/authSlice';
import { boardService } from './services/boardService';
import { BoardMember, UserSuggestion } from './services/boardService';
import { userService } from './services/userService';

function App() {
  const dispatch = useAppDispatch();
  const boards = useAppSelector((s) => s.board.boards);
  const activeBoard = useAppSelector((s) => s.board.activeBoard);
  const boardError = useAppSelector((s) => s.board.error);
  const boardLoading = useAppSelector((s) => s.board.loading);
  const auth = useAppSelector((s) => s.auth);
  const users = useAppSelector((s) => s.presence.activeUsers);
  const cursors = useAppSelector((s) => Object.values(s.presence.cursors));
  const authUser = auth.user;
  const shapes = useAppSelector(selectAllShapes);
  const { selectedTool, zoom } = useAppSelector(selectCanvasView);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newBoardName, setNewBoardName] = useState('My Board');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'COMMENT' | 'EDIT'>('VIEW');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareSuggestions, setShareSuggestions] = useState<UserSuggestion[]>([]);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [mode, setMode] = useState<'docs' | 'canvas'>('docs');
  const [newBoardAccess, setNewBoardAccess] = useState<'RESTRICTED' | 'PUBLIC'>('RESTRICTED');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('ui_theme') === 'light' ? 'light' : 'dark'));
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const raw = Number(localStorage.getItem('ui_left_panel_width'));
    return Number.isFinite(raw) && raw >= 240 && raw <= 520 ? raw : 288;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const raw = Number(localStorage.getItem('ui_right_panel_width'));
    return Number.isFinite(raw) && raw >= 260 && raw <= 560 ? raw : 320;
  });

  const canEdit = activeBoard?.permissions === 'EDIT';
  const canShare = Boolean(activeBoard && authUser && activeBoard.ownerId === authUser.id);

  useEffect(() => {
    localStorage.setItem('ui_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ui_left_panel_width', String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    localStorage.setItem('ui_right_panel_width', String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) {
        return;
      }
      if (event.target instanceof Node && profileMenuRef.current.contains(event.target)) {
        return;
      }
      setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  useEffect(() => {
    if (auth.token) {
      dispatch(fetchBoardsThunk());
    }
  }, [auth.token, dispatch]);

  useEffect(() => {
    if (!authUser) {
      return;
    }
    dispatch(setActiveUsers([{ userId: authUser.id, name: authUser.name, color: '#34d399' }]));
  }, [authUser, dispatch]);

  useEffect(() => {
    if (!auth.token) {
      return;
    }
    if (boards.length > 0 && !activeBoard) {
      dispatch(loadBoardThunk(boards[0].id)).then((action) => {
        if (loadBoardThunk.fulfilled.match(action)) {
          dispatch(canvasActions.loadShapes(action.payload.elements || []));
        }
      });
    }
  }, [auth.token, boards, activeBoard, dispatch]);

  useEffect(() => {
    if (boardError?.includes('401')) {
      dispatch(logout());
    }
  }, [boardError, dispatch]);

  useEffect(() => {
    if (!canShare) {
      setShareSuggestions([]);
      return;
    }

    const query = shareEmail.trim();
    if (query.length < 1) {
      setShareSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const results = await boardService.searchUsers(query);
        setShareSuggestions(results);
      } catch {
        setShareSuggestions([]);
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [shareEmail, canShare]);

  const autosave = useMemo(
    () =>
      debounce((boardId: string, elements: typeof shapes) => {
        dispatch(saveElementsThunk({ boardId, elements }));
      }, 1000),
    [dispatch]
  );

  useEffect(() => {
    if (!activeBoard || !canEdit) {
      return;
    }
    autosave(activeBoard.id, shapes);
  }, [activeBoard, canEdit, autosave, shapes]);

  useEffect(() => {
    if (!activeBoard) {
      setBoardMembers([]);
      dispatch(canvasActions.loadShapes([]));
      return;
    }

    let mounted = true;
    const loadMembers = async () => {
      try {
        const members = await boardService.getBoardMembers(activeBoard.id);
        if (mounted) {
          setBoardMembers(members);
        }
      } catch {
        if (mounted) {
          setBoardMembers([]);
        }
      }
    };

    loadMembers();
    return () => {
      mounted = false;
    };
  }, [activeBoard, dispatch]);

  const onAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authMode === 'signup') {
      await dispatch(signupThunk({ name, email, password }));
      return;
    }
    await dispatch(loginThunk({ email, password }));
  };

  const openProfileEditor = () => {
    if (!authUser) {
      return;
    }
    setProfileName(authUser.name);
    setProfileEmail(authUser.email);
    setProfileCurrentPassword('');
    setProfileNewPassword('');
    setProfileConfirmPassword('');
    setProfileError(null);
    setProfileModalOpen(true);
  };

  const onProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUser) {
      return;
    }

    const trimmedName = profileName.trim();
    const trimmedEmail = profileEmail.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setProfileError('Name and email are required.');
      return;
    }

    const changingPassword = Boolean(profileNewPassword.trim());
    if (changingPassword && profileNewPassword !== profileConfirmPassword) {
      setProfileError('New password and confirm password do not match.');
      return;
    }
    if (changingPassword && profileNewPassword.length < 8) {
      setProfileError('New password must be at least 8 characters.');
      return;
    }
    if (changingPassword && !profileCurrentPassword) {
      setProfileError('Current password is required to set a new password.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      const response = await userService.updateProfile({
        name: trimmedName,
        email: trimmedEmail,
        currentPassword: changingPassword ? profileCurrentPassword : undefined,
        newPassword: changingPassword ? profileNewPassword : undefined
      });
      dispatch(setSession({ user: response.user, token: response.token }));
      setProfileModalOpen(false);
      setShareMessage('Profile updated successfully');
    } catch (error: any) {
      setProfileError(error?.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const beginLeftResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const next = Math.max(240, Math.min(520, startWidth + (moveEvent.clientX - startX)));
      setLeftPanelWidth(next);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const openBoard = async (boardId: string) => {
    const action = await dispatch(loadBoardThunk(boardId));
    if (loadBoardThunk.fulfilled.match(action)) {
      dispatch(canvasActions.loadShapes(action.payload.elements || []));
    }
  };

  const onCreateBoard = async () => {
    const boardName = newBoardName.trim() || 'New Board';
    const action = await dispatch(createBoardThunk({ name: boardName, accessScope: newBoardAccess }));
    if (createBoardThunk.fulfilled.match(action)) {
      setNewBoardName('My Board');
      await dispatch(fetchBoardsThunk());
      await openBoard(action.payload.id);
    }
  };

  const onShareBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeBoard) {
      return;
    }

    try {
      await boardService.shareBoard(activeBoard.id, { email: shareEmail.trim(), permission: sharePermission });
      setShareEmail('');
      setShareMessage('Board shared successfully');
      setShareSuggestions([]);
      const members = await boardService.getBoardMembers(activeBoard.id);
      setBoardMembers(members);
    } catch (error: any) {
      const apiError = error?.response?.data?.error || error?.message || 'Failed to share board';
      setShareMessage(apiError);
    }
  };

  const refreshMembers = async () => {
    if (!activeBoard) {
      return;
    }
    const members = await boardService.getBoardMembers(activeBoard.id);
    setBoardMembers(members);
  };

  const onChangeMemberPermission = async (memberId: string, permission: 'VIEW' | 'COMMENT' | 'EDIT') => {
    if (!activeBoard) {
      return;
    }
    try {
      await boardService.updateBoardMember(activeBoard.id, memberId, permission);
      await refreshMembers();
    } catch (error: any) {
      setShareMessage(error?.response?.data?.error || 'Failed to update permission');
    }
  };

  const onRemoveMember = async (memberId: string) => {
    if (!activeBoard) {
      return;
    }
    try {
      await boardService.removeBoardMember(activeBoard.id, memberId);
      await refreshMembers();
    } catch (error: any) {
      setShareMessage(error?.response?.data?.error || 'Failed to remove member');
    }
  };

  const onChangeBoardAccess = async (accessScope: 'RESTRICTED' | 'PUBLIC') => {
    if (!activeBoard || !canShare) {
      return;
    }
    try {
      await boardService.updateBoardAccess(activeBoard.id, accessScope);
      await dispatch(fetchBoardsThunk());
      await openBoard(activeBoard.id);
      setShareMessage('Board access updated');
    } catch (error: any) {
      setShareMessage(error?.response?.data?.error || 'Failed to update board access');
    }
  };

  const onDeleteBoard = async (boardId: string, boardName: string) => {
    if (!authUser) {
      return;
    }
    const target = boards.find((board) => board.id === boardId);
    if (!target || target.ownerId !== authUser.id) {
      return;
    }
    setDeleteTarget({ id: boardId, name: boardName });
  };

  const confirmDeleteBoard = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await boardService.deleteBoard(deleteTarget.id);
      setShareMessage('Board deleted');
      const action = await dispatch(fetchBoardsThunk());
      if (fetchBoardsThunk.fulfilled.match(action)) {
        if (action.payload.length > 0) {
          const nextBoard = action.payload[0];
          await openBoard(nextBoard.id);
        } else {
          dispatch(canvasActions.loadShapes([]));
        }
      }
    } catch (error: any) {
      setShareMessage(error?.response?.data?.error || 'Failed to delete board');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!auth.token || !authUser) {
    return (
      <div className={`flex h-full items-center justify-center bg-slate-950 ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
        <button
          type="button"
          className="absolute right-4 top-4 rounded border border-slate-600 bg-slate-900 px-3 py-1 text-xs"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
        </button>
        <form onSubmit={onAuthSubmit} className="w-full max-w-md rounded-xl border border-slate-700 bg-panel p-6 shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold">Whiteboard Collaboration</h1>
          <p className="mb-6 text-sm text-slate-300">Sign in to create and collaborate on boards in real time.</p>
          {authMode === 'signup' && (
            <input
              className="mb-3 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="mb-3 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="mb-4 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {auth.error && <p className="mb-3 text-sm text-rose-400">{auth.error}</p>}
          <button
            className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-slate-900 disabled:opacity-70"
            type="submit"
            disabled={auth.loading}
          >
            {auth.loading ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Login'}
          </button>
          <button
            type="button"
            className="mt-3 w-full text-sm text-slate-300 underline"
            onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
          >
            {authMode === 'signup' ? 'Already have an account? Login' : 'Need an account? Signup'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <aside className="absolute left-0 top-0 z-30 flex h-full flex-col border-r border-slate-700 bg-panel/95 p-4" style={{ width: leftPanelWidth }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Boards</h2>
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-xs font-semibold"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-label="Open user menu"
            >
              {authUser.name.slice(0, 1).toUpperCase()}
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-44 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
                <div className="border-b border-slate-700 px-2 py-2">
                  <p className="truncate text-xs font-semibold">{authUser.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{authUser.email}</p>
                </div>
                <button
                  type="button"
                  className="mt-1 block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800"
                  onClick={() => {
                    openProfileEditor();
                    setProfileMenuOpen(false);
                  }}
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800"
                  onClick={() => {
                    setTheme(theme === 'dark' ? 'light' : 'dark');
                    setProfileMenuOpen(false);
                  }}
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                  onClick={() => dispatch(logout())}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 shrink-0 rounded-lg border border-slate-700 p-3">
          <label className="mb-2 block text-xs text-slate-400">Create board</label>
          <input
            className="mb-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="Board name"
          />
          <select
            className="mb-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            value={newBoardAccess}
            onChange={(e) => setNewBoardAccess(e.target.value as 'RESTRICTED' | 'PUBLIC')}
          >
            <option value="RESTRICTED">Restricted</option>
            <option value="PUBLIC">Public (Viewer access)</option>
          </select>
          <button
            className="w-full rounded bg-accent px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:opacity-70"
            onClick={onCreateBoard}
            disabled={boardLoading}
          >
            {boardLoading ? 'Creating...' : 'Create Board'}
          </button>
          {boardError && <p className="mt-2 text-xs text-rose-400">{boardError}</p>}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {boards.map((board) => (
            <div key={board.id} className="group relative">
              <button
                className={`w-full rounded border px-3 py-2.5 pr-20 text-left text-sm ${
                  activeBoard?.id === board.id ? 'border-accent bg-slate-800' : 'border-slate-700 bg-slate-900'
                }`}
                onClick={() => openBoard(board.id)}
              >
                <p className="truncate font-medium">{board.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{new Date(board.updatedAt).toLocaleString()}</p>
              </button>
              {authUser && board.ownerId === authUser.id && (
                <button
                  type="button"
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-rose-700 px-2 py-1 text-[11px] font-medium text-rose-300 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteBoard(board.id, board.name);
                  }}
                  aria-label={'Delete ' + board.name}
                  title="Delete document"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>

        {activeBoard && (
          <div className="mt-4 shrink-0 rounded-lg border border-slate-700 p-3">
            <p className="mb-2 text-xs text-slate-400">Active board permission</p>
            <p className={`mb-3 inline-block rounded px-2 py-1 text-xs ${canEdit ? 'bg-emerald-700/30 text-emerald-300' : 'bg-amber-700/30 text-amber-300'}`}>
              {activeBoard.permissions}
            </p>
            <p className="mb-3 ml-2 inline-block rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{activeBoard.accessScope}</p>

            {canShare && (
              <div className="mb-3">
                <label className="mb-1 block text-xs text-slate-400">Board visibility</label>
                <select
                  className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                  value={activeBoard.accessScope}
                  onChange={(e) => onChangeBoardAccess(e.target.value as 'RESTRICTED' | 'PUBLIC')}
                >
                  <option value="RESTRICTED">Restricted</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
            )}

            {canShare && (
              <form onSubmit={onShareBoard} className="space-y-2">
                <label className="block text-xs text-slate-400">Share board</label>
                <input
                  className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                  type="email"
                  placeholder="User email"
                  value={shareEmail}
                  onChange={(e) => {
                    setShareEmail(e.target.value);
                    setShareMessage(null);
                  }}
                  required
                />
                {shareSuggestions.length > 0 && (
                  <div className="max-h-32 overflow-auto rounded border border-slate-700 bg-slate-950">
                    {shareSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="block w-full border-b border-slate-800 px-2 py-1 text-left text-xs hover:bg-slate-800"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setShareEmail(suggestion.email);
                          setShareSuggestions([]);
                        }}
                      >
                        <span className="font-medium">{suggestion.name}</span>
                        <span className="ml-2 text-slate-400">{suggestion.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <select
                  className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as 'VIEW' | 'COMMENT' | 'EDIT')}
                >
                  <option value="VIEW">Viewer</option>
                  <option value="COMMENT">Commenter</option>
                  <option value="EDIT">Editor</option>
                </select>
                <button className="w-full rounded bg-slate-200 px-2 py-1 text-sm font-semibold text-slate-900" type="submit">
                  Share
                </button>
                {shareMessage && <p className="text-xs text-slate-300">{shareMessage}</p>}
              </form>
            )}
            {!canShare && canEdit && (
              <p className="text-xs text-slate-400">Only board owner can share permissions.</p>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs text-slate-400">Shared with</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-700 p-2">
                {boardMembers.length === 0 && <p className="text-xs text-slate-500">No members found</p>}
                {boardMembers.map((member) => (
                  <div key={member.userId} className="rounded bg-slate-900 px-2 py-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{member.name}</span>
                      <span className={`rounded px-1 py-0.5 ${member.permission === 'EDIT' ? 'bg-emerald-800/40 text-emerald-300' : 'bg-amber-800/40 text-amber-300'}`}>
                        {member.owner ? 'OWNER' : member.permission}
                      </span>
                    </div>
                    <p className="text-slate-400">{member.email}</p>
                    {canShare && !member.owner && (
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs"
                          value={member.permission}
                          onChange={(e) => onChangeMemberPermission(member.userId, e.target.value as 'VIEW' | 'COMMENT' | 'EDIT')}
                        >
                          <option value="VIEW">VIEW</option>
                          <option value="COMMENT">COMMENT</option>
                          <option value="EDIT">EDIT</option>
                        </select>
                        <button
                          type="button"
                          className="rounded border border-rose-700 px-2 py-0.5 text-xs text-rose-300"
                          onClick={() => onRemoveMember(member.userId)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>

      <div
        className="absolute bottom-0 top-0 z-40 w-2 cursor-col-resize bg-transparent hover:bg-accent/30"
        style={{ left: leftPanelWidth - 1 }}
        onMouseDown={beginLeftResize}
        aria-label="Resize left panel"
        role="separator"
      />

      <div className="relative h-full" style={{ marginLeft: leftPanelWidth, width: `calc(100% - ${leftPanelWidth}px)` }}>
        {mode === 'canvas' && (
          <Toolbar
            selected={selectedTool}
            onSelect={(tool) => dispatch(canvasActions.setTool(tool))}
            onUndo={() => dispatch(canvasActions.undo())}
            onRedo={() => dispatch(canvasActions.redo())}
            zoom={zoom}
            onZoomIn={() => dispatch(canvasActions.setZoom(zoom + 0.1))}
            onZoomOut={() => dispatch(canvasActions.setZoom(zoom - 0.1))}
            canEdit={Boolean(canEdit)}
          />
        )}
        <TopBar
          boardName={activeBoard?.name || 'Select board'}
          users={users}
          mode={mode}
          onModeChange={setMode}
          permission={activeBoard?.permissions}
          accessScope={activeBoard?.accessScope}
          updatedAt={activeBoard?.updatedAt}
        />

        {mode === 'canvas' && <div className="pointer-events-none absolute inset-0 z-10">
          {cursors.filter((cursor) => cursor.mode !== 'docs').map((cursor) => (
            <div
              key={cursor.userId}
              className="absolute"
              style={{ left: Number(cursor.x) + 12, top: Number(cursor.y) + 12 }}
            >
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cursor.color }} />
              <p className="mt-1 rounded bg-black/70 px-1 text-xs text-white">{cursor.name}</p>
            </div>
          ))}
        </div>}

        {!activeBoard ? (
          <div className="flex h-full items-center justify-center">
            <p className="rounded-lg border border-slate-700 bg-panel px-4 py-3 text-slate-300">Create or open a board from the left panel.</p>
          </div>
        ) : (
          mode === 'canvas' ? (
            <CanvasBoard boardId={activeBoard.id} user={authUser} canEdit={Boolean(canEdit)} />
          ) : (
            <DocumentEditor
              boardId={activeBoard.id}
              user={authUser}
              permission={activeBoard.permissions}
              initialHtml={activeBoard.documentHtml}
              initialUpdatedAt={activeBoard.documentUpdatedAt}
              initialComments={activeBoard.comments}
              rightPanelWidth={rightPanelWidth}
              onRightPanelWidthChange={setRightPanelWidth}
            />
          )
        )}
      </div>

      {deleteTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Delete Document?</h3>
            <p className="mt-2 text-sm text-slate-300">
              You are about to permanently delete <span className="font-semibold text-white">{deleteTarget.name}</span>.
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500"
                onClick={confirmDeleteBoard}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {profileModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Edit Profile</h3>
            <p className="mt-1 text-xs text-slate-400">Update your account details. Leave password fields empty if unchanged.</p>

            <form className="mt-4 space-y-3" onSubmit={onProfileSave}>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Name</label>
                <input
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Email</label>
                <input
                  type="email"
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Current Password</label>
                <input
                  type="password"
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                  value={profileCurrentPassword}
                  onChange={(e) => setProfileCurrentPassword(e.target.value)}
                  placeholder="Required only if changing password"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">New Password</label>
                  <input
                    type="password"
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                    value={profileNewPassword}
                    onChange={(e) => setProfileNewPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Confirm Password</label>
                  <input
                    type="password"
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                    value={profileConfirmPassword}
                    onChange={(e) => setProfileConfirmPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
              </div>

              {profileError && <p className="text-xs text-rose-400">{profileError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => setProfileModalOpen(false)}
                  disabled={profileSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:opacity-70"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
