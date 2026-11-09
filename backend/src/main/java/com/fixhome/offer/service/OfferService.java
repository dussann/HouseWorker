package com.fixhome.offer.service;

import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.domain.user.Role;
import com.fixhome.offer.entity.Offer;
import com.fixhome.offer.entity.OfferRequest;
import com.fixhome.offer.entity.OfferResponse;
import com.fixhome.offer.entity.OfferStatus;
import com.fixhome.offer.repository.OfferRepository;
import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.ServiceRequestStatus;
import com.fixhome.request.repository.ServiceRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class OfferService {

    private final OfferRepository offerRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final CraftsmanProfileRepository craftsmanProfileRepository;
    private final CraftsmanCategoryRepository craftsmanCategoryRepository;
    private final OfferNotifier offerNotifier;

    public OfferService(OfferRepository offerRepository,
                        ServiceRequestRepository serviceRequestRepository,
                        CraftsmanProfileRepository craftsmanProfileRepository,
                        CraftsmanCategoryRepository craftsmanCategoryRepository,
                        OfferNotifier offerNotifier) {
        this.offerRepository = offerRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.craftsmanProfileRepository = craftsmanProfileRepository;
        this.craftsmanCategoryRepository = craftsmanCategoryRepository;
        this.offerNotifier = offerNotifier;
    }

    @Transactional
    public OfferResponse createOffer(Long craftsmanUserId, OfferRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Offer request is required");
        }

        if (request.requestId() == null) {
            throw new IllegalArgumentException("Request id is required");
        }

        boolean agreeOnSite = Boolean.TRUE.equals(request.agreeOnSite());
        if (agreeOnSite && request.price() != null) {
            throw new IllegalArgumentException("Price must be empty when agreeing on site");
        }
        if (!agreeOnSite && (request.price() == null || request.price().compareTo(BigDecimal.ZERO) <= 0)) {
            throw new IllegalArgumentException("Enter a positive price or agree to discuss it on site");
        }
        if (request.message() != null && request.message().length() > 1000) {
            throw new IllegalArgumentException("Offer message must not exceed 1000 characters");
        }

        ServiceRequest serviceRequest = serviceRequestRepository.findById(request.requestId())
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        CraftsmanProfile craftsman = craftsmanProfileRepository.findByUserId(craftsmanUserId)
                .orElseThrow(() -> new IllegalArgumentException("Craftsman profile not found"));

        boolean hasCategoryAccess = craftsmanCategoryRepository.existsByCraftsmanIdAndCategoryId(
                craftsman.getId(),
                serviceRequest.getCategory().getId()
        );

        if (!hasCategoryAccess) {
            throw new IllegalArgumentException("Craftsman does not provide this category");
        }
        if (serviceRequest.getStatus() == ServiceRequestStatus.ACCEPTED
                || serviceRequest.getStatus() == ServiceRequestStatus.IN_PROGRESS
                || serviceRequest.getStatus() == ServiceRequestStatus.COMPLETED
                || serviceRequest.getStatus() == ServiceRequestStatus.CANCELLED) {
            throw new IllegalArgumentException("This request is no longer accepting offers");
        }

        if (offerRepository.existsByRequestIdAndCraftsmanUserId(serviceRequest.getId(), craftsmanUserId)) {
            throw new IllegalArgumentException("You have already submitted an offer for this request");
        }

        Offer offer = new Offer();
        offer.setRequest(serviceRequest);
        offer.setCraftsman(craftsman);
        offer.setPrice(request.price());
        offer.setMessage(request.message());
        offer.setAgreeOnSite(agreeOnSite);
        offer.setStatus(OfferStatus.PENDING);

        Offer savedOffer = offerRepository.save(offer);
        offerNotifier.notifyCustomerOfOffer(serviceRequest, savedOffer);

        if (serviceRequest.getStatus() == null || serviceRequest.getStatus() == ServiceRequestStatus.NEW) {
            serviceRequest.setStatus(ServiceRequestStatus.WAITING_FOR_OFFERS);
            serviceRequestRepository.save(serviceRequest);
        }

        return OfferResponse.from(savedOffer);
    }

    @Transactional(readOnly = true)
    public List<OfferResponse> getOffersForRequest(Long customerUserId, Long requestId) {
        if (requestId == null) {
            throw new IllegalArgumentException("Request id is required");
        }

        ServiceRequest serviceRequest = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (!serviceRequest.getCustomer().getId().equals(customerUserId)) {
            throw new IllegalArgumentException("Request not found");
        }

        return offerRepository.findByRequestIdOrderByCreatedAtDesc(requestId).stream()
                .map(offer -> OfferResponse.from(offer,
                        offer.getStatus() == OfferStatus.ACCEPTED
                                && serviceRequest.getStatus() != ServiceRequestStatus.CANCELLED))
                .toList();
    }

    @Transactional(readOnly = true)
    public OfferResponse getOffer(Long userId, Role role, Long offerId) {
        if (offerId == null || role == null) {
            throw new IllegalArgumentException("Offer id and user role are required");
        }
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new IllegalArgumentException("Offer not found"));
        if (role == Role.CUSTOMER) {
            if (!offer.getRequest().getCustomer().getId().equals(userId)) {
                throw new IllegalArgumentException("Offer not found");
            }
            return OfferResponse.from(offer,
                    offer.getStatus() == OfferStatus.ACCEPTED
                            && offer.getRequest().getStatus() != ServiceRequestStatus.CANCELLED);
        }
        if (role == Role.CRAFTSMAN) {
            if (!offer.getCraftsman().getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Offer not found");
            }
            return OfferResponse.fromForCraftsman(offer);
        }
        throw new IllegalArgumentException("Offer not found");
    }

    @Transactional
    public OfferResponse acceptOffer(Long customerUserId, Long offerId) {
        if (offerId == null) {
            throw new IllegalArgumentException("Offer id is required");
        }

        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new IllegalArgumentException("Offer not found"));

        if (!offer.getRequest().getCustomer().getId().equals(customerUserId)) {
            throw new IllegalArgumentException("Offer not found");
        }
        if (offer.getStatus() != OfferStatus.PENDING
                || (offer.getRequest().getStatus() != ServiceRequestStatus.NEW
                && offer.getRequest().getStatus() != ServiceRequestStatus.WAITING_FOR_OFFERS)) {
            throw new IllegalArgumentException("This offer is no longer available");
        }

        offer.setStatus(OfferStatus.ACCEPTED);
        Offer savedOffer = offerRepository.save(offer);

        List<Offer> otherOffers = offerRepository.findByRequestId(offer.getRequest().getId());
        for (Offer otherOffer : otherOffers) {
            if (!otherOffer.getId().equals(offerId) && otherOffer.getStatus() != OfferStatus.REJECTED) {
                otherOffer.setStatus(OfferStatus.REJECTED);
            }
        }
        offerRepository.saveAll(otherOffers);

        ServiceRequest serviceRequest = offer.getRequest();
        serviceRequest.setStatus(ServiceRequestStatus.ACCEPTED);
        serviceRequestRepository.save(serviceRequest);

        offerNotifier.notifyCraftsmanOfferAccepted(serviceRequest, savedOffer);
        return OfferResponse.from(savedOffer, true);
    }
}
