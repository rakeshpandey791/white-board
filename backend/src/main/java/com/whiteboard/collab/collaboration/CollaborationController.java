package com.whiteboard.collab.collaboration;

import com.whiteboard.collab.board.BoardService;
import com.whiteboard.collab.board.dto.WhiteboardShapeDto;
import com.whiteboard.collab.collaboration.dto.CollaborationMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Controller
public class CollaborationController {
    private final CollaborationRedisPublisher redisPublisher;
    private final BoardService boardService;
    private final SimpMessagingTemplate messagingTemplate;
    private final boolean redisEnabled;

    public CollaborationController(CollaborationRedisPublisher redisPublisher,
                                   BoardService boardService,
                                   SimpMessagingTemplate messagingTemplate,
                                   @Value("${app.redis.enabled:false}") boolean redisEnabled) {
        this.redisPublisher = redisPublisher;
        this.boardService = boardService;
        this.messagingTemplate = messagingTemplate;
        this.redisEnabled = redisEnabled;
    }

    @MessageMapping("/board/draw")
    public void onDrawEvent(CollaborationMessage message, Principal principal) {
        UUID userId = extractUserId(principal);
        if (userId == null || message == null || message.boardId() == null || message.shape() == null) {
            return;
        }
        if (message.shape().id() == null || message.shape().id().isBlank()) {
            return;
        }

        if (!canPublishDraw(userId, message.boardId(), message.shape())) {
            return;
        }

        WhiteboardShapeDto normalizedShape = new WhiteboardShapeDto(
                message.shape().id(),
                message.shape().updatedAt(),
                userId.toString(),
                message.shape().data()
        );
        boardService.applyRealtimeDelta(userId, message.boardId(), normalizedShape);

        CollaborationMessage outbound = new CollaborationMessage(
                "DRAW_EVENT",
                message.boardId(),
                normalizedShape,
                null,
                System.currentTimeMillis()
        );

        if (redisEnabled) {
            redisPublisher.publish(outbound);
            return;
        }

        messagingTemplate.convertAndSend("/topic/board/" + message.boardId(), outbound);
    }

    @MessageMapping("/board/cursor")
    public void onCursorEvent(CollaborationMessage message, Principal principal) {
        UUID userId = extractUserId(principal);
        if (userId == null || message == null || message.boardId() == null) {
            return;
        }
        if (!boardService.hasAccess(userId, message.boardId())) {
            return;
        }

        Map<String, Object> cursor = new HashMap<>();
        if (message.cursor() != null) {
            cursor.putAll(message.cursor());
        }
        cursor.put("boardId", message.boardId().toString());
        cursor.put("userId", userId.toString());

        CollaborationMessage outbound = new CollaborationMessage(
                "CURSOR_EVENT",
                message.boardId(),
                null,
                cursor,
                System.currentTimeMillis()
        );

        if (redisEnabled) {
            redisPublisher.publish(outbound);
            return;
        }

        messagingTemplate.convertAndSend("/topic/board/" + message.boardId() + "/cursor", cursor);
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

    private boolean canPublishDraw(UUID userId, UUID boardId, WhiteboardShapeDto shape) {
        if (shape == null || shape.data() == null) {
            return boardService.canEdit(userId, boardId);
        }
        Object kind = shape.data().get("kind");
        if (kind instanceof String kindValue && ("COMMENTS".equals(kindValue) || "DOCUMENT".equals(kindValue))) {
            return boardService.canComment(userId, boardId);
        }
        return boardService.canEdit(userId, boardId);
    }
}
