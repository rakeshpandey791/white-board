import { http } from './http';
import { WhiteboardShape } from '../features/canvas/types';

export const DOC_ELEMENT_ID = '__document__';
export const COMMENTS_ELEMENT_ID = '__comments__';

export type CommentReply = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
};

export type CommentThread = {
  id: string;
  anchorId: string;
  selectedText: string;
  replies: CommentReply[];
  resolved?: boolean;
};

export type BoardSummary = {
  id: string;
  name: string;
  ownerId: string;
  permissions: 'VIEW' | 'COMMENT' | 'EDIT';
  accessScope: 'RESTRICTED' | 'PUBLIC';
  createdAt: string;
  updatedAt: string;
};

export type BoardDetails = BoardSummary & {
  elements: WhiteboardShape[];
  documentHtml: string;
  documentUpdatedAt: number;
  comments: CommentThread[];
};

export type UserSuggestion = {
  id: string;
  email: string;
  name: string;
};

export type BoardMember = {
  userId: string;
  name: string;
  email: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
  owner: boolean;
};

type BackendShape = {
  id: string;
  updatedAt: number;
  updatedBy: string;
  data: Record<string, unknown>;
};

type BackendBoardDetails = BoardSummary & {
  elements: BackendShape[];
};

export const boardService = {
  listBoards: () => http.get<BoardSummary[]>('/boards').then((res) => res.data),
  createBoard: (payload: { name: string; accessScope: 'RESTRICTED' | 'PUBLIC' }) =>
    http.post<BoardSummary>('/boards', payload).then((res) => res.data),
  getBoard: (id: string) =>
    http.get<BackendBoardDetails>('/boards/' + id).then((res) => {
      const knownTypes = new Set(['rect', 'circle', 'line', 'pencil', 'text']);
      let documentHtml = '<p>Start writing...</p>';
      let documentUpdatedAt = 0;
      let comments: CommentThread[] = [];

      const elements = res.data.elements
        .map((element) => {
          if (element.id === DOC_ELEMENT_ID && element.data?.kind === 'DOCUMENT') {
            documentHtml = typeof element.data.html === 'string' ? element.data.html : documentHtml;
            documentUpdatedAt = element.updatedAt;
            return null;
          }
          if (element.id === COMMENTS_ELEMENT_ID && element.data?.kind === 'COMMENTS' && Array.isArray(element.data.items)) {
            const rawItems = element.data.items as any[];
            comments = rawItems
              .map((item) => {
                if (item && Array.isArray(item.replies)) {
                  return {
                    id: String(item.id || ''),
                    anchorId: String(item.anchorId || ''),
                    selectedText: String(item.selectedText || ''),
                    replies: item.replies.map((reply: any) => ({
                      id: String(reply.id || ''),
                      text: String(reply.text || ''),
                      authorId: String(reply.authorId || ''),
                      authorName: String(reply.authorName || ''),
                      createdAt: Number(reply.createdAt || Date.now())
                    })),
                    resolved: Boolean(item.resolved)
                  } as CommentThread;
                }
                if (item && item.text) {
                  return {
                    id: String(item.id || ''),
                    anchorId: '',
                    selectedText: '',
                    replies: [
                      {
                        id: String(item.id || ''),
                        text: String(item.text || ''),
                        authorId: String(item.authorId || ''),
                        authorName: String(item.authorName || ''),
                        createdAt: Number(item.createdAt || Date.now())
                      }
                    ]
                  } as CommentThread;
                }
                return null;
              })
              .filter(Boolean) as CommentThread[];
            return null;
          }
          const shapeData = element.data as WhiteboardShape;
          if (!shapeData || typeof shapeData.type !== 'string' || !knownTypes.has(shapeData.type)) {
            return null;
          }
          return {
            ...shapeData,
            id: element.id,
            updatedAt: element.updatedAt,
            updatedBy: element.updatedBy
          };
        })
        .filter(Boolean) as WhiteboardShape[];

      return {
        ...res.data,
        elements,
        documentHtml,
        documentUpdatedAt,
        comments
      };
    }),
  shareBoard: (id: string, payload: { email: string; permission: 'VIEW' | 'COMMENT' | 'EDIT' }) =>
    http.post('/boards/' + id + '/share', payload).then((res) => res.data),
  getBoardMembers: (id: string) => http.get<BoardMember[]>('/boards/' + id + '/members').then((res) => res.data),
  updateBoardMember: (boardId: string, memberId: string, permission: 'VIEW' | 'COMMENT' | 'EDIT') =>
    http.put('/boards/' + boardId + '/members/' + memberId, { permission }).then((res) => res.data),
  updateBoardAccess: (boardId: string, accessScope: 'RESTRICTED' | 'PUBLIC') =>
    http.put('/boards/' + boardId + '/access', { accessScope }).then((res) => res.data),
  deleteBoard: (boardId: string) => http.delete('/boards/' + boardId).then((res) => res.data),
  removeBoardMember: (boardId: string, memberId: string) =>
    http.delete('/boards/' + boardId + '/members/' + memberId).then((res) => res.data),
  searchUsers: (query: string) =>
    http.get<UserSuggestion[]>('/users/search', { params: { q: query } }).then((res) => res.data),
  saveElements: (id: string, elements: WhiteboardShape[]) =>
    http
      .post('/boards/' + id + '/elements', {
        elements: elements.map((shape) => ({
          id: shape.id,
          updatedAt: shape.updatedAt,
          updatedBy: shape.updatedBy,
          data: shape
        }))
      })
      .then((res) => res.data)
  ,
  saveDocument: (id: string, html: string, updatedAt: number, updatedBy: string) =>
    http
      .post('/boards/' + id + '/elements', {
        elements: [
          {
            id: DOC_ELEMENT_ID,
            updatedAt,
            updatedBy,
            data: { kind: 'DOCUMENT', html }
          }
        ]
      })
      .then((res) => res.data),
  saveComments: (
    id: string,
    items: CommentThread[],
    updatedAt: number,
    updatedBy: string
  ) =>
    http
      .post('/boards/' + id + '/elements', {
        elements: [
          {
            id: COMMENTS_ELEMENT_ID,
            updatedAt,
            updatedBy,
            data: { kind: 'COMMENTS', items }
          }
        ]
      })
      .then((res) => res.data)
};
