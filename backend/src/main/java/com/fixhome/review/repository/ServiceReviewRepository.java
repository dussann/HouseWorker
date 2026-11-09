package com.fixhome.review.repository;

import com.fixhome.review.entity.ServiceReview;
import com.fixhome.request.entity.ServiceRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ServiceReviewRepository extends JpaRepository<ServiceReview, Long> {

    boolean existsByRequestId(Long requestId);

    Optional<ServiceReview> findByRequestIdAndCustomerId(Long requestId, Long customerId);

    List<ServiceReview> findByCraftsmanUserIdAndRequestStatusOrderByCreatedAtDesc(
            Long craftsmanUserId,
            ServiceRequestStatus status);

    List<ServiceReview> findByCraftsmanIdAndRequestStatusOrderByCreatedAtDesc(
            Long craftsmanId, ServiceRequestStatus status);

    @Query("select avg(review.rating) from ServiceReview review where review.craftsman.id = :craftsmanId")
    Double findAverageRatingByCraftsmanId(@Param("craftsmanId") Long craftsmanId);
}
