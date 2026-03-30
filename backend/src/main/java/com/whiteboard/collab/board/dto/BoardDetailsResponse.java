package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardAccessScope;
import com.whiteboard.collab.board.BoardPermission;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record BoardDetailsResponse(
        UUID id,
        String name,
        UUID ownerId,
        BoardAccessScope accessScope,
        Instant createdAt,
        Instant updatedAt,
        BoardPermission permissions,
        List<WhiteboardShapeDto> elements
) {
}
