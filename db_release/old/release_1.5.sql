ALTER TABLE appointment_appointment
ADD store_timezone varchar NULL;

INSERT INTO version (version_number, service_name) VALUES ('1.5', 'appointment');