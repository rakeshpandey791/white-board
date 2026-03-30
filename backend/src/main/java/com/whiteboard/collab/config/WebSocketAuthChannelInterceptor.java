package com.whiteboard.collab.config;

import com.whiteboard.collab.board.BoardService;
import com.whiteboard.collab.user.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.UUID;

@Component
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final BoardService boardService;

    public WebSocketAuthChannelInterceptor(JwtService jwtService,
                                           UserRepository userRepository,
                                           BoardService boardService) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.boardService = boardService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = firstHeader(accessor, "Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                UUID userId = parseUserId(authHeader.substring(7));
                if (userId != null && userRepository.findById(userId).isPresent()) {
                    accessor.setUser(new StompPrincipal(userId.toString()));
                    return message;
                }
            }
            accessor.setUser(new StompPrincipal("anonymous"));
            return message;
        }

        UUID userId = extractUserId(accessor.getUser());

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            if (userId == null) {
                accessor.setDestination("/topic/denied");
                return message;
            }
            UUID boardId = parseBoardIdFromTopic(accessor.getDestination());
            if (boardId != null && !boardService.hasAccess(userId, boardId)) {
                accessor.setDestination("/topic/denied");
                return message;
            }
        }

        if (StompCommand.SEND.equals(accessor.getCommand())) {
            if (userId == null) {
                accessor.setDestination("/app/denied");
                return message;
            }
        }

        return message;
    }

    private String firstHeader(StompHeaderAccessor accessor, String name) {
        String direct = accessor.getFirstNativeHeader(name);
        if (direct != null) {
            return direct;
        }
        return accessor.getFirstNativeHeader(name.toLowerCase());
    }

    private UUID parseUserId(String token) {
        try {
            Claims claims = jwtService.parseClaims(token);
            return UUID.fromString(claims.getSubject());
        } catch (Exception ignored) {
            return null;
        }
    }

    private UUID extractUserId(Principal principal) {
        if (principal == null) {
            return null;
        }
        try {
            return UUID.fromString(principal.getName());
        } catch (Exception ignored) {
            return null;
        }
    }

    private UUID parseBoardIdFromTopic(String destination) {
        if (destination == null || !destination.startsWith("/topic/board/")) {
            return null;
        }

        String suffix = destination.substring("/topic/board/".length());
        int slashIndex = suffix.indexOf('/');
        String raw = slashIndex >= 0 ? suffix.substring(0, slashIndex) : suffix;
        try {
            return UUID.fromString(raw);
        } catch (Exception ignored) {
            return null;
        }
    }
}
