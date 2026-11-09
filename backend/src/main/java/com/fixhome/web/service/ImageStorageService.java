package com.fixhome.web.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

@Service
public class ImageStorageService {

    private static final long MAX_IMAGE_SIZE = 5L * 1024 * 1024;
    private final Path uploadDirectory;

    public ImageStorageService(@Value("${fixhome.upload-dir:uploads}") String uploadDirectory) {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
    }

    public String store(MultipartFile image) throws IOException {
        if (image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is empty");
        }
        if (image.getSize() > MAX_IMAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must not exceed 5 MB");
        }

        byte[] content = image.getBytes();
        String extension = getImageExtension(image.getContentType(), content);
        String fileName = UUID.randomUUID() + extension;

        Files.createDirectories(uploadDirectory);
        Files.write(uploadDirectory.resolve(fileName), content, StandardOpenOption.CREATE_NEW);
        return "/api/v1/uploads/" + fileName;
    }

    public Resource load(String fileName) {
        if (!fileName.matches("[a-f0-9-]{36}\\.(jpg|png|webp)")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found");
        }

        Path imagePath = uploadDirectory.resolve(fileName).normalize();
        if (!imagePath.startsWith(uploadDirectory) || !Files.isRegularFile(imagePath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found");
        }
        return new FileSystemResource(imagePath);
    }

    public String getContentType(String fileName) {
        if (fileName.endsWith(".png")) return "image/png";
        if (fileName.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    private String getImageExtension(String contentType, byte[] content) {
        if ("image/jpeg".equalsIgnoreCase(contentType)
                && content.length >= 3
                && (content[0] & 0xFF) == 0xFF
                && (content[1] & 0xFF) == 0xD8
                && (content[2] & 0xFF) == 0xFF) {
            return ".jpg";
        }
        if ("image/png".equalsIgnoreCase(contentType)
                && content.length >= 8
                && (content[0] & 0xFF) == 0x89
                && content[1] == 'P'
                && content[2] == 'N'
                && content[3] == 'G'
                && (content[4] & 0xFF) == 0x0D
                && (content[5] & 0xFF) == 0x0A
                && (content[6] & 0xFF) == 0x1A
                && (content[7] & 0xFF) == 0x0A) {
            return ".png";
        }
        if ("image/webp".equalsIgnoreCase(contentType)
                && content.length >= 12
                && content[0] == 'R'
                && content[1] == 'I'
                && content[2] == 'F'
                && content[3] == 'F'
                && content[8] == 'W'
                && content[9] == 'E'
                && content[10] == 'B'
                && content[11] == 'P') {
            return ".webp";
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only valid JPEG, PNG, or WebP images are supported");
    }
}
