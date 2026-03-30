package com.whiteboard.collab.auth.dto;

import java.util.UUID;

public record AuthResponse(
        String token,
        UserView user
) {
    public record UserView(UUID id, String email, String name) {}
}
