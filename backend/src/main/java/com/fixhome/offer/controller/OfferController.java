package com.fixhome.offer.controller;

import com.fixhome.offer.entity.OfferRequest;
import com.fixhome.offer.entity.OfferResponse;
import com.fixhome.offer.service.OfferService;
import com.fixhome.domain.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class OfferController {

    private final OfferService offerService;

    public OfferController(OfferService offerService) {
        this.offerService = offerService;
    }

    @PostMapping("/offers")
    @PreAuthorize("hasRole('CRAFTSMAN')")
    public ResponseEntity<OfferResponse> createOffer(@RequestBody OfferRequest request) {
        Long craftsmanId = getCurrentUserId();
        return ResponseEntity.ok(offerService.createOffer(craftsmanId, request));
    }

    @GetMapping("/service-requests/{requestId}/offers")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<List<OfferResponse>> getOffersForRequest(@PathVariable Long requestId) {
        return ResponseEntity.ok(offerService.getOffersForRequest(getCurrentUserId(), requestId));
    }

    @GetMapping("/offers/{offerId}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'CRAFTSMAN')")
    public ResponseEntity<OfferResponse> getOffer(@PathVariable Long offerId) {
        User user = getCurrentUser();
        return ResponseEntity.ok(offerService.getOffer(user.getId(), user.getRole(), offerId));
    }

    @PatchMapping("/offers/{offerId}/accept")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<OfferResponse> acceptOffer(@PathVariable Long offerId) {
        Long customerId = getCurrentUserId();
        return ResponseEntity.ok(offerService.acceptOffer(customerId, offerId));
    }

    private Long getCurrentUserId() {
        return getCurrentUser().getId();
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new IllegalStateException("Authenticated user not found");
        }
        return user;
    }
}
