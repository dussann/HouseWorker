package com.fixhome.auth;

import com.fixhome.auth.controller.AuthController;
import com.fixhome.auth.controller.AuthController.LoginRequest;
import com.fixhome.auth.controller.AuthController.RegisterRequest;
import com.fixhome.auth.service.JwtService;
import com.fixhome.category.entity.Category;
import com.fixhome.category.repository.CategoryRepository;
import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.domain.user.Role;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import com.fixhome.web.service.ImageStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockMultipartFile;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private CraftsmanProfileRepository craftsmanProfileRepository;

    @Mock
    private CraftsmanCategoryRepository craftsmanCategoryRepository;

    @TempDir
    private Path tempDirectory;

    @Test
    void shouldRejectLoginWhenSelectedRoleDoesNotMatchAccount() {
        User user = new User();
        user.setId(12L);
        user.setEmail("craftsman@example.com");
        user.setPassword("encoded");
        user.setRole(Role.CRAFTSMAN);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password", "encoded")).thenReturn(true);

        AuthController controller = newController();

        var response = controller.login(new LoginRequest(user.getEmail(), "password", Role.CUSTOMER.name()));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(
                "Ovaj nalog je registrovan kao majstor. Izaberite odgovarajuću ulogu.",
                response.getBody().get("message"));
    }

    @Test
    void shouldAllowLoginWhenSelectedRoleMatchesAccount() {
        User user = new User();
        user.setId(12L);
        user.setEmail("customer@example.com");
        user.setPassword("encoded");
        user.setRole(Role.CUSTOMER);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password", "encoded")).thenReturn(true);

        AuthController controller = newController();

        var response = controller.login(new LoginRequest(user.getEmail(), "password", Role.CUSTOMER.name()));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(Role.CUSTOMER.name(), response.getBody().get("role"));
    }

    @Test
    void shouldReturnClearUnauthorizedMessageForInvalidCredentials() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        var response = newController().login(
                new LoginRequest("missing@example.com", "wrong-password", Role.CUSTOMER.name()));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals("Email ili lozinka nisu ispravni.", response.getBody().get("message"));
    }

    @Test
    void shouldSaveCraftsmanCategoriesAtRegistration() throws Exception {
        Category category = new Category();
        category.setId(4L);
        category.setName("Vodoinstalater");
        when(categoryRepository.findAllById(List.of(4L))).thenReturn(List.of(category));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            saved.setId(18L);
            return saved;
        });
        when(craftsmanProfileRepository.save(any(CraftsmanProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = newController().register(new RegisterRequest(
                "craftsman@example.com",
                "password",
                "+38160000000",
                Role.CRAFTSMAN.name(),
                "Novi Sad",
                List.of(4L),
                "Majstor Test"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Majstor Test", response.getBody().get("displayName"));
        verify(craftsmanProfileRepository).save(argThat(profile ->
                profile.getNotificationCities().equals(java.util.Set.of("Novi Sad"))));
        verify(craftsmanCategoryRepository).saveAll(argThat(categories -> {
            var savedCategories = (List<?>) categories;
            return savedCategories.size() == 1;
        }));
    }

    @Test
    void shouldStoreProfileImageAndNameDuringRegistration() throws Exception {
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            saved.setId(19L);
            return saved;
        });
        MockMultipartFile image = new MockMultipartFile(
                "image", "profile.jpg", "image/jpeg", new byte[]{
                        (byte) 0xFF, (byte) 0xD8, (byte) 0xFF
                });

        var response = newController().registerWithImage(
                "Korisnik Test",
                "customer@example.com",
                "password",
                "+38160000000",
                Role.CUSTOMER.name(),
                "Beograd",
                null,
                image);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Korisnik Test", response.getBody().get("displayName"));
        String profileImageUrl = (String) response.getBody().get("profileImageUrl");
        assertTrue(profileImageUrl.matches("/api/v1/uploads/[a-f0-9-]{36}\\.jpg"));
        verify(userRepository).save(argThat(user ->
                "Korisnik Test".equals(user.getDisplayName())
                        && profileImageUrl.equals(user.getProfileImageUrl())));
    }

    private AuthController newController() {
        return new AuthController(
                userRepository,
                passwordEncoder,
                new JwtService(),
                categoryRepository,
                craftsmanProfileRepository,
                craftsmanCategoryRepository,
                new ImageStorageService(tempDirectory.resolve("uploads").toString()));
    }
}
