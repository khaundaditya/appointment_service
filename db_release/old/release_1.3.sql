ALTER TABLE appointment_service_booked
ADD service_option_name varchar NULL;

ALTER TABLE appointment_service_booked
ADD service_option_price FLOAT NULL;

ALTER TABLE appointment_service_booked
ADD service_price FLOAT NULL;

INSERT INTO version (version_number, service_name) VALUES ('1.3', 'appointment');