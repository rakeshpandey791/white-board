package com.whiteboard.collab.user;

import com.whiteboard.collab.auth.dto.AuthResponse;
import com.whiteboard.collab.user.dto.UpdateProfileRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository userRepository;
    private final UserService userService;

    public UserController(UserRepository userRepository, UserService userService) {
        this.userRepository = userRepository;
        this.userService = userService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserSearchResponse>> search(@RequestParam(name = "q", defaultValue = "") String query) {
        String trimmed = query.trim();
        if (trimmed.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<UserSearchResponse> results = userRepository.searchByPrefix(trimmed, PageRequest.of(0, 8))
                .stream()
                .map(user -> new UserSearchResponse(user.getId().toString(), user.getEmail(), user.getName()))
                .toList();

        return ResponseEntity.ok(results);
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse.UserView> me(HttpServletRequest request) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    @PutMapping("/me")
    public ResponseEntity<AuthResponse> updateProfile(HttpServletRequest request,
                                                      @Valid @RequestBody UpdateProfileRequest body) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(userService.updateProfile(userId, body));
    }

    private UUID extractUserId(HttpServletRequest request) {
        Object attribute = request.getAttribute("userId");
        if (attribute instanceof UUID userId) {
            return userId;
        }
        return null;
    }

    public record UserSearchResponse(String id, String email, String name) {
    }
}
