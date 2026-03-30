package com.whiteboard.collab.board.dto;

import java.util.Map;

public record WhiteboardShapeDto(
        String id,
        long updatedAt,
        String updatedBy,
        Map<String, Object> data
) {
}
