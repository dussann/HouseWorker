package com.fixhome.craftsman;

import com.fixhome.craftsman.entity.CraftsmanNotificationPreferencesRequest;
import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.craftsman.service.CraftsmanProfileService;
import com.fixhome.domain.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CraftsmanProfileServiceTest {

    @Mock
    private CraftsmanProfileRepository craftsmanProfileRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CraftsmanProfileService craftsmanProfileService;

    @Test
    void shouldReturnSavedCitiesAndPushRegistrationState() {
        CraftsmanProfile profile = new CraftsmanProfile();
        profile.setNotificationCities(new LinkedHashSet<>(List.of("Novi Sad", "Beograd")));
        profile.setExpoPushToken("ExpoPushToken[device]");
        when(craftsmanProfileRepository.findByUserId(7L)).thenReturn(Optional.of(profile));

        var preferences = craftsmanProfileService.getNotificationPreferences(7L);

        assertEquals(List.of("Beograd", "Novi Sad"), preferences.cities());
        assertTrue(preferences.pushEnabled());
    }

    @Test
    void shouldTrimAndDeduplicateNotificationCitiesIgnoringCase() {
        CraftsmanProfile profile = new CraftsmanProfile();
        when(craftsmanProfileRepository.findByUserId(7L)).thenReturn(Optional.of(profile));
        when(craftsmanProfileRepository.save(profile)).thenReturn(profile);

        var preferences = craftsmanProfileService.updateNotificationCities(
                7L,
                new CraftsmanNotificationPreferencesRequest(List.of(" Novi Sad ", "novi sad", "Beograd")));

        assertEquals(List.of("Beograd", "Novi Sad"), preferences.cities());
        assertEquals(Set.of("Novi Sad", "Beograd"), profile.getNotificationCities());
    }

    @Test
    void shouldRejectInvalidExpoPushTokens() {
        assertThrows(IllegalArgumentException.class,
                () -> craftsmanProfileService.updateExpoPushToken(7L, "not-an-expo-token"));
        verify(craftsmanProfileRepository, never()).save(any());
    }
}
