package com.fixhome.web.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageStorageServiceTest {

    @TempDir
    Path uploadDirectory;

    @Test
    void storesImageWithGeneratedNameAndReturnsAuthenticatedUrl() throws Exception {
        byte[] jpegContent = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x01};
        ImageStorageService service = new ImageStorageService(uploadDirectory.toString());

        String imageUrl = service.store(new MockMultipartFile(
                "image", "user-file.jpg", "image/jpeg", jpegContent));

        assertTrue(imageUrl.matches("/api/v1/uploads/[a-f0-9-]+\\.jpg"));
        assertArrayEquals(jpegContent, Files.readAllBytes(uploadDirectory.resolve(imageUrl.substring("/api/v1/uploads/".length()))));
    }

    @Test
    void loadsStoredImageByGeneratedFileName() throws Exception {
        byte[] jpegContent = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x01};
        ImageStorageService service = new ImageStorageService(uploadDirectory.toString());
        String imageUrl = service.store(new MockMultipartFile("image", "photo.jpg", "image/jpeg", jpegContent));
        String fileName = imageUrl.substring("/api/v1/uploads/".length());

        assertArrayEquals(jpegContent, service.load(fileName).getContentAsByteArray());
        assertEquals("image/jpeg", service.getContentType(fileName));
    }

    @Test
    void rejectsImagePathTraversal() {
        ImageStorageService service = new ImageStorageService(uploadDirectory.toString());

        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.load("../../secret.jpg"));
    }

    @Test
    void rejectsFilesThatAreNotImages() {
        ImageStorageService service = new ImageStorageService(uploadDirectory.toString());
        MockMultipartFile file = new MockMultipartFile("image", "fake.jpg", "image/jpeg", new byte[]{1, 2, 3});

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.store(file));
        assertTrue(exception.getStatusCode().isSameCodeAs(HttpStatus.BAD_REQUEST));
    }
}
