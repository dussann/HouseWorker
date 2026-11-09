package com.fixhome.category.entity;

import com.fixhome.craftsman.entity.CraftsmanProfile;
import jakarta.persistence.*;

@Entity
@Table(name = "craftsman_categories")
public class CraftsmanCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "craftsman_id", nullable = false)
    private CraftsmanProfile craftsman;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    public CraftsmanCategory() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CraftsmanProfile getCraftsman() {
        return craftsman;
    }

    public void setCraftsman(CraftsmanProfile craftsman) {
        this.craftsman = craftsman;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }
}
