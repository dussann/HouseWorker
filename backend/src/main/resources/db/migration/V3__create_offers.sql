CREATE TABLE IF NOT EXISTS offers (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    craftsman_id BIGINT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    message TEXT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_offers_request FOREIGN KEY (request_id) REFERENCES service_requests(id),
    CONSTRAINT fk_offers_craftsman FOREIGN KEY (craftsman_id) REFERENCES craftsman_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_offers_request_id ON offers(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_craftsman_id ON offers(craftsman_id);
