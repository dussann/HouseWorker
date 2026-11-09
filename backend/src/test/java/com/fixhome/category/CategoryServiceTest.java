package com.fixhome.category;

import com.fixhome.category.entity.Category;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class CategoryServiceTest {

    @Test
    void shouldCreateCategoryFromName() {
        Category category = Category.fromName("Plumber");

        assertNotNull(category);
        assertEquals("Plumber", category.getName());
    }
}
