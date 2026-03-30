package com.whiteboard.collab.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BoardMemberRepository extends JpaRepository<BoardMemberEntity, UUID> {
    List<BoardMemberEntity> findByUserId(UUID userId);
    List<BoardMemberEntity> findByBoardId(UUID boardId);
    Optional<BoardMemberEntity> findByBoardIdAndUserId(UUID boardId, UUID userId);
    void deleteByBoardId(UUID boardId);
}
