package com.fixhome.review.entity;

import java.time.LocalDateTime;

public record CompletedJobResponse(
        Long requestId,
        String categoryName,
        String description,
        LocalDateTime completedAt,
        Integer rating,
        String comment,
        ServiceReviewResponse customerReview
) {
    public static CompletedJobResponse from(ServiceReview review) {
        return from(review, null);
    }

    public static CompletedJobResponse from(ServiceReview review, ServiceReviewResponse customerReview) {
        return new CompletedJobResponse(
                review.getRequest().getId(),
                review.getRequest().getCategory().getName(),
                review.getRequest().getDescription(),
                review.getRequest().getUpdatedAt(),
                review.getRating(),
                review.getComment(),
                customerReview);
    }
}
