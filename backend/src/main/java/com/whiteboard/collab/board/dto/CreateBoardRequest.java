package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardAccessScope;
import jakarta.validation.constraints.NotBlank;

public record CreateBoardRequest(
        @NotBlank String name,
        BoardAccessScope accessScope
) {
}
