import canvasReducer, { canvasActions } from '../features/canvas/canvasSlice';

describe('canvasSlice', () => {
  it('adds and undoes shape changes', () => {
    const shape = {
      id: '1',
      type: 'rect' as const,
      x: 10,
      y: 20,
      width: 100,
      height: 60,
      stroke: '#fff',
      strokeWidth: 2,
      updatedAt: Date.now(),
      updatedBy: 'u1'
    };

    let state = canvasReducer(undefined, canvasActions.upsertShape(shape));
    expect(state.ids.length).toBe(1);

    state = canvasReducer(state, canvasActions.undo());
    expect(state.ids.length).toBe(0);
  });
});
