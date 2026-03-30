package com.whiteboard.collab.board.dto;

import com.whiteboard.collab.board.BoardPermission;

public record BoardMemberResponse(
        String userId,
        String name,
        String email,
        BoardPermission permission,
        boolean owner
) {
}
