package com.whiteboard.collab.collaboration.dto;

import com.whiteboard.collab.board.dto.WhiteboardShapeDto;

import java.util.Map;
import java.util.UUID;

public record CollaborationMessage(
        String eventType,
        UUID boardId,
        WhiteboardShapeDto shape,
        Map<String, Object> cursor,
        long timestamp
) {
}
