CREATE TABLE IF NOT EXISTS public.customer_cancellationpolicy
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    customer_id uuid NOT NULL,
    date timestamp without time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_accept integer,
    appointment_id uuid,
    CONSTRAINT customer_cancellationpolicy_pk PRIMARY KEY (id)
)

INSERT INTO version (version_number, service_name) VALUES ('1.9', 'appointment');