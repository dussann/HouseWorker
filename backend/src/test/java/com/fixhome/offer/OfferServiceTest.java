package com.fixhome.offer;

import com.fixhome.category.entity.Category;
import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.domain.user.Role;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import com.fixhome.offer.entity.Offer;
import com.fixhome.offer.entity.OfferRequest;
import com.fixhome.offer.entity.OfferResponse;
import com.fixhome.offer.entity.OfferStatus;
import com.fixhome.offer.repository.OfferRepository;
import com.fixhome.offer.service.OfferService;
import com.fixhome.offer.service.OfferNotifier;
import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.ServiceRequestStatus;
import com.fixhome.request.repository.ServiceRequestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OfferServiceTest {

    @Mock
    private OfferRepository offerRepository;

    @Mock
    private ServiceRequestRepository serviceRequestRepository;

    @Mock
    private CraftsmanProfileRepository craftsmanProfileRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CraftsmanCategoryRepository craftsmanCategoryRepository;

    @Mock
    private OfferNotifier offerNotifier;

    @InjectMocks
    private OfferService offerService;

    @Test
    void shouldCreateOfferForUnverifiedCraftsmanWhenProvidingCategory() {
        User customer = new User();
        customer.setId(4L);
        customer.setRole(Role.CUSTOMER);

        User craftsmanUser = new User();
        craftsmanUser.setId(8L);
        craftsmanUser.setRole(Role.CRAFTSMAN);

        Category category = new Category();
        category.setId(12L);
        category.setName("Plumber");

        ServiceRequest request = new ServiceRequest();
        request.setId(30L);
        request.setCustomer(customer);
        request.setCategory(category);
        request.setDescription("Leak");
        request.setStatus(ServiceRequestStatus.NEW);

        CraftsmanProfile profile = new CraftsmanProfile();
        profile.setId(91L);
        profile.setUser(craftsmanUser);
        profile.setVerified(false);

        when(serviceRequestRepository.findById(30L)).thenReturn(Optional.of(request));
        when(craftsmanProfileRepository.findByUserId(8L)).thenReturn(Optional.of(profile));
        when(craftsmanCategoryRepository.existsByCraftsmanIdAndCategoryId(91L, 12L)).thenReturn(true);

        Offer saved = new Offer();
        saved.setId(100L);
        saved.setRequest(request);
        saved.setCraftsman(profile);
        saved.setPrice(new BigDecimal("125.00"));
        saved.setMessage("I can come today");
        saved.setStatus(OfferStatus.PENDING);

        when(offerRepository.save(org.mockito.ArgumentMatchers.any(Offer.class))).thenReturn(saved);

        OfferResponse response = offerService.createOffer(8L, new OfferRequest(30L, new BigDecimal("125.00"), "I can come today"));

        assertNotNull(response);
        assertEquals(100L, response.id());
        assertEquals("I can come today", response.message());
        assertEquals(OfferStatus.PENDING, response.status());
    }

    @Test
    void shouldCreateOnSiteOfferWithoutPrice() {
        User customer = new User();
        customer.setId(4L);

        User craftsmanUser = new User();
        craftsmanUser.setId(8L);

        Category category = new Category();
        category.setId(12L);

        ServiceRequest request = new ServiceRequest();
        request.setId(30L);
        request.setCustomer(customer);
        request.setCategory(category);
        request.setStatus(ServiceRequestStatus.NEW);

        CraftsmanProfile profile = new CraftsmanProfile();
        profile.setId(91L);
        profile.setUser(craftsmanUser);
        profile.setVerified(true);

        when(serviceRequestRepository.findById(30L)).thenReturn(Optional.of(request));
        when(craftsmanProfileRepository.findByUserId(8L)).thenReturn(Optional.of(profile));
        when(craftsmanCategoryRepository.existsByCraftsmanIdAndCategoryId(91L, 12L)).thenReturn(true);
        when(offerRepository.save(any(Offer.class))).thenAnswer(invocation -> {
            Offer offer = invocation.getArgument(0);
            offer.setId(101L);
            return offer;
        });

        OfferResponse response = offerService.createOffer(8L, new OfferRequest(30L, null, "Dogovor na licu mesta", true));

        assertEquals(101L, response.id());
        assertNull(response.price());
        assertTrue(response.agreeOnSite());
        verify(offerNotifier).notifyCustomerOfOffer(any(ServiceRequest.class), any(Offer.class));
    }

    @Test
    void shouldRequirePriceOrOnSiteAgreement() {
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> offerService.createOffer(8L, new OfferRequest(30L, null, null, false))
        );

        assertEquals("Enter a positive price or agree to discuss it on site", exception.getMessage());
    }

    @Test
    void shouldRejectOfferAcceptanceForNonOwner() {
        User customer = new User();
        customer.setId(7L);

        User otherCustomer = new User();
        otherCustomer.setId(9L);

        Category category = new Category();
        category.setId(5L);
        category.setName("Electrician");

        ServiceRequest request = new ServiceRequest();
        request.setId(20L);
        request.setCustomer(otherCustomer);
        request.setCategory(category);
        request.setStatus(ServiceRequestStatus.WAITING_FOR_OFFERS);

        CraftsmanProfile craftsman = new CraftsmanProfile();
        craftsman.setId(11L);

        Offer offer = new Offer();
        offer.setId(3L);
        offer.setRequest(request);
        offer.setCraftsman(craftsman);
        offer.setPrice(new BigDecimal("200.00"));
        offer.setMessage("I can fix it");
        offer.setStatus(OfferStatus.PENDING);

        when(offerRepository.findById(3L)).thenReturn(Optional.of(offer));

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> offerService.acceptOffer(customer.getId(), offer.getId())
        );

        assertEquals("Offer not found", exception.getMessage());
    }

    @Test
    void shouldExposeCraftsmanContactOnlyAfterCustomerAcceptsOffer() {
        User customer = new User();
        customer.setId(4L);
        customer.setEmail("customer@example.com");
        customer.setPhone("+38160000000");

        User craftsmanUser = new User();
        craftsmanUser.setId(8L);
        craftsmanUser.setEmail("craftsman@example.com");
        craftsmanUser.setPhone("+38161111111");

        CraftsmanProfile craftsman = new CraftsmanProfile();
        craftsman.setId(91L);
        craftsman.setUser(craftsmanUser);

        ServiceRequest request = new ServiceRequest();
        request.setId(30L);
        request.setCustomer(customer);
        request.setStatus(ServiceRequestStatus.WAITING_FOR_OFFERS);

        Offer offer = new Offer();
        offer.setId(100L);
        offer.setRequest(request);
        offer.setCraftsman(craftsman);
        offer.setPrice(new BigDecimal("125.00"));
        offer.setStatus(OfferStatus.PENDING);
        when(offerRepository.findById(100L)).thenReturn(Optional.of(offer));

        OfferResponse pendingResponse = offerService.getOffer(customer.getId(), Role.CUSTOMER, 100L);
        assertNull(pendingResponse.craftsmanEmail());
        assertNull(pendingResponse.craftsmanPhone());

        offer.setStatus(OfferStatus.ACCEPTED);
        request.setStatus(ServiceRequestStatus.ACCEPTED);
        OfferResponse acceptedResponse = offerService.getOffer(customer.getId(), Role.CUSTOMER, 100L);
        assertEquals("craftsman@example.com", acceptedResponse.craftsmanEmail());
        assertEquals("+38161111111", acceptedResponse.craftsmanPhone());

        OfferResponse craftsmanResponse = offerService.getOffer(craftsmanUser.getId(), Role.CRAFTSMAN, 100L);
        assertEquals("customer@example.com", craftsmanResponse.customerEmail());
        assertEquals("+38160000000", craftsmanResponse.customerPhone());
    }

    @Test
    void shouldNotAllowUnrelatedUserToReadOfferContacts() {
        User customer = new User();
        customer.setId(4L);
        User craftsmanUser = new User();
        craftsmanUser.setId(8L);
        CraftsmanProfile craftsman = new CraftsmanProfile();
        craftsman.setId(91L);
        craftsman.setUser(craftsmanUser);
        ServiceRequest request = new ServiceRequest();
        request.setId(30L);
        request.setCustomer(customer);
        Offer offer = new Offer();
        offer.setId(100L);
        offer.setRequest(request);
        offer.setCraftsman(craftsman);
        when(offerRepository.findById(100L)).thenReturn(Optional.of(offer));

        assertThrows(IllegalArgumentException.class,
                () -> offerService.getOffer(999L, Role.CUSTOMER, offer.getId()));
    }
}
