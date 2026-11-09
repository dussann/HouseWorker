CREATE TABLE customer_reviews (
    id BIGSERIAL PRIMARY KEY,
    service_request_id BIGINT NOT NULL UNIQUE REFERENCES service_requests(id),
    customer_id BIGINT NOT NULL REFERENCES users(id),
    craftsman_id BIGINT NOT NULL REFERENCES craftsman_profiles(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_reviews_customer_created_at
    ON customer_reviews (customer_id, created_at DESC);
