package com.fixhome.customer;

import com.fixhome.customer.entity.CustomerProfile;
import com.fixhome.customer.entity.CustomerProfileRequest;
import com.fixhome.domain.user.Role;
import com.fixhome.domain.user.User;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CustomerProfileServiceTest {

    @Test
    void shouldRejectInvalidProfileRequest() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        CustomerProfileRequest request = new CustomerProfileRequest(
                "",
                "Petrovic",
                "Belgrade",
                new BigDecimal("91"),
                new BigDecimal("181")
        );

        var violations = validator.validate(request);

        assertEquals(3, violations.size());
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("firstName")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("latitude")));
        assertTrue(violations.stream().anyMatch(violation -> violation.getPropertyPath().toString().equals("longitude")));
    }

    @Test
    void shouldCreateCustomerProfileFromRequest() {
        User user = new User();
        user.setId(10L);
        user.setEmail("customer@test.com");
        user.setPhone("+38160000000");
        user.setRole(Role.CUSTOMER);

        CustomerProfileRequest request = new CustomerProfileRequest(
                "Petar",
                "Petrovic",
                "Belgrade",
                new BigDecimal("44.7866"),
                new BigDecimal("20.4489")
        );

        CustomerProfile profile = CustomerProfile.fromRequest(user, request);

        assertNotNull(profile);
        assertEquals(user.getId(), profile.getUser().getId());
        assertEquals("Petar", profile.getFirstName());
        assertEquals("Belgrade", profile.getAddress());
        assertEquals(new BigDecimal("44.7866"), profile.getLatitude());
    }
}
