package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardAccessScope;
import jakarta.validation.constraints.NotNull;

public record UpdateBoardAccessRequest(@NotNull BoardAccessScope accessScope) {
}
