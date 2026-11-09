package com.fixhome.craftsman.repository;

import com.fixhome.craftsman.entity.CraftsmanProfile;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CraftsmanProfileRepository extends JpaRepository<CraftsmanProfile, Long> {

    Optional<CraftsmanProfile> findByUserId(Long userId);

    @Query(value = """
            SELECT DISTINCT cp.expo_push_token
            FROM craftsman_profiles cp
            JOIN craftsman_notification_cities cnc ON cnc.craftsman_id = cp.id
            JOIN craftsman_categories cc ON cc.craftsman_id = cp.id
            WHERE lower(trim(cnc.city)) = lower(trim(:city))
              AND cc.category_id = :categoryId
              AND cp.expo_push_token IS NOT NULL
            """, nativeQuery = true)
    List<String> findPushTokensForRequest(
            @Param("city") String city,
            @Param("categoryId") Long categoryId);
}
