package com.fixhome.offer.repository;

import com.fixhome.offer.entity.Offer;
import com.fixhome.offer.entity.OfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OfferRepository extends JpaRepository<Offer, Long> {

    List<Offer> findByRequestId(Long requestId);

    List<Offer> findByRequestIdOrderByCreatedAtDesc(Long requestId);

    Optional<Offer> findByRequestIdAndStatus(Long requestId, OfferStatus status);

    boolean existsByRequestIdAndCraftsmanUserId(Long requestId, Long craftsmanUserId);

    List<Offer> findByCraftsmanUserIdAndRequestIdIn(Long craftsmanUserId, List<Long> requestIds);

    void deleteByRequestId(Long requestId);
}
