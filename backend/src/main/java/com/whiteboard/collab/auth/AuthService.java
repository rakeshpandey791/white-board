package com.whiteboard.collab.auth;

import com.whiteboard.collab.auth.dto.AuthResponse;
import com.whiteboard.collab.auth.dto.LoginRequest;
import com.whiteboard.collab.auth.dto.SignupRequest;
import com.whiteboard.collab.config.JwtService;
import com.whiteboard.collab.user.UserEntity;
import com.whiteboard.collab.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse signup(SignupRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        userRepository.findByEmailIgnoreCase(normalizedEmail).ifPresent(existing -> {
            throw new IllegalArgumentException("Email already registered");
        });

        UserEntity user = new UserEntity();
        user.setEmail(normalizedEmail);
        user.setName(request.name());
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        UserEntity saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, new AuthResponse.UserView(saved.getId(), saved.getEmail(), saved.getName()));
    }

    public AuthResponse login(LoginRequest request) {
        UserEntity user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (passwordEncoder.matches(request.password(), user.getPasswordHash()) == false) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, new AuthResponse.UserView(user.getId(), user.getEmail(), user.getName()));
    }
}
