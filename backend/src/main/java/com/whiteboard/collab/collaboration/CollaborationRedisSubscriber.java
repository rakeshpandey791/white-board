package com.whiteboard.collab.collaboration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.collab.collaboration.dto.CollaborationMessage;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class CollaborationRedisSubscriber implements MessageListener {
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;

    public CollaborationRedisSubscriber(ObjectMapper objectMapper, SimpMessagingTemplate messagingTemplate) {
        this.objectMapper = objectMapper;
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            CollaborationMessage payload = objectMapper.readValue(message.getBody(), CollaborationMessage.class);
            if ("CURSOR_EVENT".equals(payload.eventType())) {
                messagingTemplate.convertAndSend("/topic/board/" + payload.boardId() + "/cursor", payload.cursor());
                return;
            }
            messagingTemplate.convertAndSend("/topic/board/" + payload.boardId(), payload);
        } catch (Exception ignored) {
        }
    }
}
