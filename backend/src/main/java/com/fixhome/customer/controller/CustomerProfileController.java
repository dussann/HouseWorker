package com.fixhome.customer.controller;

import com.fixhome.customer.entity.CustomerProfile;
import com.fixhome.customer.entity.CustomerProfileRequest;
import com.fixhome.customer.service.CustomerProfileService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/customers")
public class CustomerProfileController {

    private final CustomerProfileService customerProfileService;

    public CustomerProfileController(CustomerProfileService customerProfileService) {
        this.customerProfileService = customerProfileService;
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<CustomerProfile> getProfile() {
        Long userId = getCurrentUserId();
        return ResponseEntity.ok(customerProfileService.getProfile(userId));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<CustomerProfile> updateProfile(@Valid @RequestBody CustomerProfileRequest request) {
        Long userId = getCurrentUserId();
        return ResponseEntity.ok(customerProfileService.createOrUpdateProfile(userId, request));
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof com.fixhome.domain.user.User user)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return user.getId();
    }
}
