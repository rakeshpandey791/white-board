export type Tool = 'select' | 'pencil' | 'rect' | 'circle' | 'line' | 'text' | 'eraser';

export type ShapeType = 'rect' | 'circle' | 'line' | 'pencil' | 'text';

export type WhiteboardShape = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  updatedAt: number;
  updatedBy: string;
};

export type DrawEvent = {
  eventType: 'DRAW_EVENT';
  boardId: string;
  shape: {
    id: string;
    updatedAt: number;
    updatedBy: string;
    data: Record<string, unknown> | null;
  };
};

export type CursorEvent = {
  boardId: string;
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  mode?: 'canvas' | 'docs';
};

export type CollaborationMessage = DrawEvent | {
  eventType: 'CURSOR_EVENT';
  boardId: string;
  cursor: CursorEvent;
};
