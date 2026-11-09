package com.fixhome.request;

import com.fixhome.category.entity.Category;
import com.fixhome.category.repository.CategoryRepository;
import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.service.CraftsmanNotifier;
import com.fixhome.domain.user.Role;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import com.fixhome.offer.repository.OfferRepository;
import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.ServiceRequestRequest;
import com.fixhome.request.entity.ServiceRequestResponse;
import com.fixhome.request.entity.ServiceRequestStatus;
import com.fixhome.request.entity.CraftsmanRequestDetailsResponse;
import com.fixhome.request.repository.ServiceRequestRepository;
import com.fixhome.request.service.ServiceRequestService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceRequestServiceTest {

    @Mock
    private ServiceRequestRepository serviceRequestRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private CraftsmanCategoryRepository craftsmanCategoryRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CraftsmanNotifier craftsmanNotifier;

    @Mock
    private OfferRepository offerRepository;

    @InjectMocks
    private ServiceRequestService serviceRequestService;

    @Test
    void shouldReturnOnlyRequestsOpenForOffers() {
        Category category = new Category();
        category.setId(3L);
        category.setName("Plumber");
        User customer = new User();
        customer.setId(5L);
        customer.setCity("Belgrade");

        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setCategory(category);
        request.setDescription("Leaking pipe");
        request.setStatus(ServiceRequestStatus.NEW);

        List<ServiceRequestStatus> openStatuses = List.of(
                ServiceRequestStatus.NEW,
                ServiceRequestStatus.WAITING_FOR_OFFERS);
        when(craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(17L)).thenReturn(List.of(3L));
        when(serviceRequestRepository.findAvailableForCraftsman(openStatuses, "Belgrade", List.of(3L)))
                .thenReturn(List.of(request));

        List<ServiceRequestResponse> responses = serviceRequestService.getAvailableRequests(17L, "Belgrade");

        assertEquals(1, responses.size());
        assertEquals(15L, responses.get(0).id());
        assertEquals("Belgrade", responses.get(0).city());
        assertEquals(ServiceRequestStatus.NEW, responses.get(0).status());
    }

    @Test
    void shouldFilterAvailableRequestsByCityIgnoringCase() {
        User customer = new User();
        customer.setId(5L);
        customer.setCity("Novi Sad");
        Category category = new Category();
        category.setId(3L);
        category.setName("Plumber");
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setCategory(category);
        request.setDescription("Leaking pipe");
        request.setStatus(ServiceRequestStatus.NEW);
        List<ServiceRequestStatus> openStatuses = List.of(
                ServiceRequestStatus.NEW,
                ServiceRequestStatus.WAITING_FOR_OFFERS);

        when(craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(17L)).thenReturn(List.of(3L));
        when(serviceRequestRepository.findAvailableForCraftsman(
                openStatuses,
                "Novi Sad",
                List.of(3L))).thenReturn(List.of(request));

        List<ServiceRequestResponse> responses = serviceRequestService.getAvailableRequests(17L, "  Novi Sad  ");

        assertEquals(1, responses.size());
        assertEquals("Novi Sad", responses.get(0).city());
        verify(serviceRequestRepository).findAvailableForCraftsman(
                openStatuses,
                "Novi Sad",
                List.of(3L));
    }

    @Test
    void shouldReturnLocationOnlyForDetailsOfAnOpenRequest() {
        User customer = new User();
        customer.setId(5L);
        customer.setCity("Novi Sad");
        Category category = new Category();
        category.setId(3L);
        category.setName("Plumber");
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setCategory(category);
        request.setDescription("Leaking pipe");
        request.setLatitude(new BigDecimal("45.2671"));
        request.setLongitude(new BigDecimal("19.8335"));
        request.setStatus(ServiceRequestStatus.NEW);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));
        when(craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(17L)).thenReturn(List.of(3L));

        CraftsmanRequestDetailsResponse details = serviceRequestService.getAvailableRequestDetails(17L, 15L);

        assertEquals("Novi Sad", details.city());
        assertEquals(new BigDecimal("45.2671"), details.latitude());
        assertEquals(new BigDecimal("19.8335"), details.longitude());
        assertEquals("Leaking pipe", details.description());
    }

    @Test
    void shouldNotReturnJobsWhenCraftsmanHasNoCategories() {
        when(craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(17L)).thenReturn(List.of());

        assertTrue(serviceRequestService.getAvailableRequests(17L, "Novi Sad").isEmpty());
        verifyNoInteractions(serviceRequestRepository);
    }

    @Test
    void shouldNotReturnDetailsForUnselectedCategory() {
        Category category = new Category();
        category.setId(4L);
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCategory(category);
        request.setStatus(ServiceRequestStatus.NEW);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));
        when(craftsmanCategoryRepository.findCategoryIdsByCraftsmanUserId(17L)).thenReturn(List.of(3L));

        assertThrows(IllegalArgumentException.class,
                () -> serviceRequestService.getAvailableRequestDetails(17L, 15L));
    }

    @Test
    void shouldNotExposeLocationDetailsForClosedRequest() {
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setStatus(ServiceRequestStatus.COMPLETED);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceRequestService.getAvailableRequestDetails(17L, 15L));
    }

    @Test
    void shouldReturnRequestForOwner() {
        User customer = new User();
        customer.setId(7L);
        customer.setRole(Role.CUSTOMER);

        Category category = new Category();
        category.setId(3L);
        category.setName("Plumber");

        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setCategory(category);
        request.setDescription("Leaking pipe");
        request.setLatitude(new BigDecimal("44.7866"));
        request.setLongitude(new BigDecimal("20.4489"));
        request.setStatus(ServiceRequestStatus.NEW);

        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        ServiceRequestResponse response = serviceRequestService.getRequest(customer.getId(), request.getId());

        assertNotNull(response);
        assertEquals(15L, response.id());
        assertEquals("Plumber", response.categoryName());
        assertEquals(ServiceRequestStatus.NEW, response.status());
    }

    @Test
    void shouldCreateRequestWithOpenStatus() {
        User customer = new User();
        customer.setId(7L);
        customer.setCity("Novi Sad");

        Category category = new Category();
        category.setId(3L);
        category.setName("Vodoinstalater");

        when(userRepository.findById(7L)).thenReturn(Optional.of(customer));
        when(categoryRepository.findById(3L)).thenReturn(Optional.of(category));
        when(serviceRequestRepository.save(any(ServiceRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ServiceRequestResponse response = serviceRequestService.createRequest(
                7L,
                new ServiceRequestRequest(3L, "Curi slavina", null, null, null));

        assertEquals(ServiceRequestStatus.NEW, response.status());
        verify(serviceRequestRepository).save(argThat(request -> request.getStatus() == ServiceRequestStatus.NEW));
        verify(craftsmanNotifier).notifyMatchingCraftsmen(any(ServiceRequest.class));
    }

    @Test
    void shouldRejectChangingStatusForNonOwner() {
        User customer = new User();
        customer.setId(7L);

        User anotherCustomer = new User();
        anotherCustomer.setId(9L);

        Category category = new Category();
        category.setId(4L);
        category.setName("Electrician");

        ServiceRequest request = new ServiceRequest();
        request.setId(25L);
        request.setCustomer(anotherCustomer);
        request.setCategory(category);
        request.setDescription("No power");
        request.setStatus(ServiceRequestStatus.NEW);

        when(serviceRequestRepository.findById(25L)).thenReturn(Optional.of(request));

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> serviceRequestService.updateStatus(customer.getId(), request.getId(), ServiceRequestStatus.WAITING_FOR_OFFERS)
        );

        assertEquals("Request not found", exception.getMessage());
    }

    @Test
    void shouldDeleteOwnedRequestAndItsOffers() {
        User customer = new User();
        customer.setId(7L);

        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);

        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        serviceRequestService.deleteRequest(customer.getId(), request.getId());

        verify(offerRepository).deleteByRequestId(15L);
        verify(serviceRequestRepository).delete(request);
    }

    @Test
    void shouldNotDeleteRequestOwnedByAnotherCustomer() {
        User customer = new User();
        customer.setId(7L);
        User anotherCustomer = new User();
        anotherCustomer.setId(9L);

        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(anotherCustomer);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceRequestService.deleteRequest(customer.getId(), request.getId()));

        verifyNoInteractions(offerRepository);
        verify(serviceRequestRepository, never()).delete(request);
    }

    @Test
    void shouldUpdateOwnedRequestAndPreserveItsStoredLocation() {
        User customer = new User();
        customer.setId(7L);
        Category previousCategory = new Category();
        previousCategory.setId(3L);
        previousCategory.setName("Plumber");
        Category updatedCategory = new Category();
        updatedCategory.setId(4L);
        updatedCategory.setName("Electrician");

        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setCategory(previousCategory);
        request.setDescription("Old description");
        request.setImageUrl("/old-image.jpg");
        request.setLatitude(new BigDecimal("44.7866"));
        request.setLongitude(new BigDecimal("20.4489"));
        request.setStatus(ServiceRequestStatus.NEW);

        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));
        when(categoryRepository.findById(4L)).thenReturn(Optional.of(updatedCategory));
        when(serviceRequestRepository.save(request)).thenReturn(request);

        ServiceRequestResponse response = serviceRequestService.updateRequest(
                7L,
                15L,
                new ServiceRequestRequest(4L, "Updated description", "/new-image.jpg", null, null));

        assertEquals("Updated description", response.description());
        assertEquals("/new-image.jpg", response.imageUrl());
        assertEquals("Electrician", response.categoryName());
        assertEquals(new BigDecimal("44.7866"), request.getLatitude());
        assertEquals(new BigDecimal("20.4489"), request.getLongitude());
        assertEquals(ServiceRequestStatus.NEW, response.status());
    }

    @Test
    void shouldNotUpdateRequestOwnedByAnotherCustomer() {
        User anotherCustomer = new User();
        anotherCustomer.setId(9L);
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(anotherCustomer);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceRequestService.updateRequest(
                        7L,
                        15L,
                        new ServiceRequestRequest(4L, "Updated", null, null, null)));

        verifyNoInteractions(categoryRepository);
        verify(serviceRequestRepository, never()).save(request);
    }

    @Test
    void shouldRequireReviewWhenCompletingRequest() {
        User customer = new User();
        customer.setId(7L);
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.IN_PROGRESS);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceRequestService.updateStatus(7L, 15L, ServiceRequestStatus.COMPLETED));
        verify(serviceRequestRepository, never()).save(request);
    }

    @Test
    void shouldNotDeleteCompletedRequest() {
        User customer = new User();
        customer.setId(7L);
        ServiceRequest request = new ServiceRequest();
        request.setId(15L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.COMPLETED);
        when(serviceRequestRepository.findById(15L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceRequestService.deleteRequest(7L, 15L));
        verifyNoInteractions(offerRepository);
        verify(serviceRequestRepository, never()).delete(request);
    }
}
