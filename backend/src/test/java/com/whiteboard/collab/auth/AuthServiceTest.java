package com.whiteboard.collab.auth;

import com.whiteboard.collab.auth.dto.LoginRequest;
import com.whiteboard.collab.auth.dto.SignupRequest;
import com.whiteboard.collab.config.JwtService;
import com.whiteboard.collab.user.UserEntity;
import com.whiteboard.collab.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    private UserEntity user;

    @BeforeEach
    void setup() {
        user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("alice@example.com");
        user.setName("Alice");
        user.setPasswordHash("encoded");
    }

    @Test
    void signupCreatesToken() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        when(userRepository.save(any(UserEntity.class))).thenReturn(user);
        when(jwtService.generateToken(user.getId(), user.getEmail())).thenReturn("jwt");

        var response = authService.signup(new SignupRequest("alice@example.com", "password123", "Alice"));
        assertEquals("jwt", response.token());
        assertEquals("alice@example.com", response.user().email());
    }

    @Test
    void loginRejectsBadPassword() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad", "encoded")).thenReturn(false);

        assertThrows(IllegalArgumentException.class,
                () -> authService.login(new LoginRequest("alice@example.com", "bad")));
    }
}
