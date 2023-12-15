import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity()
export class MvServices {
  @ViewColumn()
  service_id: string;

  @ViewColumn()
  service_name: string;

  @ViewColumn()
  service_description: string;

  @ViewColumn()
  price: number;

  @ViewColumn()
  type: string;

  @ViewColumn()
  discount: number;

  @ViewColumn()
  svc_option_id: string;

  @ViewColumn()
  package_id: string;

  @ViewColumn()
  service_id_associated_with_package: string;

  @ViewColumn()
  tenant_id: string;
  @ViewColumn()
  service_order: string;

  @ViewColumn()
  service_category_id: string;

  @ViewColumn()
  service_category_name: string;

  @ViewColumn()
  service_category_descripion: string;

  @ViewColumn()
  service_image_url: string;

  @ViewColumn()
  approx_time: string;

  @ViewColumn()
  store_id: string;

  @ViewColumn()
  svc_option_name: string;

  @ViewColumn()
  name: string;

  @ViewColumn()
  svc_option_duration: string;

  @ViewColumn()
  optional_service_price: number;

  @ViewColumn()
  upsell_service_id: string;

  @ViewColumn()
  status: string;

  @ViewColumn()
  is_quick_service: boolean;
}
