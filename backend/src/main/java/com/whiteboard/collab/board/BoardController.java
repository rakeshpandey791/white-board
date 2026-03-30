package com.whiteboard.collab.board;

import com.whiteboard.collab.board.dto.BoardDetailsResponse;
import com.whiteboard.collab.board.dto.BoardMemberResponse;
import com.whiteboard.collab.board.dto.BoardSummaryResponse;
import com.whiteboard.collab.board.dto.CreateBoardRequest;
import com.whiteboard.collab.board.dto.SaveElementsRequest;
import com.whiteboard.collab.board.dto.ShareBoardRequest;
import com.whiteboard.collab.board.dto.UpdateBoardAccessRequest;
import com.whiteboard.collab.board.dto.UpdateBoardMemberRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/boards")
public class BoardController {
    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    @GetMapping
    public ResponseEntity<List<BoardSummaryResponse>> listBoards(jakarta.servlet.http.HttpServletRequest request) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(boardService.listBoards(userId));
    }

    @PostMapping
    public ResponseEntity<BoardSummaryResponse> createBoard(jakarta.servlet.http.HttpServletRequest request,
                                                            @Valid @RequestBody CreateBoardRequest body) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(boardService.createBoard(userId, body));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BoardDetailsResponse> getBoard(jakarta.servlet.http.HttpServletRequest request,
                                                         @PathVariable UUID id) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(boardService.getBoard(userId, id));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<BoardMemberResponse>> getBoardMembers(jakarta.servlet.http.HttpServletRequest request,
                                                                     @PathVariable UUID id) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(boardService.getBoardMembers(userId, id));
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<Void> shareBoard(jakarta.servlet.http.HttpServletRequest request,
                                           @PathVariable UUID id,
                                           @Valid @RequestBody ShareBoardRequest body) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        boardService.shareBoard(userId, id, body);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> updateBoardMember(jakarta.servlet.http.HttpServletRequest request,
                                                  @PathVariable UUID id,
                                                  @PathVariable UUID memberId,
                                                  @Valid @RequestBody UpdateBoardMemberRequest body) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        boardService.updateBoardMember(userId, id, memberId, body);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/access")
    public ResponseEntity<Void> updateBoardAccess(jakarta.servlet.http.HttpServletRequest request,
                                                  @PathVariable UUID id,
                                                  @Valid @RequestBody UpdateBoardAccessRequest body) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        boardService.updateBoardAccess(userId, id, body);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeBoardMember(jakarta.servlet.http.HttpServletRequest request,
                                                  @PathVariable UUID id,
                                                  @PathVariable UUID memberId) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        boardService.removeBoardMember(userId, id, memberId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBoard(jakarta.servlet.http.HttpServletRequest request,
                                            @PathVariable UUID id) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        boardService.deleteBoard(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/elements")
    public ResponseEntity<Void> saveElements(jakarta.servlet.http.HttpServletRequest request,
                                             @PathVariable UUID id,
                                             @Valid @RequestBody SaveElementsRequest body) {
        UUID userId = extractUserId(request);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        boardService.saveElements(userId, id, body);
        return ResponseEntity.accepted().build();
    }

    private UUID extractUserId(jakarta.servlet.http.HttpServletRequest request) {
        Object attribute = request.getAttribute("userId");
        if (attribute instanceof UUID userId) {
            return userId;
        }
        return null;
    }
}
