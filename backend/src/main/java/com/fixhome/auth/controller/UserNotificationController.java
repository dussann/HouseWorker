package com.fixhome.auth.controller;

import com.fixhome.auth.entity.PushNotificationStatus;
import com.fixhome.craftsman.entity.ExpoPushTokenRequest;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/profile/push-token")
public class UserNotificationController {

    private final UserRepository userRepository;

    public UserNotificationController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<PushNotificationStatus> getPushNotificationStatus() {
        User user = getCurrentUser();
        return ResponseEntity.ok(new PushNotificationStatus(user.getExpoPushToken() != null));
    }

    @PutMapping
    public ResponseEntity<PushNotificationStatus> updatePushToken(@RequestBody ExpoPushTokenRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Push token request is required");
        }
        if (request.token() != null && !isValidExpoToken(request.token())) {
            throw new IllegalArgumentException("A valid Expo push token is required");
        }
        User user = getCurrentUser();
        user.setExpoPushToken(request.token());
        userRepository.save(user);
        return ResponseEntity.ok(new PushNotificationStatus(user.getExpoPushToken() != null));
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return user;
    }

    private boolean isValidExpoToken(String token) {
        return token.length() <= 255
                && (token.startsWith("ExpoPushToken[") || token.startsWith("ExponentPushToken["))
                && token.endsWith("]")
                && token.indexOf(']') == token.length() - 1
                && token.indexOf('[') < token.length() - 2;
    }
}
