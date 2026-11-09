package com.fixhome.review.entity;

import java.time.LocalDateTime;

public record ServiceReviewResponse(
        Long requestId,
        Integer rating,
        String comment,
        LocalDateTime createdAt
) {
    public static ServiceReviewResponse from(ServiceReview review) {
        return new ServiceReviewResponse(
                review.getRequest().getId(),
                review.getRating(),
                review.getComment(),
                review.getCreatedAt());
    }
}
