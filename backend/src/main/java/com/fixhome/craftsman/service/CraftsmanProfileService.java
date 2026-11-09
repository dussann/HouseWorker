package com.fixhome.craftsman.service;

import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.entity.CraftsmanNotificationPreferencesRequest;
import com.fixhome.craftsman.entity.CraftsmanNotificationPreferencesResponse;
import com.fixhome.craftsman.entity.CraftsmanProfileRequest;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CraftsmanProfileService {

    private static final int MAX_NOTIFICATION_CITIES = 20;

    private final CraftsmanProfileRepository craftsmanProfileRepository;
    private final UserRepository userRepository;
    private final CraftsmanCategoryRepository craftsmanCategoryRepository;

    public CraftsmanProfileService(CraftsmanProfileRepository craftsmanProfileRepository,
                                   UserRepository userRepository,
                                   CraftsmanCategoryRepository craftsmanCategoryRepository) {
        this.craftsmanProfileRepository = craftsmanProfileRepository;
        this.userRepository = userRepository;
        this.craftsmanCategoryRepository = craftsmanCategoryRepository;
    }

    @Transactional(readOnly = true)
    public CraftsmanProfile getProfile(Long userId) {
        return craftsmanProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("Craftsman profile not found"));
    }

    @Transactional
    public CraftsmanProfile createOrUpdateProfile(Long userId, CraftsmanProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        CraftsmanProfile profile = craftsmanProfileRepository.findByUserId(userId)
                .orElseGet(CraftsmanProfile::new);

        profile.setUser(user);
        profile.setCompanyName(request.companyName());
        profile.setDescription(request.description());
        profile.setExperienceYears(request.experienceYears());

        return craftsmanProfileRepository.save(profile);
    }

    @Transactional(readOnly = true)
    public CraftsmanNotificationPreferencesResponse getNotificationPreferences(Long userId) {
        CraftsmanProfile profile = getProfile(userId);
        return new CraftsmanNotificationPreferencesResponse(
                sortedCities(profile.getNotificationCities()),
                profile.getExpoPushToken() != null,
                craftsmanCategoryRepository.findCategoryNamesByCraftsmanUserId(userId));
    }

    @Transactional
    public CraftsmanNotificationPreferencesResponse updateNotificationCities(
            Long userId,
            CraftsmanNotificationPreferencesRequest request) {
        if (request == null || request.cities() == null) {
            throw new IllegalArgumentException("Notification cities are required");
        }
        if (request.cities().size() > MAX_NOTIFICATION_CITIES) {
            throw new IllegalArgumentException("Select no more than 20 notification cities");
        }

        Set<String> cities = new LinkedHashSet<>();
        Set<String> normalizedCities = new LinkedHashSet<>();
        for (String city : request.cities()) {
            if (city == null || city.isBlank()) {
                throw new IllegalArgumentException("Notification city names must not be blank");
            }
            String normalizedCity = city.trim();
            if (normalizedCity.length() > 120) {
                throw new IllegalArgumentException("Notification city names must not exceed 120 characters");
            }
            if (normalizedCities.add(normalizedCity.toLowerCase(Locale.ROOT))) {
                cities.add(normalizedCity);
            }
        }

        CraftsmanProfile profile = getProfile(userId);
        profile.setNotificationCities(cities);
        craftsmanProfileRepository.save(profile);
        return new CraftsmanNotificationPreferencesResponse(sortedCities(cities), profile.getExpoPushToken() != null,
                craftsmanCategoryRepository.findCategoryNamesByCraftsmanUserId(userId));
    }

    @Transactional
    public void updateExpoPushToken(Long userId, String token) {
        boolean validExpoToken = token != null
                && (token.startsWith("ExpoPushToken[") || token.startsWith("ExponentPushToken["))
                && token.endsWith("]")
                && token.indexOf(']') == token.length() - 1
                && token.indexOf('[') < token.length() - 2;
        if (token != null && !validExpoToken) {
            throw new IllegalArgumentException("A valid Expo push token is required");
        }
        if (token != null && token.length() > 255) {
            throw new IllegalArgumentException("Expo push token must not exceed 255 characters");
        }
        CraftsmanProfile profile = getProfile(userId);
        profile.setExpoPushToken(token);
        craftsmanProfileRepository.save(profile);
    }

    private List<String> sortedCities(Set<String> cities) {
        return cities.stream()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }
}
