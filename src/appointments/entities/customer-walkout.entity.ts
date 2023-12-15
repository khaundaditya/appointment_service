import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'customer_walkout' })
export class CustomerWalkout extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  cutter_id: string;

  @Column({ type: 'uuid' })
  service_id: string;

  @Column({ type: 'varchar' })
  date: string;

  @Column({ type: 'varchar' })
  time: string;

  @Column({ type: 'varchar' })
  customer_name: string;

  @Column({ type: 'varchar' })
  mobile: string;

  @Column({ type: 'float' })
  is_guest: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid' })
  updated_by: string;
}
