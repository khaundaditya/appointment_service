ALTER TABLE appointment_service_booked
ADD service_option_duration INTEGER NULL;

INSERT INTO public.version(version_number, service_name) VALUES (1.1, 'appointment');