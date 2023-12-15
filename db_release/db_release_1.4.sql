ALTER TABLE appointment_appointment
ADD is_rebook_by_admin BOOLEAN NULL;

INSERT INTO public.version(version_number, service_name) VALUES (1.4, 'appointment');