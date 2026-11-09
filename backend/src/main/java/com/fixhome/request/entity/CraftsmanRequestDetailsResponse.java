package com.fixhome.request.entity;

import java.math.BigDecimal;

public record CraftsmanRequestDetailsResponse(
        Long id,
        Long customerId,
        String categoryName,
        String city,
        String description,
        String imageUrl,
        BigDecimal latitude,
        BigDecimal longitude,
        ServiceRequestStatus status,
        boolean hasOffered
) {
    public static CraftsmanRequestDetailsResponse from(ServiceRequest serviceRequest, boolean hasOffered) {
        return new CraftsmanRequestDetailsResponse(
                serviceRequest.getId(),
                serviceRequest.getCustomer().getId(),
                serviceRequest.getCategory().getName(),
                serviceRequest.getCustomer().getCity(),
                serviceRequest.getDescription(),
                serviceRequest.getImageUrl(),
                serviceRequest.getLatitude(),
                serviceRequest.getLongitude(),
                serviceRequest.getStatus(),
                hasOffered);
    }
}
