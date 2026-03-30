package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardPermission;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

public record ShareBoardRequest(
        @Email String email,
        @NotNull BoardPermission permission
) {
}
