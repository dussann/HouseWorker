package com.fixhome;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class FlywayDatabaseSupportTest {

    @Test
    void shouldHavePostgresFlywayDatabaseSupportOnClasspath() {
        assertDoesNotThrow(() ->
                Class.forName("org.flywaydb.database.postgresql.PostgreSQLDatabaseType"));
    }
}
