package com.fixhome.craftsman.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fixhome.domain.user.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "craftsman_profiles")
public class CraftsmanProfile {

    public CraftsmanProfile() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "description")
    private String description;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "verified")
    private boolean verified = false;

    @Column(name = "rating", precision = 3, scale = 2)
    private BigDecimal rating;

    @Column(name = "expo_push_token", length = 255)
    private String expoPushToken;

    @ElementCollection
    @CollectionTable(
            name = "craftsman_notification_cities",
            joinColumns = @JoinColumn(name = "craftsman_id"))
    @Column(name = "city", nullable = false, length = 120)
    private Set<String> notificationCities = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    @JsonIgnore
    public String getExpoPushToken() {
        return expoPushToken;
    }

    public void setExpoPushToken(String expoPushToken) {
        this.expoPushToken = expoPushToken;
    }

    @JsonIgnore
    public Set<String> getNotificationCities() {
        return notificationCities;
    }

    public void setNotificationCities(Set<String> notificationCities) {
        this.notificationCities = notificationCities;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public static CraftsmanProfile fromRequest(User user, CraftsmanProfileRequest request) {
        CraftsmanProfile profile = new CraftsmanProfile();
        profile.setUser(user);
        profile.setCompanyName(request.companyName());
        profile.setDescription(request.description());
        profile.setExperienceYears(request.experienceYears());
        return profile;
    }
}
