ALTER TABLE appointment_appointment
ADD payment_mode varchar NULL;

ALTER TABLE appointment_service_booked
ADD service_discount float NULL;

ALTER TABLE appointment_service_booked
ADD service_discounted_price float NULL;

ALTER TABLE appointment_appointment
ADD reason_for_no_show varchar NULL;

ALTER TABLE appointment_appointment
ADD is_cancelled boolean NULL;

INSERT INTO version (version_number, service_name) VALUES ('1.4', 'appointment');