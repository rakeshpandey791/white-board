package com.whiteboard.collab.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseCompatibilityRunner implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DatabaseCompatibilityRunner.class);
    private final JdbcTemplate jdbcTemplate;

    public DatabaseCompatibilityRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        alignBoardMemberPermissionConstraint();
    }

    private void alignBoardMemberPermissionConstraint() {
        try {
            jdbcTemplate.execute("UPDATE board_members SET permission = 'COMMENT' WHERE permission = 'COMMENTER'");
            jdbcTemplate.execute("ALTER TABLE board_members DROP CONSTRAINT IF EXISTS board_members_permission_check");
            jdbcTemplate.execute(
                    "ALTER TABLE board_members " +
                            "ADD CONSTRAINT board_members_permission_check " +
                            "CHECK (permission IN ('VIEW', 'COMMENT', 'EDIT'))"
            );
        } catch (Exception ex) {
            log.warn("Skipping board_members permission compatibility migration: {}", ex.getMessage());
        }
    }
}
