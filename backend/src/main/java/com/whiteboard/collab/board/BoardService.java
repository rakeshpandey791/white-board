package com.whiteboard.collab.board;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.collab.board.dto.BoardDetailsResponse;
import com.whiteboard.collab.board.dto.BoardMemberResponse;
import com.whiteboard.collab.board.dto.BoardSummaryResponse;
import com.whiteboard.collab.board.dto.CreateBoardRequest;
import com.whiteboard.collab.board.dto.SaveElementsRequest;
import com.whiteboard.collab.board.dto.ShareBoardRequest;
import com.whiteboard.collab.board.dto.UpdateBoardAccessRequest;
import com.whiteboard.collab.board.dto.UpdateBoardMemberRequest;
import com.whiteboard.collab.board.dto.WhiteboardShapeDto;
import com.whiteboard.collab.user.UserEntity;
import com.whiteboard.collab.user.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BoardService {
    private final BoardRepository boardRepository;
    private final BoardMemberRepository boardMemberRepository;
    private final BoardElementRepository boardElementRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public BoardService(BoardRepository boardRepository,
                        BoardMemberRepository boardMemberRepository,
                        BoardElementRepository boardElementRepository,
                        UserRepository userRepository,
                        ObjectMapper objectMapper) {
        this.boardRepository = boardRepository;
        this.boardMemberRepository = boardMemberRepository;
        this.boardElementRepository = boardElementRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    public List<BoardSummaryResponse> listBoards(UUID userId) {
        Set<UUID> boardIds = new HashSet<>();
        boardRepository.findByOwnerId(userId).forEach(b -> boardIds.add(b.getId()));
        boardMemberRepository.findByUserId(userId).forEach(m -> boardIds.add(m.getBoardId()));
        boardRepository.findByAccessScope(BoardAccessScope.PUBLIC).forEach(b -> boardIds.add(b.getId()));

        List<BoardSummaryResponse> result = new ArrayList<>();
        for (UUID id : boardIds) {
            boardRepository.findById(id).ifPresent(board -> {
                if (hasAccess(userId, id)) {
                    result.add(toSummary(userId, board));
                }
            });
        }
        result.sort(Comparator.comparing(BoardSummaryResponse::updatedAt).reversed());
        return result;
    }

    @Transactional
    public BoardSummaryResponse createBoard(UUID userId, CreateBoardRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("Unauthorized");
        }

        userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        BoardEntity board = new BoardEntity();
        board.setName(request.name());
        board.setOwnerId(userId);
        board.setAccessScope(request.accessScope() == null ? BoardAccessScope.RESTRICTED : request.accessScope());

        BoardEntity saved = boardRepository.save(board);

        BoardMemberEntity ownerMembership = new BoardMemberEntity();
        ownerMembership.setBoardId(saved.getId());
        ownerMembership.setUserId(userId);
        ownerMembership.setPermission(BoardPermission.EDIT);
        boardMemberRepository.save(ownerMembership);

        return toSummary(userId, saved);
    }

    public BoardDetailsResponse getBoard(UUID userId, UUID boardId) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        BoardPermission permission = resolvePermission(userId, board);
        List<WhiteboardShapeDto> elements = loadElements(boardId);

        return new BoardDetailsResponse(
                board.getId(),
                board.getName(),
                board.getOwnerId(),
                board.getAccessScope(),
                board.getCreatedAt(),
                board.getUpdatedAt(),
                permission,
                elements
        );
    }

    public List<BoardMemberResponse> getBoardMembers(UUID userId, UUID boardId) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        resolvePermission(userId, board);

        List<BoardMemberEntity> members = boardMemberRepository.findByBoardId(boardId);
        Set<UUID> userIds = members.stream().map(BoardMemberEntity::getUserId).collect(Collectors.toSet());
        userIds.add(board.getOwnerId());

        Map<UUID, UserEntity> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getId, user -> user));

        Map<UUID, BoardPermission> perms = members.stream().collect(
                Collectors.toMap(BoardMemberEntity::getUserId, BoardMemberEntity::getPermission, (a, b) -> b)
        );

        return userIds.stream()
                .map(id -> {
                    UserEntity user = usersById.get(id);
                    if (user == null) {
                        return null;
                    }
                    boolean owner = id.equals(board.getOwnerId());
                    BoardPermission permission = owner ? BoardPermission.EDIT : perms.getOrDefault(id, BoardPermission.VIEW);
                    return new BoardMemberResponse(
                            id.toString(),
                            user.getName(),
                            user.getEmail(),
                            permission,
                            owner
                    );
                })
                .filter(member -> member != null)
                .sorted(Comparator.comparing(BoardMemberResponse::owner).reversed().thenComparing(BoardMemberResponse::name))
                .toList();
    }

    @Transactional
    public void shareBoard(UUID requesterId, UUID boardId, ShareBoardRequest request) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId().equals(requesterId) == false) {
            throw new AccessDeniedException("Only owner can share");
        }

        UserEntity targetUser = userRepository.findByEmail(request.email().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BoardMemberEntity membership = boardMemberRepository.findByBoardIdAndUserId(boardId, targetUser.getId())
                .orElseGet(BoardMemberEntity::new);

        membership.setBoardId(boardId);
        membership.setUserId(targetUser.getId());
        membership.setPermission(request.permission());
        boardMemberRepository.save(membership);
    }

    @Transactional
    public void updateBoardMember(UUID requesterId, UUID boardId, UUID targetUserId, UpdateBoardMemberRequest request) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId().equals(requesterId) == false) {
            throw new AccessDeniedException("Only owner can update permissions");
        }
        if (board.getOwnerId().equals(targetUserId)) {
            throw new IllegalArgumentException("Owner permission cannot be changed");
        }

        BoardMemberEntity membership = boardMemberRepository.findByBoardIdAndUserId(boardId, targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Board member not found"));
        membership.setPermission(request.permission());
        boardMemberRepository.save(membership);
    }

    @Transactional
    public void updateBoardAccess(UUID requesterId, UUID boardId, UpdateBoardAccessRequest request) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId().equals(requesterId) == false) {
            throw new AccessDeniedException("Only owner can update access");
        }

        board.setAccessScope(request.accessScope());
        boardRepository.save(board);
    }

    @Transactional
    public void removeBoardMember(UUID requesterId, UUID boardId, UUID targetUserId) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (board.getOwnerId().equals(requesterId) == false) {
            throw new AccessDeniedException("Only owner can remove members");
        }
        if (board.getOwnerId().equals(targetUserId)) {
            throw new IllegalArgumentException("Owner cannot be removed");
        }

        BoardMemberEntity membership = boardMemberRepository.findByBoardIdAndUserId(boardId, targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Board member not found"));
        boardMemberRepository.delete(membership);
    }

    @Transactional
    public void deleteBoard(UUID requesterId, UUID boardId) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));

        if (!board.getOwnerId().equals(requesterId)) {
            throw new AccessDeniedException("Only owner can delete board");
        }

        boardElementRepository.deleteByBoardId(boardId);
        boardMemberRepository.deleteByBoardId(boardId);
        boardRepository.delete(board);
    }

    @Transactional
    public void saveElements(UUID userId, UUID boardId, SaveElementsRequest request) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));
        BoardPermission permission = resolvePermission(userId, board);

        for (WhiteboardShapeDto dto : request.elements()) {
            if (!canMutateShape(permission, dto)) {
                throw new AccessDeniedException("No edit permission");
            }
            if (dto.data() == null) {
                boardElementRepository.deleteByBoardIdAndElementId(boardId, dto.id());
                continue;
            }

            BoardElementEntity entity = boardElementRepository.findByBoardIdAndElementId(boardId, dto.id())
                    .orElseGet(BoardElementEntity::new);

            if (entity.getUpdatedAt() > dto.updatedAt()) {
                continue;
            }

            entity.setBoardId(boardId);
            entity.setElementId(dto.id());
            entity.setUpdatedAt(dto.updatedAt());
            entity.setUpdatedBy(UUID.fromString(dto.updatedBy()));
            entity.setPayloadJson(writeJson(dto.data()));
            boardElementRepository.save(entity);
        }

        board.setUpdatedAt(Instant.now());
        boardRepository.save(board);
    }

    @Transactional
    public void applyRealtimeDelta(UUID userId, UUID boardId, WhiteboardShapeDto dto) {
        BoardEntity board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("Board not found"));
        BoardPermission permission = resolvePermission(userId, board);
        if (!canMutateShape(permission, dto)) {
            throw new AccessDeniedException("No edit permission");
        }
        if (dto.data() == null) {
            boardElementRepository.deleteByBoardIdAndElementId(boardId, dto.id());
            return;
        }

        BoardElementEntity entity = boardElementRepository.findByBoardIdAndElementId(boardId, dto.id())
                .orElseGet(BoardElementEntity::new);
        if (entity.getUpdatedAt() > dto.updatedAt()) {
            return;
        }

        entity.setBoardId(boardId);
        entity.setElementId(dto.id());
        entity.setUpdatedAt(dto.updatedAt());
        entity.setUpdatedBy(userId);
        entity.setPayloadJson(writeJson(dto.data()));
        boardElementRepository.save(entity);
    }

    public boolean hasAccess(UUID userId, UUID boardId) {
        BoardEntity board = boardRepository.findById(boardId).orElse(null);
        if (board == null) {
            return false;
        }
        try {
            resolvePermission(userId, board);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    public boolean canEdit(UUID userId, UUID boardId) {
        BoardEntity board = boardRepository.findById(boardId).orElse(null);
        if (board == null) {
            return false;
        }
        try {
            return resolvePermission(userId, board) == BoardPermission.EDIT;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    public boolean canComment(UUID userId, UUID boardId) {
        BoardEntity board = boardRepository.findById(boardId).orElse(null);
        if (board == null) {
            return false;
        }
        try {
            BoardPermission permission = resolvePermission(userId, board);
            return permission == BoardPermission.EDIT || permission == BoardPermission.COMMENT;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private BoardPermission resolvePermission(UUID userId, BoardEntity board) {
        if (board.getOwnerId().equals(userId)) {
            return BoardPermission.EDIT;
        }
        BoardPermission permission = boardMemberRepository.findByBoardIdAndUserId(board.getId(), userId)
                .map(BoardMemberEntity::getPermission)
                .orElse(null);
        if (permission != null) {
            return permission;
        }
        if (board.getAccessScope() == BoardAccessScope.PUBLIC) {
            return BoardPermission.VIEW;
        }
        throw new AccessDeniedException("No board access");
    }

    private boolean canMutateShape(BoardPermission permission, WhiteboardShapeDto dto) {
        if (permission == BoardPermission.EDIT) {
            return true;
        }
        if (permission != BoardPermission.COMMENT) {
            return false;
        }
        if (dto == null || dto.data() == null) {
            return false;
        }
        Object kind = dto.data().get("kind");
        if (!(kind instanceof String kindValue)) {
            return false;
        }
        return "COMMENTS".equals(kindValue) || "DOCUMENT".equals(kindValue);
    }

    private List<WhiteboardShapeDto> loadElements(UUID boardId) {
        return boardElementRepository.findByBoardId(boardId)
                .stream()
                .map(entity -> new WhiteboardShapeDto(
                        entity.getElementId(),
                        entity.getUpdatedAt(),
                        entity.getUpdatedBy().toString(),
                        readJson(entity.getPayloadJson())
                ))
                .toList();
    }

    private Map<String, Object> readJson(String value) {
        try {
            return objectMapper.readValue(value, new TypeReference<>() {});
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse element JSON", e);
        }
    }

    private String writeJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write element JSON", e);
        }
    }

    private BoardSummaryResponse toSummary(UUID userId, BoardEntity board) {
        BoardPermission permission = resolvePermission(userId, board);
        return new BoardSummaryResponse(
                board.getId(),
                board.getName(),
                board.getOwnerId(),
                permission,
                board.getAccessScope(),
                board.getCreatedAt(),
                board.getUpdatedAt()
        );
    }
}
