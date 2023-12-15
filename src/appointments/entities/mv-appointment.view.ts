import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity()
export class MvAppointments {
  @ViewColumn()
  appointment_id: string;

  @ViewColumn()
  exp_start_date: Date;

  @ViewColumn()
  exp_end_date: Date;

  @ViewColumn()
  cutter_id: string;

  @ViewColumn()
  store_id: string;

  @ViewColumn()
  tenant_id: string;

  @ViewColumn()
  client_id: string;

  @ViewColumn()
  appointment_time: Date;

  @ViewColumn()
  status: string;

  @ViewColumn()
  card_details: string;

  @ViewColumn()
  checkin_time: Date;

  @ViewColumn()
  checkout_time: Date;

  @ViewColumn()
  total_tax: number;

  @ViewColumn()
  total_price: number;

  @ViewColumn()
  is_cancelled: boolean;

  @ViewColumn()
  cancellation_charge: number;

  @ViewColumn()
  cancellation_reason: string;

  @ViewColumn()
  service_id: string;

  @ViewColumn()
  package_id: string;

  @ViewColumn()
  price: number;

  @ViewColumn()
  discount: number;

  @ViewColumn()
  service_discount: number;

  @ViewColumn()
  service_discounted_price: number;

  @ViewColumn()
  guest_user_id: string;

  @ViewColumn()
  service_option_id: string;

  @ViewColumn()
  service_option_name: string;

  @ViewColumn()
  service_option_price: string;

  @ViewColumn()
  guest_name: string;

  @ViewColumn()
  invoice_id: string;

  @ViewColumn()
  invoice_status: string;

  @ViewColumn()
  payment_status: string;

  @ViewColumn()
  invoice_cancelled: boolean;

  @ViewColumn()
  customer_email: string;

  @ViewColumn()
  customer_phone: string;

  @ViewColumn()
  service_or_package_name: string;

  @ViewColumn()
  approx_time: number;

  @ViewColumn()
  service_name: string;

  @ViewColumn()
  service_price: number;

  @ViewColumn()
  appointment_end_time: Date;

  @ViewColumn()
  appointment_uniq_id: string;
}
