ALTER TABLE appointment_appointment
ADD booked_from VARCHAR NULL;

INSERT INTO public.version(version_number, service_name) VALUES (1.5, 'appointment');