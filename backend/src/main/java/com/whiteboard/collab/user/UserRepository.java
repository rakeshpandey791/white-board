package com.whiteboard.collab.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByEmailIgnoreCase(String email);
    long countByEmailContaining(String token);

    @Query("select u from UserEntity u where lower(u.email) like lower(concat(:query, '%')) or lower(u.name) like lower(concat(:query, '%'))")
    List<UserEntity> searchByPrefix(@Param("query") String query, Pageable pageable);
}
