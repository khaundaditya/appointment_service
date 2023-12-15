import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  expression: `SELECT * FROM public.mv_customer`,
})
export class CustomerView {
  @ViewColumn()
  customer_id: string;

  @ViewColumn()
  fav_stores: any;

  @ViewColumn()
  fav_cutters: any;

  @ViewColumn()
  fullname: any;

  @ViewColumn()
  first_name: any;

  @ViewColumn()
  last_name: any;

  @ViewColumn()
  phone: any;

  @ViewColumn()
  email: any;

  @ViewColumn()
  preferred_phone: any;
}
