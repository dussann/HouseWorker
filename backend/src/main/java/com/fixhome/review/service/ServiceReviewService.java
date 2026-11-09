package com.fixhome.review.service;

import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.offer.entity.Offer;
import com.fixhome.offer.entity.OfferStatus;
import com.fixhome.offer.repository.OfferRepository;
import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.ServiceRequestStatus;
import com.fixhome.request.repository.ServiceRequestRepository;
import com.fixhome.review.entity.CompletedJobResponse;
import com.fixhome.review.entity.CustomerReview;
import com.fixhome.review.entity.PublicReviewResponse;
import com.fixhome.review.entity.ServiceReview;
import com.fixhome.review.entity.ServiceReviewRequest;
import com.fixhome.review.entity.ServiceReviewResponse;
import com.fixhome.review.repository.ServiceReviewRepository;
import com.fixhome.review.repository.CustomerReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class ServiceReviewService {

    private final ServiceReviewRepository serviceReviewRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final OfferRepository offerRepository;
    private final CraftsmanProfileRepository craftsmanProfileRepository;
    private final CustomerReviewRepository customerReviewRepository;

    public ServiceReviewService(
            ServiceReviewRepository serviceReviewRepository,
            ServiceRequestRepository serviceRequestRepository,
            OfferRepository offerRepository,
            CraftsmanProfileRepository craftsmanProfileRepository,
            CustomerReviewRepository customerReviewRepository) {
        this.serviceReviewRepository = serviceReviewRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.offerRepository = offerRepository;
        this.craftsmanProfileRepository = craftsmanProfileRepository;
        this.customerReviewRepository = customerReviewRepository;
    }

    @Transactional
    public ServiceReviewResponse completeAndReview(Long customerId, Long requestId, ServiceReviewRequest reviewRequest) {
        if (reviewRequest == null || reviewRequest.rating() == null
                || reviewRequest.rating() < 1 || reviewRequest.rating() > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
        if (reviewRequest.comment() != null && reviewRequest.comment().length() > 1000) {
            throw new IllegalArgumentException("Review comment must not exceed 1000 characters");
        }

        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .filter(value -> value.getCustomer().getId().equals(customerId))
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (request.getStatus() != ServiceRequestStatus.ACCEPTED
                && request.getStatus() != ServiceRequestStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Only accepted or in-progress requests can be completed and reviewed");
        }

        Offer acceptedOffer = offerRepository.findByRequestIdAndStatus(requestId, OfferStatus.ACCEPTED)
                .orElseThrow(() -> new IllegalArgumentException("Accepted craftsman offer not found"));
        if (serviceReviewRepository.existsByRequestId(requestId)) {
            throw new IllegalArgumentException("This completed job has already been reviewed");
        }

        ServiceReview review = new ServiceReview();
        review.setRequest(request);
        review.setCustomer(request.getCustomer());
        review.setCraftsman(acceptedOffer.getCraftsman());
        review.setRating(reviewRequest.rating());
        review.setComment(reviewRequest.comment() == null || reviewRequest.comment().isBlank()
                ? null
                : reviewRequest.comment().trim());

        request.setStatus(ServiceRequestStatus.COMPLETED);
        serviceRequestRepository.save(request);
        ServiceReview savedReview = serviceReviewRepository.save(review);
        Double averageRating = serviceReviewRepository.findAverageRatingByCraftsmanId(acceptedOffer.getCraftsman().getId());
        if (averageRating != null) {
            CraftsmanProfile craftsman = acceptedOffer.getCraftsman();
            craftsman.setRating(BigDecimal.valueOf(averageRating).setScale(2, RoundingMode.HALF_UP));
            craftsmanProfileRepository.save(craftsman);
        }
        return ServiceReviewResponse.from(savedReview);
    }

    @Transactional(readOnly = true)
    public ServiceReviewResponse getCustomerReview(Long customerId, Long requestId) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .filter(value -> value.getCustomer().getId().equals(customerId))
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        return serviceReviewRepository.findByRequestIdAndCustomerId(request.getId(), customerId)
                .map(ServiceReviewResponse::from)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<CompletedJobResponse> getCompletedJobs(Long craftsmanUserId) {
        return serviceReviewRepository.findByCraftsmanUserIdAndRequestStatusOrderByCreatedAtDesc(
                        craftsmanUserId,
                        ServiceRequestStatus.COMPLETED)
                .stream()
                .map(review -> CompletedJobResponse.from(review,
                        customerReviewRepository.findByRequestId(review.getRequest().getId())
                                .map(value -> new ServiceReviewResponse(value.getRequest().getId(), value.getRating(),
                                        value.getComment(), value.getCreatedAt()))
                                .orElse(null)))
                .toList();
    }

    @Transactional
    public ServiceReviewResponse reviewCustomer(Long craftsmanUserId, Long requestId, ServiceReviewRequest input) {
        if (input == null || input.rating() == null || input.rating() < 1 || input.rating() > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
        if (input.comment() != null && input.comment().length() > 1000) {
            throw new IllegalArgumentException("Review comment must not exceed 1000 characters");
        }
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .filter(value -> value.getStatus() == ServiceRequestStatus.COMPLETED)
                .orElseThrow(() -> new IllegalArgumentException("Completed request not found"));
        Offer acceptedOffer = offerRepository.findByRequestIdAndStatus(requestId, OfferStatus.ACCEPTED)
                .filter(value -> value.getCraftsman().getUser().getId().equals(craftsmanUserId))
                .orElseThrow(() -> new IllegalArgumentException("Accepted craftsman offer not found"));
        if (customerReviewRepository.existsByRequestId(requestId)) {
            throw new IllegalArgumentException("This customer has already been reviewed for this job");
        }
        CustomerReview review = new CustomerReview();
        review.setRequest(request);
        review.setCustomer(request.getCustomer());
        review.setCraftsman(acceptedOffer.getCraftsman());
        review.setRating(input.rating());
        review.setComment(input.comment() == null || input.comment().isBlank() ? null : input.comment().trim());
        CustomerReview saved = customerReviewRepository.save(review);
        return new ServiceReviewResponse(requestId, saved.getRating(), saved.getComment(), saved.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public List<PublicReviewResponse> getCustomerRatings(Long customerId) {
        return customerReviewRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(PublicReviewResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PublicReviewResponse> getCraftsmanRatings(Long craftsmanId) {
        return serviceReviewRepository.findByCraftsmanIdAndRequestStatusOrderByCreatedAtDesc(
                        craftsmanId, ServiceRequestStatus.COMPLETED).stream()
                .map(PublicReviewResponse::from).toList();
    }
}
