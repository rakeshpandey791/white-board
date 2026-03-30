package com.whiteboard.collab.user;

import com.whiteboard.collab.auth.dto.AuthResponse;
import com.whiteboard.collab.config.JwtService;
import com.whiteboard.collab.user.dto.UpdateProfileRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse.UserView getProfile(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return new AuthResponse.UserView(user.getId(), user.getEmail(), user.getName());
    }

    public AuthResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String nextName = request.name() == null ? user.getName() : request.name().trim();
        if (nextName.isBlank()) {
            throw new IllegalArgumentException("Name cannot be blank");
        }

        String nextEmail = request.email() == null ? user.getEmail() : request.email().trim().toLowerCase();
        if (nextEmail.isBlank()) {
            throw new IllegalArgumentException("Email cannot be blank");
        }

        userRepository.findByEmailIgnoreCase(nextEmail).ifPresent(existing -> {
            if (!existing.getId().equals(userId)) {
                throw new IllegalArgumentException("Email already registered");
            }
        });

        boolean wantsPasswordChange = request.newPassword() != null && !request.newPassword().isBlank();
        if (wantsPasswordChange) {
            String currentPassword = request.currentPassword() == null ? "" : request.currentPassword();
            if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect");
            }
            user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        }

        user.setName(nextName);
        user.setEmail(nextEmail);
        UserEntity saved = userRepository.save(user);

        String token = jwtService.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, new AuthResponse.UserView(saved.getId(), saved.getEmail(), saved.getName()));
    }
}
