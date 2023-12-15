ALTER TABLE appointment_service_booked
ADD service_or_package_name varchar NULL;

ALTER TABLE appointment_service_booked
ADD service_name varchar NULL;

ALTER TABLE appointment_service_booked
ADD approx_time FLOAT NULL;

INSERT INTO version (version_number, service_name) VALUES ('1.7', 'appointment');