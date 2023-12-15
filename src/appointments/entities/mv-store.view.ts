import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity()
export class MvStores {
  @ViewColumn()
  id: string;

  @ViewColumn()
  name: string;

  @ViewColumn()
  primary_email: string;

  @ViewColumn()
  primary_contact: string;

  @ViewColumn()
  geo_lat: string;

  @ViewColumn()
  geo_long: string;

  @ViewColumn()
  store_manager_id: string;

  @ViewColumn()
  store_manager_name: string;

  @ViewColumn()
  logo: string;

  @ViewColumn()
  franchisor_name: string;

  @ViewColumn()
  tenant_id: string;

  @ViewColumn()
  description: string;

  @ViewColumn()
  country: string;

  @ViewColumn()
  state: string;

  @ViewColumn()
  suite_number: string;

  @ViewColumn()
  city: string;

  @ViewColumn()
  address: string;

  @ViewColumn()
  street_name: string;

  @ViewColumn()
  zipcode: string;

  @ViewColumn()
  weekday: string;

  @ViewColumn()
  store_open_time: string;

  @ViewColumn()
  store_end_time: string;

  @ViewColumn()
  store_image: string;

  @ViewColumn()
  image_id: string;

  @ViewColumn()
  image_name: string;

  @ViewColumn()
  store_config_id: string;

  @ViewColumn()
  store_config_category: string;

  @ViewColumn()
  store_config_value: string;

  @ViewColumn()
  modified_at: Date;

  @ViewColumn()
  create_at: Date;

  @ViewColumn()
  status: string;

  @ViewColumn()
  tax_rate: number;

  @ViewColumn()
  timezone: string;
}
