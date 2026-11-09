package com.fixhome.auth.controller;

import com.fixhome.auth.service.JwtService;
import com.fixhome.category.entity.Category;
import com.fixhome.category.entity.CraftsmanCategory;
import com.fixhome.category.repository.CategoryRepository;
import com.fixhome.category.repository.CraftsmanCategoryRepository;
import com.fixhome.craftsman.entity.CraftsmanProfile;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.domain.user.Role;
import com.fixhome.domain.user.User;
import com.fixhome.domain.user.UserRepository;
import com.fixhome.web.service.ImageStorageService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CategoryRepository categoryRepository;
    private final CraftsmanProfileRepository craftsmanProfileRepository;
    private final CraftsmanCategoryRepository craftsmanCategoryRepository;
    private final ImageStorageService imageStorageService;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService,
                          CategoryRepository categoryRepository,
                          CraftsmanProfileRepository craftsmanProfileRepository,
                          CraftsmanCategoryRepository craftsmanCategoryRepository,
                          ImageStorageService imageStorageService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.categoryRepository = categoryRepository;
        this.craftsmanProfileRepository = craftsmanProfileRepository;
        this.craftsmanCategoryRepository = craftsmanCategoryRepository;
        this.imageStorageService = imageStorageService;
    }

    @PostMapping("/register")
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> register(@RequestBody RegisterRequest request) throws IOException {
        return registerUser(request, null);
    }

    @PostMapping(value = "/register-with-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> registerWithImage(
            @RequestParam String displayName,
            @RequestParam String email,
            @RequestParam String password,
            @RequestParam(required = false) String phone,
            @RequestParam String role,
            @RequestParam String city,
            @RequestParam(required = false) String categoryIds,
            @RequestParam("image") MultipartFile image) throws IOException {
        List<Long> parsedCategoryIds = categoryIds == null || categoryIds.isBlank()
                ? List.of()
                : java.util.Arrays.stream(categoryIds.split(","))
                    .map(String::trim)
                    .map(Long::valueOf)
                    .toList();
        return registerUser(
                new RegisterRequest(email, password, phone, role, city, parsedCategoryIds, displayName),
                image);
    }

    private ResponseEntity<Map<String, Object>> registerUser(RegisterRequest request, MultipartFile profileImage)
            throws IOException {
        if (request.displayName() == null || request.displayName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Name is required"));
        }
        if (request.displayName().trim().length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("message", "Name must not exceed 120 characters"));
        }
        if (request.city() == null || request.city().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "City is required"));
        }
        if (request.city().trim().length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("message", "City must not exceed 120 characters"));
        }
        if (userRepository.existsByEmail(request.email())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email already exists"));
        }

        Role role = Role.valueOf(request.role());
        List<Category> selectedCategories = List.of();
        if (role == Role.CRAFTSMAN) {
            if (request.categoryIds() == null || request.categoryIds().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Select at least one service category"));
            }
            if (request.categoryIds().stream().anyMatch(Objects::isNull)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Selected category IDs must be valid"));
            }
            List<Long> categoryIds = request.categoryIds().stream().distinct().toList();
            selectedCategories = categoryRepository.findAllById(categoryIds);
            if (selectedCategories.size() != categoryIds.size()) {
                return ResponseEntity.badRequest().body(Map.of("message", "One or more selected categories do not exist"));
            }
        }

        User user = new User();
        user.setEmail(request.email());
        user.setDisplayName(request.displayName().trim());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setPhone(request.phone());
        user.setRole(role);
        user.setCity(request.city().trim());
        if (profileImage != null) {
            user.setProfileImageUrl(imageStorageService.store(profileImage));
        }

        User savedUser = userRepository.save(user);
        if (role == Role.CRAFTSMAN) {
            CraftsmanProfile profile = new CraftsmanProfile();
            profile.setUser(savedUser);
            profile.setNotificationCities(java.util.Set.of(savedUser.getCity()));
            CraftsmanProfile savedProfile = craftsmanProfileRepository.save(profile);
            List<CraftsmanCategory> craftsmanCategories = new java.util.ArrayList<>();
            for (Category category : selectedCategories) {
                CraftsmanCategory craftsmanCategory = new CraftsmanCategory();
                craftsmanCategory.setCraftsman(savedProfile);
                craftsmanCategory.setCategory(category);
                craftsmanCategories.add(craftsmanCategory);
            }
            craftsmanCategoryRepository.saveAll(craftsmanCategories);
        }

        String token = jwtService.generateToken(savedUser);
        Map<String, Object> response = new HashMap<>();
        response.put("id", savedUser.getId());
        response.put("email", savedUser.getEmail());
        response.put("displayName", savedUser.getDisplayName());
        response.put("profileImageUrl", savedUser.getProfileImageUrl());
        response.put("role", savedUser.getRole().name());
        response.put("city", savedUser.getCity());
        response.put("token", token);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request) {
        User user = userRepository.findByEmail(request.email()).orElse(null);
        if (user == null || !passwordEncoder.matches(request.password(), user.getPassword())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Email ili lozinka nisu ispravni."));
        }

        if (request.role() != null && !user.getRole().name().equals(request.role())) {
            return ResponseEntity.status(403).body(Map.of(
                    "message", "Ovaj nalog je registrovan kao "
                            + (user.getRole() == Role.CUSTOMER ? "korisnik" : "majstor")
                            + ". Izaberite odgovarajuću ulogu."));
        }

        String token = jwtService.generateToken(user);

        Map<String, Object> response = new HashMap<>();
        response.put("accessToken", token);
        response.put("tokenType", "Bearer");
        response.put("email", user.getEmail());
        response.put("displayName", user.getDisplayName() == null ? "" : user.getDisplayName());
        response.put("profileImageUrl", user.getProfileImageUrl());
        response.put("role", user.getRole().name());
        response.put("city", user.getCity() == null ? "" : user.getCity());
        return ResponseEntity.ok(response);
    }

    public record RegisterRequest(
            String email,
            String password,
            String phone,
            String role,
            String city,
            List<Long> categoryIds,
            String displayName) {
    }

    public record LoginRequest(String email, String password, String role) {
    }
}
