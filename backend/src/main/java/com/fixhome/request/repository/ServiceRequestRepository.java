package com.fixhome.request.repository;

import com.fixhome.request.entity.ServiceRequest;
import com.fixhome.request.entity.ServiceRequestStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {

    List<ServiceRequest> findByCustomerId(Long customerId);

    @Query("""
            select request from ServiceRequest request
            where request.status in :statuses
              and lower(request.customer.city) = lower(:city)
              and request.category.id in :categoryIds
            order by request.createdAt desc
            """)
    List<ServiceRequest> findAvailableForCraftsman(
            @Param("statuses") List<ServiceRequestStatus> statuses,
            @Param("city") String city,
            @Param("categoryIds") List<Long> categoryIds);
}
