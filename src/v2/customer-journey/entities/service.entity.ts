import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ServiceOptions } from './service-options.entity';

@Entity({ name: 'service_services' })
export class StoreServices {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  name: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'float' })
  price: number;

  @Column({ type: 'varchar', name: 'approx_time' })
  duration: string;

  @Column({ type: 'varchar', name: 'approx_time' })
  approx_time: string;

  @Column({ type: 'varchar', name: 'is_favourite' })
  favourite: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', name: 's3_logo_url' })
  presigned_url: string;

  @Column({ type: 'varchar' })
  s3_logo_url: string;

  @Column({ type: 'integer' })
  service_order: number;

  @Column({ type: 'float' })
  discount: number;

  @Column({ type: 'boolean' })
  is_quick_service: boolean;

  @Column({ type: 'varchar' })
  status: string;

  @OneToMany(
    () => ServiceOptions,
    (service_options) => service_options.service_id,
  )
  service_options: [];
}
