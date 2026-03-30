package com.whiteboard.collab.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BoardRepository extends JpaRepository<BoardEntity, UUID> {
    List<BoardEntity> findByOwnerId(UUID ownerId);
    List<BoardEntity> findByAccessScope(BoardAccessScope accessScope);
}
