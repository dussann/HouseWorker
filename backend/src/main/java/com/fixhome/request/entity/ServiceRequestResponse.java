package com.fixhome.request.entity;

import java.time.LocalDateTime;

public record ServiceRequestResponse(
        Long id,
        Long categoryId,
        String categoryName,
        String city,
        String description,
        String imageUrl,
        ServiceRequestStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean hasOffered
) {

    public static ServiceRequestResponse from(ServiceRequest serviceRequest) {
        return from(serviceRequest, false);
    }

    public static ServiceRequestResponse from(ServiceRequest serviceRequest, boolean hasOffered) {
        return new ServiceRequestResponse(
                serviceRequest.getId(),
                serviceRequest.getCategory().getId(),
                serviceRequest.getCategory().getName(),
                serviceRequest.getCustomer().getCity(),
                serviceRequest.getDescription(),
                serviceRequest.getImageUrl(),
                serviceRequest.getStatus(),
                serviceRequest.getCreatedAt(),
                serviceRequest.getUpdatedAt(),
                hasOffered);
    }
}
