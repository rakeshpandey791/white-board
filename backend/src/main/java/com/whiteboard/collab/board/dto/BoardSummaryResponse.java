package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardAccessScope;
import com.whiteboard.collab.board.BoardPermission;

import java.time.Instant;
import java.util.UUID;

public record BoardSummaryResponse(
        UUID id,
        String name,
        UUID ownerId,
        BoardPermission permissions,
        BoardAccessScope accessScope,
        Instant createdAt,
        Instant updatedAt
) {
}
