ALTER TABLE craftsman_profiles
    ADD COLUMN expo_push_token VARCHAR(255);

CREATE TABLE craftsman_notification_cities (
    craftsman_id BIGINT NOT NULL,
    city VARCHAR(120) NOT NULL,
    CONSTRAINT fk_craftsman_notification_cities_profile
        FOREIGN KEY (craftsman_id) REFERENCES craftsman_profiles(id) ON DELETE CASCADE,
    CONSTRAINT uk_craftsman_notification_city
        UNIQUE (craftsman_id, city)
);

INSERT INTO craftsman_notification_cities (craftsman_id, city)
SELECT profile.id, trim(users.city)
FROM craftsman_profiles profile
JOIN users ON users.id = profile.user_id
WHERE users.city IS NOT NULL
  AND trim(users.city) <> '';
