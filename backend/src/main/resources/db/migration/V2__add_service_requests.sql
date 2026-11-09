CREATE TABLE IF NOT EXISTS service_requests (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(500),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_requests_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_service_requests_category FOREIGN KEY (category_id) REFERENCES categories(id)
);
