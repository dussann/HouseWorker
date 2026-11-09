package com.fixhome.craftsman.controller;

import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.entity.CraftsmanProfileRequest;
import com.fixhome.craftsman.entity.CraftsmanNotificationPreferencesRequest;
import com.fixhome.craftsman.entity.CraftsmanNotificationPreferencesResponse;
import com.fixhome.craftsman.entity.ExpoPushTokenRequest;
import com.fixhome.craftsman.service.CraftsmanProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/craftsmen")
public class CraftsmanProfileController {

    private final CraftsmanProfileService craftsmanProfileService;

    public CraftsmanProfileController(CraftsmanProfileService craftsmanProfileService) {
        this.craftsmanProfileService = craftsmanProfileService;
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<CraftsmanProfile> createProfile(@RequestBody CraftsmanProfileRequest request) {
        Long userId = getCurrentUserId();
        return ResponseEntity.ok(craftsmanProfileService.createOrUpdateProfile(userId, request));
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<CraftsmanProfile> getProfile() {
        Long userId = getCurrentUserId();
        return ResponseEntity.ok(craftsmanProfileService.getProfile(userId));
    }

    @GetMapping("/profile/notifications")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<CraftsmanNotificationPreferencesResponse> getNotificationPreferences() {
        return ResponseEntity.ok(craftsmanProfileService.getNotificationPreferences(getCurrentUserId()));
    }

    @PutMapping("/profile/notifications/cities")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<CraftsmanNotificationPreferencesResponse> updateNotificationCities(
            @RequestBody CraftsmanNotificationPreferencesRequest request) {
        return ResponseEntity.ok(craftsmanProfileService.updateNotificationCities(getCurrentUserId(), request));
    }

    @PutMapping("/profile/notifications/push-token")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<Void> updateExpoPushToken(@RequestBody ExpoPushTokenRequest request) {
        craftsmanProfileService.updateExpoPushToken(getCurrentUserId(), request.token());
        return ResponseEntity.noContent().build();
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof com.fixhome.domain.user.User user)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return user.getId();
    }
}
