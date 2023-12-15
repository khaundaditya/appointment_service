CREATE TABLE IF NOT EXISTS public.appointment_appointment
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id uuid,
    client_id uuid NOT NULL,
    appointment_time timestamp without time zone NOT NULL,
    total_price double precision NOT NULL,
    discount double precision,
    total_tax double precision NOT NULL,
    status character varying COLLATE pg_catalog."default" NOT NULL,
    cancellation_reason text COLLATE pg_catalog."default",
    requested_from character varying COLLATE pg_catalog."default",
    notification_type character varying COLLATE pg_catalog."default",
    checkin_time timestamp without time zone NOT NULL,
    checkout_time timestamp without time zone NOT NULL,
    created_by uuid NOT NULL,
    modified_by uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    modified_at timestamp without time zone,
    cutter_note character varying(200) COLLATE pg_catalog."default",
    card_details json,
    CONSTRAINT appointment_appointment_pk PRIMARY KEY (id)
)

CREATE TABLE IF NOT EXISTS public.appointment_service_booked
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id uuid,
    appointment_id uuid,
    exp_start_date timestamp without time zone,
    exp_end_date timestamp without time zone,
    actual_start_time timestamp without time zone,
    actual_end_time timestamp without time zone,
    store_id uuid,
    price double precision,
    tax numeric,
    feedback character varying(20) COLLATE pg_catalog."default",
    created_by uuid,
    modified_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    modified_at timestamp without time zone,
    cutter_id uuid,
    service_id uuid,
    guest_name character varying(50) COLLATE pg_catalog."default",
    package_id uuid,
    service_option_id uuid,
    cutter_note character varying(150) COLLATE pg_catalog."default",
    CONSTRAINT appointment_service_booked_pkey PRIMARY KEY (id)
)

INSERT INTO version (version_number, service_name) VALUES ('1.0', 'appointment');
