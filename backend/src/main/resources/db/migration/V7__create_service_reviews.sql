CREATE TABLE service_reviews (
    id BIGSERIAL PRIMARY KEY,
    service_request_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    craftsman_id BIGINT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_reviews_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id),
    CONSTRAINT fk_service_reviews_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_service_reviews_craftsman FOREIGN KEY (craftsman_id) REFERENCES craftsman_profiles(id)
);

CREATE INDEX idx_service_reviews_craftsman_created_at
    ON service_reviews (craftsman_id, created_at DESC);
