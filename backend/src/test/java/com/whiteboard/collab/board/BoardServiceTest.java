package com.whiteboard.collab.board;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.collab.board.dto.SaveElementsRequest;
import com.whiteboard.collab.board.dto.WhiteboardShapeDto;
import com.whiteboard.collab.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BoardServiceTest {
    @Mock
    private BoardRepository boardRepository;
    @Mock
    private BoardMemberRepository boardMemberRepository;
    @Mock
    private BoardElementRepository boardElementRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BoardService boardService;

    private UUID userId;
    private UUID boardId;

    @BeforeEach
    void setup() {
        boardService = new BoardService(boardRepository, boardMemberRepository, boardElementRepository, userRepository, new ObjectMapper());
        userId = UUID.randomUUID();
        boardId = UUID.randomUUID();

        BoardEntity board = new BoardEntity();
        board.setId(boardId);
        board.setName("Test");
        board.setOwnerId(userId);
        board.setCreatedAt(Instant.now());
        board.setUpdatedAt(Instant.now());

        when(boardRepository.findById(boardId)).thenReturn(Optional.of(board));
        when(boardRepository.save(any(BoardEntity.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void saveElementsUpdatesEntity() {
        String elementId = "shape-1";

        BoardElementEntity existing = new BoardElementEntity();
        existing.setId(UUID.randomUUID());
        existing.setBoardId(boardId);
        existing.setElementId(elementId);
        existing.setUpdatedAt(10L);
        existing.setUpdatedBy(userId);
        existing.setPayloadJson("{}");

        when(boardElementRepository.findByBoardIdAndElementId(boardId, elementId)).thenReturn(Optional.of(existing));
        when(boardElementRepository.save(any(BoardElementEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var dto = new WhiteboardShapeDto(elementId, 20L, userId.toString(), Map.of("type", "rect"));
        boardService.saveElements(userId, boardId, new SaveElementsRequest(List.of(dto)));

        assertEquals(20L, existing.getUpdatedAt());
    }
}
