package com.fixhome.review.entity;

import java.time.LocalDateTime;

public record PublicReviewResponse(Integer rating, String comment, LocalDateTime createdAt) {
    public static PublicReviewResponse from(ServiceReview review) {
        return new PublicReviewResponse(review.getRating(), review.getComment(), review.getCreatedAt());
    }

    public static PublicReviewResponse from(CustomerReview review) {
        return new PublicReviewResponse(review.getRating(), review.getComment(), review.getCreatedAt());
    }
}
