package com.fixhome.craftsman.entity;

public record CraftsmanProfileRequest(
        String companyName,
        String description,
        Integer experienceYears
) {
}
