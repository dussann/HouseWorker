package com.fixhome.offer.service;

import com.fixhome.offer.entity.Offer;
import com.fixhome.request.entity.ServiceRequest;

public interface OfferNotifier {

    void notifyCustomerOfOffer(ServiceRequest request, Offer offer);

    void notifyCraftsmanOfferAccepted(ServiceRequest request, Offer offer);
}
