INSERT INTO categories (name)
VALUES
    ('Električar'),
    ('Vodoinstalater'),
    ('Moler'),
    ('Keramičar'),
    ('Stolar')
ON CONFLICT (name) DO NOTHING;
