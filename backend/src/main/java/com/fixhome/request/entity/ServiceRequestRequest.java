package com.fixhome.request.entity;

import java.math.BigDecimal;

public record ServiceRequestRequest(
        Long categoryId,
        String description,
        String imageUrl,
        BigDecimal latitude,
        BigDecimal longitude
) {
}
