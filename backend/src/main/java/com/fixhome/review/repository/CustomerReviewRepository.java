package com.fixhome.review.repository;

import com.fixhome.review.entity.CustomerReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerReviewRepository extends JpaRepository<CustomerReview, Long> {
    boolean existsByRequestId(Long requestId);
    Optional<CustomerReview> findByRequestId(Long requestId);
    List<CustomerReview> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
}
