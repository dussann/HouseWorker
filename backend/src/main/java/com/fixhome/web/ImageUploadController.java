package com.fixhome.web;

import com.fixhome.web.service.ImageStorageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/uploads")
public class ImageUploadController {

    private final ImageStorageService imageStorageService;

    public ImageUploadController(ImageStorageService imageStorageService) {
        this.imageStorageService = imageStorageService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<UploadedImageResponse> uploadImage(@RequestPart("image") MultipartFile image)
            throws IOException {
        String imageUrl = imageStorageService.store(image);
        return ResponseEntity.status(HttpStatus.CREATED).body(new UploadedImageResponse(imageUrl));
    }

    @GetMapping("/{fileName}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'CRAFTSMAN')")
    public ResponseEntity<Resource> getImage(@PathVariable String fileName) {
        Resource image = imageStorageService.load(fileName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .contentType(MediaType.parseMediaType(imageStorageService.getContentType(fileName)))
                .body(image);
    }
}
