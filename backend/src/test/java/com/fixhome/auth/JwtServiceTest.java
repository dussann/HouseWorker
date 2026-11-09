package com.fixhome.auth;

import com.fixhome.auth.service.JwtService;
import com.fixhome.domain.user.Role;
import com.fixhome.domain.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    @Test
    void shouldHashPasswordAndVerifyIt() {
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        String rawPassword = "StrongPass123";

        String hash = encoder.encode(rawPassword);

        assertNotNull(hash);
        assertNotEquals(rawPassword, hash);
        assertTrue(encoder.matches(rawPassword, hash));
    }

    @Test
    void shouldCreateTokenWithUserClaims() {
        User user = new User();
        user.setId(7L);
        user.setEmail("petar@test.com");
        user.setPhone("+38160000000");
        user.setRole(Role.CUSTOMER);

        JwtService jwtService = new JwtService();
        String token = jwtService.generateToken(user);

        assertNotNull(token);
        assertFalse(token.isBlank());
        assertEquals("petar@test.com", jwtService.extractUsername(token));
        assertEquals(7L, jwtService.extractUserId(token));
        assertEquals(Role.CUSTOMER.name(), jwtService.extractRole(token));
    }
}
