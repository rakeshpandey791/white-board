package com.whiteboard.collab.board.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record SaveElementsRequest(
        @NotNull List<WhiteboardShapeDto> elements
) {
}
