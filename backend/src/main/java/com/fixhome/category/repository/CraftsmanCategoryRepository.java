package com.fixhome.category.repository;

import com.fixhome.category.entity.CraftsmanCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CraftsmanCategoryRepository extends JpaRepository<CraftsmanCategory, Long> {

    boolean existsByCraftsmanIdAndCategoryId(Long craftsmanId, Long categoryId);

    @Query("select cc.category.id from CraftsmanCategory cc where cc.craftsman.user.id = :userId")
    List<Long> findCategoryIdsByCraftsmanUserId(@Param("userId") Long userId);

    @Query("select cc.category.name from CraftsmanCategory cc where cc.craftsman.user.id = :userId order by cc.category.name")
    List<String> findCategoryNamesByCraftsmanUserId(@Param("userId") Long userId);
}
