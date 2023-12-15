ALTER TABLE appointment_service_booked
ADD guest_user_id uuid NULL;

ALTER TABLE appointment_service_booked
ADD is_existing_user boolean NULL;

ALTER table appointment_appointment
ALTER column client_id DROP NOT NULL;

ALTER TABLE appointment_appointment
ADD guest_user_id uuid NULL;

INSERT INTO version (version_number, service_name) VALUES ('1.2', 'appointment');