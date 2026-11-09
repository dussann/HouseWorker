package com.fixhome.craftsman.entity;

import java.util.List;

public record CraftsmanNotificationPreferencesResponse(List<String> cities, boolean pushEnabled, List<String> categories) {
}
