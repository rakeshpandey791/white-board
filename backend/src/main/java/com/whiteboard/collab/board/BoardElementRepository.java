package com.whiteboard.collab.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BoardElementRepository extends JpaRepository<BoardElementEntity, UUID> {
    List<BoardElementEntity> findByBoardId(UUID boardId);
    Optional<BoardElementEntity> findByBoardIdAndElementId(UUID boardId, String elementId);
    void deleteByBoardIdAndElementId(UUID boardId, String elementId);
    void deleteByBoardId(UUID boardId);
}
