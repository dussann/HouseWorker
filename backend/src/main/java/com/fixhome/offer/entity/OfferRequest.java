package com.fixhome.offer.entity;

import java.math.BigDecimal;

public record OfferRequest(
        Long requestId,
        BigDecimal price,
        String message,
        Boolean agreeOnSite
) {
    public OfferRequest(Long requestId, BigDecimal price, String message) {
        this(requestId, price, message, false);
    }
}
