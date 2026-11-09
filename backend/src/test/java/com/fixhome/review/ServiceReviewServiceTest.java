package com.fixhome.review;

import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.domain.user.User;
import com.fixhome.offer.entity.Offer;
import com.fixhome.offer.entity.OfferStatus;
import com.fixhome.offer.repository.OfferRepository;
import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.ServiceRequestStatus;
import com.fixhome.request.repository.ServiceRequestRepository;
import com.fixhome.review.entity.ServiceReviewRequest;
import com.fixhome.review.repository.ServiceReviewRepository;
import com.fixhome.review.repository.CustomerReviewRepository;
import com.fixhome.review.entity.CustomerReview;
import com.fixhome.review.service.ServiceReviewService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceReviewServiceTest {

    @Mock
    private ServiceReviewRepository serviceReviewRepository;

    @Mock
    private ServiceRequestRepository serviceRequestRepository;

    @Mock
    private OfferRepository offerRepository;

    @Mock
    private CraftsmanProfileRepository craftsmanProfileRepository;

    @Mock
    private CustomerReviewRepository customerReviewRepository;

    @InjectMocks
    private ServiceReviewService serviceReviewService;

    @Test
    void shouldCompleteAcceptedJobAndSaveCustomerReview() {
        User customer = new User();
        customer.setId(10L);
        User craftsmanUser = new User();
        craftsmanUser.setId(20L);
        CraftsmanProfile craftsman = new CraftsmanProfile();
        craftsman.setId(30L);
        craftsman.setUser(craftsmanUser);
        ServiceRequest request = new ServiceRequest();
        request.setId(40L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.ACCEPTED);
        Offer acceptedOffer = new Offer();
        acceptedOffer.setCraftsman(craftsman);

        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));
        when(offerRepository.findByRequestIdAndStatus(40L, OfferStatus.ACCEPTED))
                .thenReturn(Optional.of(acceptedOffer));
        when(serviceReviewRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(serviceReviewRepository.findAverageRatingByCraftsmanId(30L)).thenReturn(5.0);

        var response = serviceReviewService.completeAndReview(
                10L,
                40L,
                new ServiceReviewRequest(5, "Odlično obavljen posao"));

        assertEquals(ServiceRequestStatus.COMPLETED, request.getStatus());
        assertEquals(40L, response.requestId());
        assertEquals(5, response.rating());
        assertEquals("Odlično obavljen posao", response.comment());
        verify(serviceRequestRepository).save(request);
        verify(serviceReviewRepository).save(argThat(review ->
                review.getCustomer() == customer
                        && review.getCraftsman() == craftsman
                        && review.getRating() == 5));
        assertEquals(new java.math.BigDecimal("5.00"), craftsman.getRating());
        verify(craftsmanProfileRepository).save(craftsman);
    }

    @Test
    void shouldRejectRatingOutsideOneToFive() {
        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.completeAndReview(10L, 40L, new ServiceReviewRequest(6, null)));
        verifyNoInteractions(serviceRequestRepository, offerRepository, serviceReviewRepository);
    }

    @Test
    void shouldRejectReviewWhenRequestBelongsToAnotherCustomer() {
        User anotherCustomer = new User();
        anotherCustomer.setId(11L);
        ServiceRequest request = new ServiceRequest();
        request.setId(40L);
        request.setCustomer(anotherCustomer);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.completeAndReview(10L, 40L, new ServiceReviewRequest(4, null)));
        verifyNoInteractions(offerRepository, serviceReviewRepository);
    }

    @Test
    void shouldRejectReviewForRequestThatIsNotAcceptedOrInProgress() {
        User customer = new User();
        customer.setId(10L);
        ServiceRequest request = new ServiceRequest();
        request.setId(40L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.NEW);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.completeAndReview(10L, 40L, new ServiceReviewRequest(4, null)));
        verifyNoInteractions(offerRepository, serviceReviewRepository);
    }

    @Test
    void shouldRejectSecondReviewForRequest() {
        User customer = new User();
        customer.setId(10L);
        ServiceRequest request = new ServiceRequest();
        request.setId(40L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.ACCEPTED);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));
        when(offerRepository.findByRequestIdAndStatus(40L, OfferStatus.ACCEPTED)).thenReturn(Optional.of(new Offer()));
        when(serviceReviewRepository.existsByRequestId(40L)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.completeAndReview(10L, 40L, new ServiceReviewRequest(4, null)));
        verify(serviceReviewRepository, never()).save(any());
    }

    @Test
    void acceptedCraftsmanCanReviewCustomerAfterCompletion() {
        User customer = new User();
        customer.setId(10L);
        User craftsmanUser = new User();
        craftsmanUser.setId(20L);
        CraftsmanProfile craftsman = new CraftsmanProfile();
        craftsman.setUser(craftsmanUser);
        ServiceRequest request = new ServiceRequest();
        request.setId(40L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.COMPLETED);
        Offer offer = new Offer();
        offer.setCraftsman(craftsman);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));
        when(offerRepository.findByRequestIdAndStatus(40L, OfferStatus.ACCEPTED)).thenReturn(Optional.of(offer));
        when(customerReviewRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = serviceReviewService.reviewCustomer(20L, 40L, new ServiceReviewRequest(4, "  Korektno  "));
        assertEquals(4, result.rating());
        assertEquals("Korektno", result.comment());
        verify(customerReviewRepository).save(argThat(review -> review.getCustomer() == customer
                && review.getCraftsman() == craftsman && review.getRequest() == request));
    }

    @Test
    void cannotReviewCustomerBeforeJobIsCompleted() {
        ServiceRequest request = new ServiceRequest();
        request.setStatus(ServiceRequestStatus.ACCEPTED);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));
        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.reviewCustomer(20L, 40L, new ServiceReviewRequest(5, null)));
        verifyNoInteractions(offerRepository, customerReviewRepository);
    }

    @Test
    void onlyAcceptedCraftsmanCanReviewCustomer() {
        ServiceRequest request = new ServiceRequest();
        request.setStatus(ServiceRequestStatus.COMPLETED);
        User otherUser = new User();
        otherUser.setId(21L);
        CraftsmanProfile otherCraftsman = new CraftsmanProfile();
        otherCraftsman.setUser(otherUser);
        Offer offer = new Offer();
        offer.setCraftsman(otherCraftsman);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));
        when(offerRepository.findByRequestIdAndStatus(40L, OfferStatus.ACCEPTED)).thenReturn(Optional.of(offer));
        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.reviewCustomer(20L, 40L, new ServiceReviewRequest(5, null)));
        verifyNoInteractions(customerReviewRepository);
    }

    @Test
    void cannotReviewSameCustomerTwiceForJob() {
        ServiceRequest request = new ServiceRequest();
        request.setStatus(ServiceRequestStatus.COMPLETED);
        User craftsmanUser = new User();
        craftsmanUser.setId(20L);
        CraftsmanProfile craftsman = new CraftsmanProfile();
        craftsman.setUser(craftsmanUser);
        Offer offer = new Offer();
        offer.setCraftsman(craftsman);
        when(serviceRequestRepository.findById(40L)).thenReturn(Optional.of(request));
        when(offerRepository.findByRequestIdAndStatus(40L, OfferStatus.ACCEPTED)).thenReturn(Optional.of(offer));
        when(customerReviewRepository.existsByRequestId(40L)).thenReturn(true);
        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.reviewCustomer(20L, 40L, new ServiceReviewRequest(5, null)));
        verify(customerReviewRepository, never()).save(any(CustomerReview.class));
    }

    @Test
    void rejectsInvalidCustomerRatingAndLongComment() {
        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.reviewCustomer(20L, 40L, new ServiceReviewRequest(0, null)));
        assertThrows(IllegalArgumentException.class,
                () -> serviceReviewService.reviewCustomer(20L, 40L, new ServiceReviewRequest(5, "x".repeat(1001))));
        verifyNoInteractions(serviceRequestRepository, offerRepository, customerReviewRepository);
    }
}
