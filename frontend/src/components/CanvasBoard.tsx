import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import { v4 as uuid } from 'uuid';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { canvasActions, selectAllShapes, selectCanvasView } from '../features/canvas/canvasSlice';
import { CursorEvent, DrawEvent, WhiteboardShape } from '../features/canvas/types';
import { throttle } from '../utils/throttle';
import { COMMENTS_ELEMENT_ID, DOC_ELEMENT_ID } from '../services/boardService';
import { websocketService } from '../services/websocketService';
import { upsertCursor } from '../features/presence/presenceSlice';

type Props = {
  boardId: string;
  user: { id: string; name: string };
  canEdit: boolean;
};

export const CanvasBoard = memo(function CanvasBoard({ boardId, user, canEdit }: Props) {
  const dispatch = useAppDispatch();
  const shapes = useAppSelector(selectAllShapes);
  const { selectedTool, selectedShapeId, zoom, pan } = useAppSelector(selectCanvasView);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);

  const [draft, setDraft] = useState<WhiteboardShape | null>(null);
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 800 });

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingPos, setEditingPos] = useState({ x: 0, y: 0 });

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
      color: String(source.color || '#34d399'),
      mode: source.mode === 'docs' ? 'docs' : 'canvas',
      x,
      y
    };
  };

  useEffect(() => {
    const recalc = () => {
      const node = wrapperRef.current;
      if (!node) {
        return;
      }
      setStageSize({ width: node.clientWidth, height: node.clientHeight });
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, []);

  useEffect(() => {
    websocketService.connect(() => {
      websocketService.subscribe(`/topic/board/${boardId}`, (event: DrawEvent) => {
        if (!event.shape || event.shape.updatedBy === user.id) {
          return;
        }
        if (event.shape.id === DOC_ELEMENT_ID || event.shape.id === COMMENTS_ELEMENT_ID || event.shape.data?.kind === 'DOCUMENT' || event.shape.data?.kind === 'COMMENTS') {
          return;
        }
        if (event.shape.data === null) {
          dispatch(canvasActions.removeShape(event.shape.id));
          return;
        }
        dispatch(
          canvasActions.upsertShape({
            ...(event.shape.data as WhiteboardShape),
            id: event.shape.id,
            updatedAt: event.shape.updatedAt,
            updatedBy: event.shape.updatedBy
          })
        );
      });

      websocketService.subscribe(`/topic/board/${boardId}/cursor`, (event: any) => {
        const parsed = toCursorEvent(event);
        if (!parsed) {
          return;
        }
        if (parsed.userId === user.id) {
          return;
        }
        if (parsed.mode === 'docs') {
          return;
        }
        dispatch(upsertCursor(parsed));
      });
    });

    return () => websocketService.disconnect();
  }, [boardId, dispatch, user.id]);

  useEffect(() => {
    if (!selectedShapeId || !transformerRef.current || !stageRef.current) {
      return;
    }
    const node = stageRef.current.findOne(`#shape-${selectedShapeId}`);
    if (node) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedShapeId, shapes]);

  const emitCursor = useMemo(
    () =>
      throttle((position: { x: number; y: number }) => {
        websocketService.publish('/app/board/cursor', {
          eventType: 'CURSOR_EVENT',
          boardId,
          cursor: {
            boardId,
            userId: user.id,
            name: user.name,
            color: '#34d399',
            mode: 'canvas',
            ...position
          }
        });
      }, 30),
    [boardId, user.id, user.name]
  );

  const commitShape = (shape: WhiteboardShape) => {
    if (!canEdit) {
      return;
    }
    dispatch(canvasActions.upsertShape(shape));
    websocketService.publish('/app/board/draw', {
      eventType: 'DRAW_EVENT',
      boardId,
      shape: {
        id: shape.id,
        updatedAt: shape.updatedAt,
        updatedBy: shape.updatedBy,
        data: shape
      }
    } satisfies DrawEvent);
  };

  const startTextEdit = (shape: WhiteboardShape) => {
    setEditingTextId(shape.id);
    setEditingValue(shape.text || '');
    setEditingPos({
      x: shape.x * zoom + pan.x,
      y: shape.y * zoom + pan.y
    });
  };

  const stopTextEdit = (save: boolean) => {
    if (!editingTextId) {
      return;
    }

    if (save && canEdit) {
      const shape = shapes.find((item) => item.id === editingTextId);
      if (shape && shape.type === 'text') {
        commitShape({
          ...shape,
          text: editingValue,
          updatedAt: Date.now(),
          updatedBy: user.id
        });
      }
    }

    setEditingTextId(null);
    setEditingValue('');
  };

  const onMouseDown = (evt: Konva.KonvaEventObject<MouseEvent>) => {
    if (editingTextId) {
      stopTextEdit(true);
    }

    const stage = evt.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaledX = (pointer.x - pan.x) / zoom;
    const scaledY = (pointer.y - pan.y) / zoom;

    if (selectedTool === 'select') {
      const clickedOnEmpty = evt.target === stage;
      if (clickedOnEmpty) {
        dispatch(canvasActions.selectShape(null));
      } else {
        const id = evt.target.id().replace('shape-', '');
        dispatch(canvasActions.selectShape(id));
      }
      return;
    }

    if (!canEdit) {
      return;
    }

    if (selectedTool === 'eraser') {
      const id = evt.target.id().replace('shape-', '');
      if (id && id !== evt.target.getStage()?.id()) {
        dispatch(canvasActions.removeShape(id));
        websocketService.publish('/app/board/draw', {
          eventType: 'DRAW_EVENT',
          boardId,
          shape: { id, updatedBy: user.id, updatedAt: Date.now(), data: null }
        } satisfies DrawEvent);
      }
      return;
    }

    if (selectedTool === 'text') {
      const textShape: WhiteboardShape = {
        id: uuid(),
        type: 'text',
        x: scaledX,
        y: scaledY,
        text: 'Type here',
        stroke: '#e2e8f0',
        strokeWidth: 1,
        updatedAt: Date.now(),
        updatedBy: user.id
      };
      commitShape(textShape);
      startTextEdit(textShape);
      return;
    }

    const base: WhiteboardShape = {
      id: uuid(),
      type: selectedTool === 'pencil' ? 'pencil' : (selectedTool as WhiteboardShape['type']),
      x: scaledX,
      y: scaledY,
      stroke: '#e2e8f0',
      strokeWidth: 2,
      points: selectedTool === 'pencil' || selectedTool === 'line' ? [scaledX, scaledY] : undefined,
      width: selectedTool === 'rect' ? 0 : undefined,
      height: selectedTool === 'rect' ? 0 : undefined,
      radius: selectedTool === 'circle' ? 0 : undefined,
      updatedAt: Date.now(),
      updatedBy: user.id
    };

    setDraft(base);
  };

  const onMouseMove = (evt: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = evt.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    emitCursor(pointer);

    if (!draft) {
      if (draggingCanvas) {
        dispatch(canvasActions.setPan({ x: pan.x + evt.evt.movementX, y: pan.y + evt.evt.movementY }));
      }
      return;
    }

    const x = (pointer.x - pan.x) / zoom;
    const y = (pointer.y - pan.y) / zoom;

    if (draft.type === 'pencil') {
      setDraft((prev) => (prev ? { ...prev, points: [...(prev.points || []), x, y] } : null));
      return;
    }

    if (draft.type === 'line') {
      setDraft((prev) => (prev ? { ...prev, points: [prev.x, prev.y, x, y] } : null));
      return;
    }

    if (draft.type === 'rect') {
      setDraft((prev) => (prev ? { ...prev, width: x - prev.x, height: y - prev.y } : null));
      return;
    }

    if (draft.type === 'circle') {
      const radius = Math.hypot(x - draft.x, y - draft.y);
      setDraft((prev) => (prev ? { ...prev, radius } : null));
    }
  };

  const onMouseUp = () => {
    if (draft) {
      commitShape({ ...draft, updatedAt: Date.now() });
    }
    setDraft(null);
    setDraggingCanvas(false);
  };

  const onWheel = (evt: Konva.KonvaEventObject<WheelEvent>) => {
    evt.evt.preventDefault();
    const direction = evt.evt.deltaY > 0 ? -0.1 : 0.1;
    dispatch(canvasActions.setZoom(zoom + direction));
  };

  const renderShape = (shape: WhiteboardShape) => {
    const commonProps = {
      id: `shape-${shape.id}`,
      draggable: canEdit && selectedTool === 'select',
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const updated = {
          ...shape,
          x: e.target.x(),
          y: e.target.y(),
          updatedAt: Date.now(),
          updatedBy: user.id
        };
        if (canEdit) {
          commitShape(updated);
        }
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        const updated: WhiteboardShape = {
          ...shape,
          x: node.x(),
          y: node.y(),
          updatedAt: Date.now(),
          updatedBy: user.id
        };

        if (shape.type === 'rect') {
          const width = Math.max(5, (shape.width || 0) * node.scaleX());
          const height = Math.max(5, (shape.height || 0) * node.scaleY());
          node.scaleX(1);
          node.scaleY(1);
          if (canEdit) {
            commitShape({ ...updated, width, height });
          }
          return;
        }

        if (shape.type === 'circle') {
          const radius = Math.max(5, (shape.radius || 0) * node.scaleX());
          node.scaleX(1);
          node.scaleY(1);
          if (canEdit) {
            commitShape({ ...updated, radius });
          }
          return;
        }

        if (canEdit) {
          commitShape(updated);
        }
      }
    };

    if (shape.type === 'rect') {
      return (
        <Rect
          key={shape.id}
          {...commonProps}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
        />
      );
    }

    if (shape.type === 'circle') {
      return (
        <Circle
          key={shape.id}
          {...commonProps}
          x={shape.x}
          y={shape.y}
          radius={shape.radius}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
        />
      );
    }

    if (shape.type === 'line' || shape.type === 'pencil') {
      return (
        <Line
          key={shape.id}
          {...commonProps}
          points={shape.points || []}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      );
    }

    return (
      <Text
        key={shape.id}
        {...commonProps}
        x={shape.x}
        y={shape.y}
        text={shape.text || ''}
        fill="#e2e8f0"
        fontSize={20}
        onDblClick={() => {
          if (!canEdit) {
            return;
          }
          startTextEdit(shape);
        }}
        onDblTap={() => {
          if (!canEdit) {
            return;
          }
          startTextEdit(shape);
        }}
      />
    );
  };

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onWheel={onWheel}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          setDraggingCanvas(true);
        }}
        className="bg-slate-950"
      >
        <Layer>
          <Group scaleX={zoom} scaleY={zoom} x={pan.x} y={pan.y}>
            {shapes.map((shape) => renderShape(shape))}
            {draft && renderShape(draft)}
            <Transformer ref={transformerRef} rotateEnabled={false} />
          </Group>
        </Layer>
      </Stage>

      {editingTextId && (
        <textarea
          autoFocus
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => stopTextEdit(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              stopTextEdit(true);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              stopTextEdit(false);
            }
          }}
          className="absolute z-40 min-w-[160px] rounded border border-accent bg-slate-900 px-2 py-1 text-white outline-none"
          style={{
            left: editingPos.x,
            top: editingPos.y,
            fontSize: 20,
            lineHeight: '24px'
          }}
        />
      )}
    </div>
  );
});
