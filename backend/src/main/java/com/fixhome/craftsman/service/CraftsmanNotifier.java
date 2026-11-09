package com.fixhome.craftsman.service;

import com.fixhome.request.entity.ServiceRequest;

public interface CraftsmanNotifier {

    void notifyMatchingCraftsmen(ServiceRequest request);
}
