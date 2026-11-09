package com.fixhome.offer.entity;

import java.math.BigDecimal;

public record OfferResponse(
        Long id,
        Long requestId,
        Long craftsmanId,
        String craftsmanCompanyName,
        BigDecimal price,
        String message,
        boolean agreeOnSite,
        OfferStatus status,
        String craftsmanEmail,
        String craftsmanPhone,
        String customerEmail,
        String customerPhone
) {
    public static OfferResponse from(Offer offer) {
        return from(offer, false);
    }

    public static OfferResponse from(Offer offer, boolean includeContactDetails) {
        return new OfferResponse(
                offer.getId(),
                offer.getRequest().getId(),
                offer.getCraftsman().getId(),
                offer.getCraftsman().getCompanyName(),
                offer.getPrice(),
                offer.getMessage(),
                offer.isAgreeOnSite(),
                offer.getStatus(),
                includeContactDetails ? offer.getCraftsman().getUser().getEmail() : null,
                includeContactDetails ? offer.getCraftsman().getUser().getPhone() : null,
                null,
                null
        );
    }

    public static OfferResponse fromForCraftsman(Offer offer) {
        boolean includeContactDetails = offer.getStatus() == OfferStatus.ACCEPTED;
        return new OfferResponse(
                offer.getId(),
                offer.getRequest().getId(),
                offer.getCraftsman().getId(),
                offer.getCraftsman().getCompanyName(),
                offer.getPrice(),
                offer.getMessage(),
                offer.isAgreeOnSite(),
                offer.getStatus(),
                null,
                null,
                includeContactDetails ? offer.getRequest().getCustomer().getEmail() : null,
                includeContactDetails ? offer.getRequest().getCustomer().getPhone() : null
        );
    }
}
