import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity()
export class MvBrands {
  @ViewColumn()
  tenant_id: string;

  @ViewColumn()
  brand_name: string;

  @ViewColumn()
  slug: string;

  @ViewColumn()
  category: string;

  @ViewColumn()
  value: string;
}
