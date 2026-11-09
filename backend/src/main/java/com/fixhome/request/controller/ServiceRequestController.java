package com.fixhome.request.controller;

import com.fixhome.request.entity.ServiceRequestRequest;
import com.fixhome.request.entity.ServiceRequestResponse;
import com.fixhome.request.entity.ServiceRequestStatusRequest;
import com.fixhome.request.entity.CraftsmanRequestDetailsResponse;
import com.fixhome.request.service.ServiceRequestService;
import com.fixhome.domain.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class ServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    public ServiceRequestController(ServiceRequestService serviceRequestService) {
        this.serviceRequestService = serviceRequestService;
    }

    @PostMapping("/service-requests")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ServiceRequestResponse> createRequest(@RequestBody ServiceRequestRequest request) {
        Long customerId = getCurrentUserId();
        return ResponseEntity.ok(serviceRequestService.createRequest(customerId, request));
    }

    @GetMapping("/service-requests/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<List<ServiceRequestResponse>> getMyRequests() {
        Long customerId = getCurrentUserId();
        return ResponseEntity.ok(serviceRequestService.getMyRequests(customerId));
    }

    @GetMapping("/service-requests/available")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<List<ServiceRequestResponse>> getAvailableRequests(
            @RequestParam(required = false) String city) {
        User craftsman = getCurrentUser();
        String searchCity = city == null || city.isBlank() ? craftsman.getCity() : city;
        return ResponseEntity.ok(serviceRequestService.getAvailableRequests(craftsman.getId(), searchCity));
    }

    @GetMapping("/service-requests/available/{id}")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<CraftsmanRequestDetailsResponse> getAvailableRequestDetails(@PathVariable Long id) {
        return ResponseEntity.ok(serviceRequestService.getAvailableRequestDetails(getCurrentUser().getId(), id));
    }

    @GetMapping("/service-requests/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ServiceRequestResponse> getRequest(@PathVariable Long id) {
        Long customerId = getCurrentUserId();
        return ResponseEntity.ok(serviceRequestService.getRequest(customerId, id));
    }

    @PutMapping("/service-requests/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ServiceRequestResponse> updateRequest(
            @PathVariable Long id,
            @RequestBody ServiceRequestRequest request) {
        Long customerId = getCurrentUserId();
        return ResponseEntity.ok(serviceRequestService.updateRequest(customerId, id, request));
    }

    @DeleteMapping("/service-requests/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<Void> deleteRequest(@PathVariable Long id) {
        Long customerId = getCurrentUserId();
        serviceRequestService.deleteRequest(customerId, id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/service-requests/{id}/status")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ServiceRequestResponse> updateStatus(
            @PathVariable Long id,
            @RequestBody ServiceRequestStatusRequest request) {
        Long customerId = getCurrentUserId();
        return ResponseEntity.ok(serviceRequestService.updateStatus(customerId, id, request.status()));
    }

    private Long getCurrentUserId() {
        return getCurrentUser().getId();
    }

    private com.fixhome.domain.user.User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof com.fixhome.domain.user.User user)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return user;
    }
}
