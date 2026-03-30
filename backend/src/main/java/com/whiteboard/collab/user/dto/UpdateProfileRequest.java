package com.whiteboard.collab.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(min = 2, max = 80) String name,
        @Email @Size(max = 160) String email,
        String currentPassword,
        @Size(min = 8, max = 120) String newPassword
) {
}
