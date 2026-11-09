package com.fixhome.review.controller;

import com.fixhome.domain.user.User;
import com.fixhome.review.entity.CompletedJobResponse;
import com.fixhome.review.entity.PublicReviewResponse;
import com.fixhome.review.entity.ServiceReviewRequest;
import com.fixhome.review.entity.ServiceReviewResponse;
import com.fixhome.review.service.ServiceReviewService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class ServiceReviewController {

    private final ServiceReviewService serviceReviewService;

    public ServiceReviewController(ServiceReviewService serviceReviewService) {
        this.serviceReviewService = serviceReviewService;
    }

    @PostMapping("/service-requests/{id}/completion-review")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ServiceReviewResponse> completeAndReview(
            @PathVariable Long id,
            @Valid @RequestBody ServiceReviewRequest request) {
        return ResponseEntity.ok(serviceReviewService.completeAndReview(getCurrentUser().getId(), id, request));
    }

    @GetMapping("/service-requests/{id}/review")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ServiceReviewResponse> getCustomerReview(@PathVariable Long id) {
        return ResponseEntity.ok(serviceReviewService.getCustomerReview(getCurrentUser().getId(), id));
    }

    @GetMapping("/craftsmen/profile/completed-jobs")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<List<CompletedJobResponse>> getCompletedJobs() {
        return ResponseEntity.ok(serviceReviewService.getCompletedJobs(getCurrentUser().getId()));
    }

    @PostMapping("/service-requests/{id}/customer-review")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<ServiceReviewResponse> reviewCustomer(
            @PathVariable Long id, @Valid @RequestBody ServiceReviewRequest request) {
        return ResponseEntity.ok(serviceReviewService.reviewCustomer(getCurrentUser().getId(), id, request));
    }

    @GetMapping("/customers/profile/reviews")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<List<PublicReviewResponse>> getMyCustomerRatings() {
        return ResponseEntity.ok(serviceReviewService.getCustomerRatings(getCurrentUser().getId()));
    }

    @GetMapping("/customers/{id}/reviews")
    public ResponseEntity<List<PublicReviewResponse>> getCustomerRatings(@PathVariable Long id) {
        return ResponseEntity.ok(serviceReviewService.getCustomerRatings(id));
    }

    @GetMapping("/craftsmen/{id}/reviews")
    public ResponseEntity<List<PublicReviewResponse>> getCraftsmanRatings(@PathVariable Long id) {
        return ResponseEntity.ok(serviceReviewService.getCraftsmanRatings(id));
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return user;
    }
}
