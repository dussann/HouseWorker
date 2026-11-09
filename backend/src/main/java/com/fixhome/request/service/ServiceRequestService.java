package com.fixhome.request.service;

import com.fixhome.category.entity.Category;
import com.fixhome.category.repository.CategoryRepository;
import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.service.CraftsmanNotifier;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import com.fixhome.offer.repository.OfferRepository;
import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.CraftsmanRequestDetailsResponse;
import com.fixhome.request.entity.ServiceRequestRequest;
import com.fixhome.request.entity.ServiceRequestResponse;
import com.fixhome.request.entity.ServiceRequestStatus;
import org.springframework.transaction.annotation.Transactional;

import com.fixhome.request.repository.ServiceRequestRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ServiceRequestService {

    private final ServiceRequestRepository serviceRequestRepository;
    private final OfferRepository offerRepository;
    private final CategoryRepository categoryRepository;
    private final CraftsmanCategoryRepository craftsmanCategoryRepository;
    private final UserRepository userRepository;
    private final CraftsmanNotifier craftsmanNotifier;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository,
                                OfferRepository offerRepository,
                                CategoryRepository categoryRepository,
                                CraftsmanCategoryRepository craftsmanCategoryRepository,
                                UserRepository userRepository,
                                CraftsmanNotifier craftsmanNotifier) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.offerRepository = offerRepository;
        this.categoryRepository = categoryRepository;
        this.craftsmanCategoryRepository = craftsmanCategoryRepository;
        this.userRepository = userRepository;
        this.craftsmanNotifier = craftsmanNotifier;
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> getMyRequests(Long customerId) {
        return serviceRequestRepository.findByCustomerId(customerId).stream()
                .map(ServiceRequestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> getAvailableRequests(Long craftsmanUserId, String city) {
        if (city == null || city.isBlank()) {
            return List.of();
        }
        List<Long> categoryIds = craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(craftsmanUserId);
        if (categoryIds.isEmpty()) {
            return List.of();
        }
        List<ServiceRequestStatus> openStatuses = List.of(
                ServiceRequestStatus.NEW,
                ServiceRequestStatus.WAITING_FOR_OFFERS);
        List<ServiceRequest> requests = serviceRequestRepository.findAvailableForCraftsman(
                openStatuses,
                city.trim(),
                categoryIds);
        List<Long> requestIds = requests.stream().map(ServiceRequest::getId).toList();
        Set<Long> offeredRequestIds = requestIds.isEmpty()
                ? Set.of()
                : offerRepository.findByCraftsmanUserIdAndRequestIdIn(craftsmanUserId, requestIds).stream()
                        .map(offer -> offer.getRequest().getId())
                        .collect(Collectors.toSet());
        return requests.stream()
                .map(request -> ServiceRequestResponse.from(request, offeredRequestIds.contains(request.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public CraftsmanRequestDetailsResponse getAvailableRequestDetails(Long craftsmanUserId, Long requestId) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(requestId)
                .filter(request -> request.getStatus() == ServiceRequestStatus.NEW
                        || request.getStatus() == ServiceRequestStatus.WAITING_FOR_OFFERS)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        List<Long> categoryIds = craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(craftsmanUserId);
        if (!categoryIds.contains(serviceRequest.getCategory().getId())) {
            throw new IllegalArgumentException("Request not found");
        }
        return CraftsmanRequestDetailsResponse.from(serviceRequest,
                offerRepository.existsByRequestIdAndCraftsmanUserId(requestId, craftsmanUserId));
    }

    @Transactional(readOnly = true)
    public ServiceRequestResponse getRequest(Long customerId, Long requestId) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!serviceRequest.getCustomer().getId().equals(customerId)) {
            throw new IllegalArgumentException("Request not found");
        }

        return ServiceRequestResponse.from(serviceRequest);
    }

    @Transactional
    public ServiceRequestResponse createRequest(Long customerId, ServiceRequestRequest request) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Category category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        ServiceRequest serviceRequest = new ServiceRequest();
        serviceRequest.setCustomer(customer);
        serviceRequest.setCategory(category);
        serviceRequest.setDescription(request.description());
        serviceRequest.setImageUrl(request.imageUrl());
        serviceRequest.setLatitude(request.latitude());
        serviceRequest.setLongitude(request.longitude());
        serviceRequest.setStatus(ServiceRequestStatus.NEW);

        ServiceRequest savedRequest = serviceRequestRepository.save(serviceRequest);
        craftsmanNotifier.notifyMatchingCraftsmen(savedRequest);
        return ServiceRequestResponse.from(savedRequest);
    }

    @Transactional
    public ServiceRequestResponse updateRequest(Long customerId, Long requestId, ServiceRequestRequest request) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!serviceRequest.getCustomer().getId().equals(customerId)) {
            throw new IllegalArgumentException("Request not found");
        }
        if (serviceRequest.getStatus() == ServiceRequestStatus.COMPLETED) {
            throw new IllegalArgumentException("Completed requests cannot be edited");
        }

        Category category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        serviceRequest.setCategory(category);
        serviceRequest.setDescription(request.description());
        serviceRequest.setImageUrl(request.imageUrl());
        return ServiceRequestResponse.from(serviceRequestRepository.save(serviceRequest));
    }

    @Transactional
    public ServiceRequestResponse updateStatus(Long customerId, Long requestId, ServiceRequestStatus status) {
        if (status == null) {
            throw new IllegalArgumentException("Status is required");
        }
        ServiceRequest serviceRequest = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!serviceRequest.getCustomer().getId().equals(customerId)) {
            throw new IllegalArgumentException("Request not found");
        }
        if (serviceRequest.getStatus() == ServiceRequestStatus.COMPLETED) {
            throw new IllegalArgumentException("Completed request status cannot be changed");
        }
        if (status == ServiceRequestStatus.COMPLETED) {
            throw new IllegalArgumentException("Complete and review the accepted job to mark it completed");
        }

        serviceRequest.setStatus(status);
        return ServiceRequestResponse.from(serviceRequestRepository.save(serviceRequest));
    }

    @Transactional
    public void deleteRequest(Long customerId, Long requestId) {
        ServiceRequest serviceRequest = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!serviceRequest.getCustomer().getId().equals(customerId)) {
            throw new IllegalArgumentException("Request not found");
        }
        if (serviceRequest.getStatus() == ServiceRequestStatus.COMPLETED) {
            throw new IllegalArgumentException("Completed requests cannot be deleted");
        }

        offerRepository.deleteByRequestId(requestId);
        serviceRequestRepository.delete(serviceRequest);
    }
}
