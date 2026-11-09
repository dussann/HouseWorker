package com.fixhome.customer.service;

import com.fixhome.customer.entity.CustomerProfile;
import com.fixhome.customer.entity.CustomerProfileRequest;
import com.fixhome.customer.repository.CustomerProfileRepository;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class CustomerProfileService {

    private final CustomerProfileRepository customerProfileRepository;
    private final UserRepository userRepository;

    public CustomerProfileService(CustomerProfileRepository customerProfileRepository, UserRepository userRepository) {
        this.customerProfileRepository = customerProfileRepository;
        this.userRepository = userRepository;
    }

    public CustomerProfile getProfile(Long userId) {
        return customerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("Customer profile not found"));
    }

    public CustomerProfile createOrUpdateProfile(Long userId, CustomerProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        CustomerProfile profile = customerProfileRepository.findByUserId(userId)
                .orElseGet(CustomerProfile::new);

        profile.setUser(user);
        profile.setFirstName(request.firstName());
        profile.setLastName(request.lastName());
        profile.setAddress(request.address());
        profile.setLatitude(request.latitude());
        profile.setLongitude(request.longitude());

        return customerProfileRepository.save(profile);
    }

    public Optional<CustomerProfile> findByUserId(Long userId) {
        return customerProfileRepository.findByUserId(userId);
    }
}
