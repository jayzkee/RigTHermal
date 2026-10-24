CREATE TABLE builds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cpu VARCHAR(255),
  gpu VARCHAR(255),
  total_wattage INT,
  btu_hr FLOAT,
  monthly_cost NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
