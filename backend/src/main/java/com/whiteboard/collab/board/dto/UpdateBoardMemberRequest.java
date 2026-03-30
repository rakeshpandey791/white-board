package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardPermission;
import jakarta.validation.constraints.NotNull;

public record UpdateBoardMemberRequest(@NotNull BoardPermission permission) {
}
