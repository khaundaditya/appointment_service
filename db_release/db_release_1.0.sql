SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 37644)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4892 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

CREATE TABLE public.appointment_appointment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    client_id uuid,
    appointment_time timestamp without time zone NOT NULL,
    total_price double precision NOT NULL,
    discount double precision,
    total_tax double precision NOT NULL,
    status character varying NOT NULL,
    cancellation_reason text,
    requested_from character varying,
    notification_type character varying,
    checkin_time timestamp without time zone,
    checkout_time timestamp without time zone,
    created_by uuid NOT NULL,
    modified_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    modified_at timestamp without time zone,
    cutter_note character varying(500),
    card_details json,
    appointment_end_time timestamp without time zone,
    cancellation_charge double precision,
    beverages json,
    music json,
    instorexp json,
    guest_user_id uuid,
    payment_mode character varying,
    reason_for_no_show character varying,
    is_cancelled boolean,
    is_updated_by_cron integer,
    store_timezone character varying,
    appointment_uniq_id character varying,
    CONSTRAINT appointment_appointment_pk PRIMARY KEY (id)
);


ALTER TABLE public.appointment_appointment OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 44421)
-- Name: appointment_service_booked; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment_service_booked (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    appointment_id uuid,
    exp_start_date timestamp without time zone,
    exp_end_date timestamp without time zone,
    actual_start_time timestamp without time zone,
    actual_end_time timestamp without time zone,
    store_id uuid,
    price double precision,
    tax numeric,
    feedback character varying(20),
    created_by uuid,
    modified_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    modified_at timestamp without time zone,
    cutter_id uuid,
    service_id uuid,
    guest_name character varying(50),
    package_id uuid,
    service_option_id uuid,
    cutter_note character varying(500),
    extra_time integer,
    cancellation_reason text,
    cancellation_charge integer,
    is_existing_user boolean,
    guest_user_id uuid,
    discount double precision,
    service_price double precision,
    service_option_price double precision,
    service_option_name character varying,
    service_discounted_price double precision,
    service_discount double precision,
    is_cutter_assigned integer,
    service_or_package_name character varying,
    service_name character varying,
    approx_time double precision,
    CONSTRAINT appointment_service_booked_pkey PRIMARY KEY (id)
);


ALTER TABLE public.appointment_service_booked OWNER TO postgres;

-- View: public.mv_appointments

-- DROP VIEW public.mv_appointments;

CREATE OR REPLACE VIEW public.mv_appointments
 AS
 SELECT asb.appointment_id,
    asb.exp_start_date,
    asb.exp_end_date,
    asb.cutter_id,
    asb.store_id,
    aa.tenant_id,
    aa.client_id,
    aa.appointment_time,
    aa.status,
    aa.card_details,
    aa.checkin_time,
    aa.checkout_time,
    aa.total_tax,
    aa.total_price,
    aa.is_cancelled,
    aa.cancellation_charge,
    aa.cancellation_reason,
    asb.service_id,
    asb.package_id,
    asb.price,
    asb.discount,
    asb.service_discount,
    asb.service_discounted_price,
    asb.guest_user_id,
    asb.service_option_id,
    asb.service_option_name,
    asb.service_option_price,
    asb.guest_name,
    pi.id AS invoice_id,
    pi.status AS invoice_status,
    pi.payment_status,
    pi.is_cancelled AS invoice_cancelled,
    cu.email AS customer_email,
    cu.phone AS customer_phone,
    asb.service_or_package_name,
    asb.approx_time,
    asb.service_name,
    asb.service_price,
    aa.appointment_end_time,
    aa.appointment_uniq_id
   FROM public.appointment_appointment aa
     JOIN public.appointment_service_booked asb ON asb.appointment_id = aa.id
     LEFT JOIN public.payments_invoice pi ON pi.appointment_id = aa.id
     LEFT JOIN public.customer_user cu ON cu.id = aa.client_id
  WHERE aa.status::text IS NOT NULL;

ALTER TABLE public.mv_appointments
    OWNER TO postgres;

ALTER TABLE public.customer_walkout OWNER TO postgres;

-- Table: public.customer_cancellationpolicy

-- DROP TABLE IF EXISTS public.customer_cancellationpolicy;

CREATE TABLE public.customer_cancellationpolicy
(
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    date timestamp without time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_accept integer,
    appointment_id uuid,
    CONSTRAINT customer_cancellationpolicy_pk PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.customer_cancellationpolicy
    OWNER to postgres;

 INSERT INTO public.version(version_number, service_name) VALUES (1.0, 'appointment');